import os
import time
from pathlib import Path
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.main import app, load_sessions
import app.main as main_mod
from app.document_store import DocumentStore
import app.query_rewriter as query_rewriter

client = TestClient(app)
main_mod.store = DocumentStore(index_dir=str(main_mod.INDEX_DIR))

print("=== GramSakhi Stage 3 Validation Suite ===\n")

print("Authenticating test user...")
# First register and login a test user
client.post("/register", json={"username": "testuser99", "password": "testpassword123", "email": "test99@test.com"})
login_resp = client.post("/token", data={"username": "testuser99", "password": "testpassword123"})
if login_resp.status_code == 200:
    token = login_resp.json().get("access_token")
    client.headers.update({"Authorization": f"Bearer {token}"})
    print("✅ Authenticated.")
else:
    print("⚠ Failed to authenticate test user.")
    sys.exit(1)

print("\nChecking Ollama availability...")
import requests
try:
    r = requests.get("http://localhost:11434/api/tags", timeout=2)
    if r.status_code == 200:
        print("✅ Ollama is running.")
        models = [m["name"] for m in r.json().get("models", [])]
        if "llama3.2:3b" in models or "llama3.2:3b-text" in models or any("llama3.2" in m for m in models):
            print("✅ Model llama3.2:3b is available.")
        else:
            print("⚠ Configured model llama3.2:3b is missing.")
            print("Please run: ollama pull llama3.2:3b")
            sys.exit(1)
    else:
        print("⚠ Ollama returned error.")
        sys.exit(1)
except Exception as e:
    print("⚠ Ollama is NOT reachable: Connection Refused.")
    print("Please start Ollama and ensure 'ollama run llama3.2:3b' works.")
    sys.exit(1)


print("\n--- 1. Missing-KB Refusal Test ---")
missing_kb_queries = [
    "What is the PM KISAN Samman Nidhi scheme?",
    "How do I apply for a driver's license in Delhi?",
    "What are the benefits of the Ayushman Bharat scheme?",
    "Who is eligible for the MGNREGA scheme?",
    "Tell me about the National Education Policy 2020."
]
all_missing_pass = True

# We need access to DocumentStore to show detailed metrics
store = DocumentStore(index_dir=str(Path(__file__).resolve().parent / "indexes"))

for q in missing_kb_queries:
    print(f"\n* Original question: {q}")
    print(f"* Retrieval query: {q}") # Assuming no rewrite for pure query
    
    # Manually get scores to print them
    docs = store.search(q, k=1, use_mmr=False)
    if not docs:
        print("* Top retrieved document/scheme: NONE")
        print("* Hybrid score: NONE")
        print("* CrossEncoder score: NONE")
    else:
        doc = docs[0]
        print(f"* Top retrieved document/scheme: {doc.get('metadata', {}).get('scheme_name', doc.get('metadata', {}).get('source', 'Unknown'))}")
        print(f"* Hybrid score: {doc.get('score', 'N/A')}")
        # Need to call rerank to get CE score
        try:
            reranked = store.rerank_and_mmr(candidates=docs, query=q, min_ce_score=-999) # Allow all to see score
            ce_score = reranked[0].get('score', 'N/A') if reranked else "N/A"
        except Exception as e:
            ce_score = f"N/A ({e})"
        print(f"* CrossEncoder score: {ce_score}")
        
    response = client.post("/query", json={"question": q, "model": "llama", "use_mmr": True})
    ans = response.json().get("answer", "")
    print(f"* Final LLM response: {ans}")
    if "I could not find sufficient verified information" in ans or "I'm sorry" in ans:
        print("* PASS/FAIL: [PASS]")
    else:
        print("* PASS/FAIL: [FAIL]")
        all_missing_pass = False


print("\n--- 1B. Supported Queries Regression Test ---")
supported_queries = [
    "What are the benefits under IT Policy Schemes 2018?",
    "How can I apply for training with new production?",
    "What is the ITSYS Scheme?",
    "Who is eligible for IT Policy 2018?",
    "What is the application procedure for ITSYS scheme?",
    "What is the duration of the IT Saksham Yuva Scheme?",
    "Are there any age limits for the ITSYS scheme?",
    "Can a registered group apply for training with new production?"
]
supported_accepts = 0
supported_rejects = 0

for q in supported_queries:
    print(f"\n* Question: {q}")
    docs = store.search(q, k=1, use_mmr=False)
    if not docs:
        print("* Rejected by initial retrieval")
        supported_rejects += 1
        continue
    try:
        reranked = store.rerank_and_mmr(candidates=docs, query=q, min_ce_score=-8.0)
    except:
        reranked = []
        
    if not reranked:
        print("* Rejected by CE gate (-8.0)")
        supported_rejects += 1
        continue
        
    response = client.post("/query", json={"question": q, "model": "llama", "use_mmr": True})
    ans = response.json().get("answer", "")
    if "I could not find sufficient verified information" in ans or "I'm sorry" in ans:
        print("* Rejected by Evidence Validator! [FALSE REJECTION]")
        supported_rejects += 1
    else:
        print("* Accepted by Evidence Validator! [PASS]")
        supported_accepts += 1

print("\n--- 1C. Completely Unrelated Queries ---")
unrelated_queries = [
    "What is GramSakhi?",
    "How does photosynthesis work?",
    "How to bake a chocolate cake?"
]
for q in unrelated_queries:
    print(f"\n* Question: {q}")
    docs = store.search(q, k=1, use_mmr=False)
    if not docs:
        print("* Rejected by Hybrid Gate [PASS]")
        continue
    try:
        reranked = store.rerank_and_mmr(candidates=docs, query=q, min_ce_score=-8.0)
    except:
        reranked = []
        
    if not reranked:
        print("* Rejected by CE gate [PASS]")
        continue
    
    response = client.post("/query", json={"question": q, "model": "llama", "use_mmr": True})
    ans = response.json().get("answer", "")
    if "I could not find sufficient verified information" in ans:
        print("* Rejected by Evidence Validator [PASS]")
    else:
        print("* Hallucination or False Accept! [FAIL]")

print("\n--- 2. Partial-Grounding Test ---")
partial_q = "Who is eligible for IT Policy 2018, and how do I apply?"
response = client.post("/query", json={"question": partial_q, "model": "llama", "use_mmr": True})
ans = response.json().get("answer", "")
print(f"Query: {partial_q}")
print(f"Response snippet: {ans[:200]}...")
if "sufficient verified information" in ans or "I could not find" in ans:
    print("[PASS] Handled partial information properly.")


print("\n--- 3. Contextual Chat Query Rewriting ---")
hist = [
    {"role": "user", "content": "Tell me about IT Policy 2018."},
    {"role": "assistant", "content": "The IT Policy 2018 provides various benefits..."}
]
follow_up = "Who is eligible?"
rewritten = query_rewriter.rewrite_query_for_retrieval(hist, follow_up, "llama")
print(f"Original:\n\"{follow_up}\"")
print(f"Rewritten retrieval query:\n\"{rewritten}\"")

docs = store.search(rewritten, k=1)
if docs:
    print(f"Retrieved scheme/document:\n\"{docs[0].get('metadata', {}).get('scheme_name', docs[0].get('metadata', {}).get('source'))}\"")
else:
    print(f"Retrieved scheme/document:\n\"NONE\"")

chat_sess = client.post("/chat/sessions").json()
ans = client.post("/chat/message", json={"session_id": chat_sess["id"], "message": follow_up, "model": "llama3.2:3b"}).json().get("answer", "")
print(f"Final answer:\n\"{ans}\"")

if "IT Policy" in rewritten:
    print("[PASS] Rewriter resolved context.")
else:
    print("[FAIL] Rewriter failed to resolve context.")

print("\n--- 3B. Contextual Chat Query Rewriting (Scheme A) ---")
hist2 = [
    {"role": "user", "content": "Tell me about Scheme A."},
    {"role": "assistant", "content": "Scheme A is a great program for students."}
]
follow_up2 = "What are the benefits?"
rewritten2 = query_rewriter.rewrite_query_for_retrieval(hist2, follow_up2, "llama3.2:3b")
print(f"Original:\n\"{follow_up2}\"")
print(f"Rewritten retrieval query:\n\"{rewritten2}\"")
if "Scheme A" in rewritten2:
    print("[PASS] Rewriter resolved context.")
else:
    print("[FAIL] Rewriter failed to resolve context.")


print("\n--- 4. Self-Contained Chat Question ---")
self_contained = "What are the eligibility requirements for ITSYS scheme?"
rewritten_sc = query_rewriter.rewrite_query_for_retrieval(hist, self_contained, "llama3.2:3b")
print(f"Original: {self_contained}\nRewritten: {rewritten_sc}")


print("\n--- 5. Query-Rewriter Failure Handling ---")
original_func = query_rewriter.call_llama
# Mock failure
query_rewriter.call_llama = lambda prompt, model, max_tokens: None
fallback_test = query_rewriter.rewrite_query_for_retrieval(hist, "Who is eligible?", "llama3.2:3b")
query_rewriter.call_llama = original_func
if fallback_test == "Who is eligible?":
    print("[PASS] Safely fell back to original query on failure.")
else:
    print("[FAIL] Did not fallback safely.")


print("\n--- 6. Chat Endpoint Integration ---")
# /chat/message
chat_sess = client.post("/chat/sessions").json()
resp = client.post("/chat/message", json={"message": "What is the capital of France?", "session_id": chat_sess["id"], "model": "llama3.2:3b"})
if "sufficient verified information" in resp.json().get("answer", ""):
    print("[PASS] /chat/message is using unified retrieval gates.")
else:
    print("[FAIL] /chat/message hallucinated or bypassed gates.")

# /chat/message/stream
with client.stream("POST", "/chat/message/stream", json={"message": "What is the capital of France?", "session_id": chat_sess["id"], "model": "llama3.2:3b"}) as r:
    stream_ans = r.read().decode("utf-8") if hasattr(r, "read") else r.text
    if "sufficient verified information" in stream_ans:
        print("[PASS] /chat/message/stream is using unified retrieval gates.")
    else:
        print("[FAIL] /chat/message/stream hallucinated or bypassed gates.")


print("\n--- 7. Chat Isolation Test ---")
# Create two users implicitly by sending messages
sess_A = client.post("/chat/sessions").json()
client.post("/chat/message", json={"message": "I am User A", "session_id": sess_A["session_id"], "model": "llama3.2:3b"})
sess_B = client.post("/chat/sessions").json()
client.post("/chat/message", json={"message": "I am User B", "session_id": sess_B["session_id"], "model": "llama3.2:3b"})

sess_A = {}
sess_B = {}
sessions = load_sessions()
for s in sessions:
    if s["id"] == sess_A["session_id"]:
        sess_A = s
    if s["id"] == sess_B["session_id"]:
        sess_B = s

if "I am User B" not in str(sess_A) and "I am User A" not in str(sess_B):
    print("[PASS] Chat histories are isolated between sessions.")
else:
    print("[FAIL] Chat histories are bleeding between sessions.")

print("\nValidation Suite Completed.")





