# app/chat.py  — FULL FINAL VERSION

import time
import uuid
import json
from pathlib import Path
from fastapi import Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.auth import get_current_user
from app.document_store import DocumentStore
from app.llm import call_llm
from app.chat_prompt import build_chat_prompt
from app.retrieval_service import retrieve_government_context
from app.evidence_validator import validate_evidence
from app.query_rewriter import rewrite_query_for_retrieval

CHAT_DB = Path(__file__).resolve().parent.parent / "chat_sessions.json"
if not CHAT_DB.exists():
    CHAT_DB.write_text("[]")


def load_sessions():
    try:
        return json.loads(CHAT_DB.read_text())
    except:
        return []


def save_sessions(data):
    CHAT_DB.write_text(json.dumps(data, indent=2))


# ------------------------------------------------------------
# LIST USER SESSIONS
# ------------------------------------------------------------
async def get_sessions(current_user=Depends(get_current_user)):
    sessions = load_sessions()
    return [s for s in sessions if s["user_id"] == current_user["id"]]


# ------------------------------------------------------------
# CREATE SESSION
# ------------------------------------------------------------
async def create_session(current_user=Depends(get_current_user)):
    sessions = load_sessions()

    new_s = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "title": "New Chat",
        "messages": [],
        "created_at": int(time.time()),
    }

    sessions.append(new_s)
    save_sessions(sessions)
    return new_s


# ------------------------------------------------------------
# NON-STREAMING CHAT MESSAGE (FIXED)
# ------------------------------------------------------------
async def chat_message(payload: dict, store: DocumentStore, current_user=Depends(get_current_user)):
    session_id = payload.get("session_id")
    message = payload.get("message")
    model = payload.get("model", "gpt")

    if not session_id or not message:
        raise HTTPException(400, "Missing session_id or message")

    sessions = load_sessions()
    s = next((x for x in sessions if x["id"] == session_id and x["user_id"] == current_user["id"]), None)
    if not s:
        raise HTTPException(404, "Session not found")

    # store user input
    s["messages"].append({"role": "user", "content": message})

    # Optional query rewriting for conversational context
    # Use history up to the message just added
    search_query = rewrite_query_for_retrieval(s["messages"][:-1], message, model)

    # retrieve docs (Unified GramSakhi Retrieval)
    retrieved = retrieve_government_context(search_query, store)
    
    if not retrieved:
        reply = "I could not find sufficient verified information in the available government documents to answer this question."
        s["messages"].append({"role": "assistant", "content": reply})
        save_sessions(sessions)
        return {"answer": reply, "references": []}

    # Evidence Sufficiency Validation
    validation_query = f"User asked: {message}\n(Resolved to: {search_query})"
    is_supported = validate_evidence(validation_query, retrieved, model=model)
    
    if not is_supported:
        reply = "I could not find sufficient verified information in the available government documents to answer this question."
        s["messages"].append({"role": "assistant", "content": reply})
        save_sessions(sessions)
        return {"answer": reply, "references": []}

    # Build LLM prompt using latest history
    prompt = build_chat_prompt(s["messages"], retrieved)

    # === FIXED === use REAL LLM instead of simple retrieval answer
    answer = call_llm(prompt, model=model)

    # save assistant response
    s["messages"].append({"role": "assistant", "content": answer})
    save_sessions(sessions)

    # build simple references
    refs = []
    for c in retrieved:
        refs.append({
            "source": c.get("file_id") or c.get("source", "Unknown"),
            "page": c.get("page_num", c.get("page", 0)),
            "chunk": c.get("chunk_id", -1)
        })

    return {
        "answer": answer,
        "references": refs
    }


# ------------------------------------------------------------
# STREAMING CHAT MESSAGE (LLM TOKEN STREAM)
# ------------------------------------------------------------
async def chat_message_stream(payload: dict, store: DocumentStore, current_user=Depends(get_current_user)):
    session_id = payload.get("session_id")
    message = payload.get("message")
    model = payload.get("model", "gpt")

    if not session_id or not message:
        raise HTTPException(400, "Missing session_id or message")

    sessions = load_sessions()
    s = next((x for x in sessions if x["id"] == session_id and x["user_id"] == current_user["id"]), None)
    if not s:
        raise HTTPException(404, "Session not found")

    # store user message
    s["messages"].append({"role": "user", "content": message})

    # retrieve docs
    retrieved = store.search(
        message,
        k=10,
        embed_weight=0.7,
        bm25_weight=0.3
    )

    # Build prompt
    prompt = build_chat_prompt(s["messages"], retrieved)

    # === STREAMING GENERATOR ===
    def token_generator():
        full_reply = ""

        # call_llm normally returns full text, but for streaming we simulate token splits
        reply = call_llm(prompt, model=model)
        for tok in reply.split():
            yield tok + " "
            full_reply += tok + " "
            time.sleep(0.015)

        # store final assistant message
        s["messages"].append({"role": "assistant", "content": full_reply})
        save_sessions(sessions)

    return StreamingResponse(token_generator(), media_type="text/plain")
