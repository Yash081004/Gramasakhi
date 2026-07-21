# app/llm.py - COMPLETE VERIFIED VERSION WITH DEFAULT_MODEL SUPPORT
import os
import requests
from typing import List, Dict, Optional
import textwrap
import time

# Environment variable helpers
def _get_openai_key():
    return os.getenv("OPENAI_API_KEY")

def _get_llama_url():
    return os.getenv("LLAMA_API_URL", "")

def _get_llama_model():
    return os.getenv("LLAMA_MODEL", "llama3")

def _get_default_model():
    """Read DEFAULT_MODEL from env; fallback to 'llama' for safety."""
    dm = os.getenv("DEFAULT_MODEL", "").strip().lower()
    if not dm:
        return "llama"
    return dm

# --- OpenAI / GPT call ---
def call_openai_chat(prompt: str, max_tokens: int = 500) -> Optional[str]:
    """Call OpenAI chat completions with better error handling."""
    OPENAI_API_KEY = _get_openai_key()
    if not OPENAI_API_KEY:
        print("⚠ No OpenAI API key configured")
        return None

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    data = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": min(max_tokens, 1000),
        "temperature": 0.2
    }
    
    for attempt in range(3):
        try:
            start_time = time.time()
            r = requests.post(url, json=data, headers=headers, timeout=30)
            
            if r.status_code == 429:
                print("⚠ OpenAI rate limited - retrying in 2 seconds...")
                time.sleep(2)
                continue
            elif r.status_code == 401:
                print("⚠ OpenAI API key invalid")
                return None
            elif r.status_code != 200:
                print(f"⚠ OpenAI HTTP error {r.status_code}")
                return None
                
            r.raise_for_status()
            j = r.json()
            return j["choices"][0]["message"]["content"]
        except Exception as e:
            print("⚠ OpenAI call failed:", e)
            return None
    return None


def call_gpt(prompt: str, max_tokens: int = 500) -> Optional[str]:
    return call_openai_chat(prompt, max_tokens=max_tokens)

# --- LLaMA / Ollama ---
def call_llama(prompt: str, max_tokens: int = 300, model: Optional[str] = None) -> Optional[str]:
    LLAMA_API_URL = _get_llama_url()
    if not LLAMA_API_URL:
        print("⚠ No LLaMA API URL configured")
        return None

    llama_model = model or _get_llama_model()
    print(f"🔧 LLaMA call: model={llama_model}, tokens={max_tokens}")
    
    # Optimized payload for faster responses
    payload = {
        "model": llama_model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "num_predict": min(max_tokens, 400),
            "temperature": 0.1,
            "top_k": 10,
            "top_p": 0.7,
            "repeat_penalty": 1.2,
        }
    }

    try:
        start_time = time.time()
        r = requests.post(LLAMA_API_URL, json=payload, timeout=60)
        
        if r.status_code != 200:
            print(f"⚠ LLaMA API error {r.status_code}")
            return None

        data = r.json()
        response = data.get("response", "").strip()
        elapsed = time.time() - start_time
        
        if response:
            eval_time = data.get('eval_duration', 0)/1e9
            print(f"✅ LLaMA SUCCESS: {len(response)} chars, time: {elapsed:.2f}s")
            return response
        else:
            print("⚠ LLaMA returned empty response")
            return None

    except requests.exceptions.Timeout:
        print("⚠ LLaMA call timed out after 25s - using fallback")
        return None
    except Exception as e:
        print(f"⚠ LLaMA call failed: {e}")
        return None

# --- Hybrid orchestration ---
def call_hybrid(prompt: str, max_tokens: int = 600, llama_model: Optional[str] = None) -> str:
    """SMART hybrid mode - prefer GPT only if configured, otherwise use LLaMA."""
    print("🎯 SMART hybrid mode analyzing...")
    
    # Try GPT only if an OpenAI key is configured
    should_try_gpt = bool(_get_openai_key())

    if should_try_gpt:
        print("🔁 SMART Hybrid: attempting OpenAI first (fast path)")
        try:
            gpt_response = call_gpt(prompt, max_tokens=max_tokens)
        except Exception:
            gpt_response = None
        if gpt_response:
            print("✅ SMART Hybrid: OpenAI responded")
            return gpt_response
        print("🔁 SMART Hybrid: OpenAI failed — falling back to LLaMA")

    # If no OpenAI key or GPT failed, use LLaMA
    print("🔧 SMART Hybrid: Using optimized LLaMA single-call")
    optimized_prompt = f"""Provide a comprehensive answer: {prompt}

Structure your response clearly and include relevant details."""
    response = call_llama(optimized_prompt, max_tokens=max_tokens, model=llama_model)
    if response:
        print(f"✅ SMART Hybrid: Quality response from LLaMA ({len(response)} chars)")
        return response

    # As a last resort, attempt GPT if we haven't tried or if LLaMA failed
    if not should_try_gpt:
        print("🔁 SMART Hybrid: final attempt with OpenAI (if available)")
        final_gpt = call_gpt(prompt, max_tokens=max_tokens)
        if final_gpt:
            return final_gpt

    return "Unable to generate response."

# --- Central dispatcher ---
def call_llm(prompt: str, model: str = "gpt", max_tokens: int = 500, llama_model: Optional[str] = None) -> str:
    """Central LLM dispatcher: honor model param; fallback to DEFAULT_MODEL env if not provided."""
    raw_model = (model or "").strip().lower()
    # Normalize common aliases: gpt-4, gpt-3.5-turbo -> gpt; llama variants -> llama
    if not raw_model:
        raw_model = _get_default_model()
        print(f"🔧 No model specified, using DEFAULT_MODEL: {raw_model}")

    if raw_model.startswith("gpt") or raw_model.startswith("gpt-") or "gpt" in raw_model:
        model = "gpt"
    elif "llama" in raw_model or raw_model.startswith("llm"):
        model = "llama"
    elif "hybrid" in raw_model:
        model = "hybrid"
    else:
        # unknown labels -> attempt to use default
        model = _get_default_model()

    if model == "gpt":
        resp = call_gpt(prompt, max_tokens=max_tokens)
        if resp:
            return resp
        # fallback to llama
        print("⚠ GPT failed, falling back to LLaMA")
        ll = call_llama(prompt, max_tokens=max_tokens, model=llama_model)
        return ll or "No LLM available."
    
    elif model == "llama":
        resp = call_llama(prompt, max_tokens=max_tokens, model=llama_model)
        if resp:
            return resp
        # fallback to gpt
        print("⚠ LLaMA failed, falling back to GPT")
        gpt = call_gpt(prompt, max_tokens=max_tokens)
        return gpt or "No LLM available."
    
    elif model == "hybrid":
        return call_hybrid(prompt, max_tokens=max_tokens, llama_model=llama_model)
    
    else:
        # unknown label -> try default GPT path then llama
        print(f"⚠ Unknown model '{model}', trying GPT first")
        resp = call_gpt(prompt, max_tokens=max_tokens)
        if resp:
            return resp
        return call_llama(prompt, max_tokens=max_tokens, model=llama_model) or "No LLM available."

# --- Answer formatting utilities ---
def detect_answer_length(question: str) -> str:
    q = question.lower()
    short_triggers = ["short", "brief", "in two", "in 2", "one line", "one-liner", "tl;dr", "summary"]
    long_triggers = ["in detail", "elaborate", "explain in detail", "detailed", "full", "comprehensive", "long"]
    if any(t in q for t in short_triggers):
        return "short"
    if any(t in q for t in long_triggers):
        return "detailed"
    def_triggers = ["what is", "define", "meaning of", "who is", "when is"]
    if any(t in q for t in def_triggers):
        return "short"
    return "medium"

def format_short_answer(question: str, top_chunks: List[Dict]) -> str:
    primary = top_chunks[0]
    text = primary.get("text", "").strip()
    short_sent = text.split(".")[0].strip()
    out = f"## Definition\n{short_sent}.\n\n## Citation\nSource: {primary.get('source')} (chunk {primary.get('chunk_id')})"
    return out

def format_medium_answer(question: str, top_chunks: List[Dict]) -> str:
    parts = []
    parts.append(f"## Question\n{question}\n")
    parts.append("## Answer (summary)\n")
    for i, c in enumerate(top_chunks[:3], start=1):
        snippet = " ".join(c.get("text", "").split()[:60])
        parts.append(f"{i}. {snippet}... (Source: {c.get('source')}, chunk {c.get('chunk_id')})")
    parts.append("\n## Citations\n" + ", ".join([f"{c.get('source')} (chunk {c.get('chunk_id')})" for c in top_chunks[:3]]))
    return "\n".join(parts)

def format_detailed_answer(question: str, top_chunks: List[Dict]) -> str:
    parts = []
    parts.append(f"### 1. Introduction\n{top_chunks[0].get('text','')[:800]}\n")
    parts.append("### 2. Details & Explanation\n")
    for c in top_chunks[:5]:
        parts.append(f"- { ' '.join(c.get('text','').split()[:80]) }... (Source: {c.get('source')}, chunk {c.get('chunk_id')})")
    parts.append("\n### 3. Conclusion\nA concise conclusion based on the retrieved passages.")
    parts.append("\n### References\n" + "\n".join([f"- {c.get('source')} (chunk {c.get('chunk_id')})" for c in top_chunks[:5]]))
    return "\n".join(parts)

def simple_answer_from_retrieval(question: str, retrieved: List[Dict], model: str = "gpt") -> str:
    """
    Given question and retrieved chunks, produce an answer using chosen LLM model.
    model: "gpt" | "llama" | "hybrid"
    """
    if not retrieved:
        return "No relevant content found."
    
    # sort by combined score
    top_chunks = sorted(retrieved, key=lambda x: x.get("score", 0), reverse=True)
    mode = detect_answer_length(question)

    # Build a context block to feed into the LLM when needed
    def build_context(chunks, limit=8):
        ctx = ""
        for i, c in enumerate(chunks[:limit], start=1):
            ctx += f"[{i}] {c.get('text')}\n(Source: {c.get('source')}, chunk {c.get('chunk_id')})\n\n"
        return ctx

    if mode == "short":
        return format_short_answer(question, top_chunks)
    elif mode == "detailed":
        # prepare prompt with top chunks
        context = build_context(top_chunks, limit=6)
        prompt = f"""You are GramSakhi, an AI-powered Voice-Based Governance Assistant.
STRICT RULES:
1. Answer ONLY using the provided "Context" below.
2. NEVER use pretrained knowledge to fill in missing details.
3. NEVER invent any facts.
4. If the context does not contain enough evidence, say exactly: "I could not find sufficient verified information in the available government documents to answer this question."

Context:
{context}

Question: {question}
Detailed Output:"""
        # Use the chosen model
        resp = call_llm(prompt, model=model, max_tokens=600)
        return resp or format_detailed_answer(question, top_chunks)
    else:
        # medium
        context = build_context(top_chunks, limit=4)
        prompt = f"""You are GramSakhi, an AI-powered Voice-Based Governance Assistant.
STRICT RULES:
1. Answer ONLY using the provided "Context" below.
2. NEVER use pretrained knowledge to fill in missing details.
3. NEVER invent any facts.
4. If the context does not contain enough evidence, say exactly: "I could not find sufficient verified information in the available government documents to answer this question."

Context:
{context}

Question: {question}
Output:"""
        resp = call_llm(prompt, model=model, max_tokens=300)
        return resp or format_medium_answer(question, top_chunks)

# --- Summarization helpers ---
def chunk_batches_for_summarize(chunks: List[Dict], approx_chunk_chars=2500):
    batches = []
    current = []
    cur_len = 0
    for c in chunks:
        t = c.get("text","")
        if cur_len + len(t) > approx_chunk_chars and current:
            batches.append(current)
            current = []
            cur_len = 0
        current.append(c)
        cur_len += len(t)
    if current:
        batches.append(current)
    return batches

def long_form_summarize(question: str, top_chunks: List[Dict], max_batch_chars: int = 2500, model: str = "gpt"):
    if not top_chunks:
        return "No content found."

    batches = chunk_batches_for_summarize(top_chunks, approx_chunk_chars=max_batch_chars)
    batch_summaries = []

    for i, batch in enumerate(batches, start=1):
        ctx = "\n\n".join([f"[{j+1}] {c.get('text','')}\n(Source: {c.get('source')}, chunk {c.get('chunk_id')})" for j, c in enumerate(batch)])
        prompt = f"""
You are DocuLex. Create a concise summary of the following passages focused on the question: {question}

Passages:
{ctx}

Output format:
1) Short summary (3-6 bullet points)
2) Key citations (list)
"""
        resp = call_llm(prompt, model=model, max_tokens=500)
        if resp:
            batch_summaries.append(resp)
        else:
            combined = " ".join([c.get("text","") for c in batch])
            sentences = textwrap.wrap(combined, 500)
            batch_summaries.append(" ".join(sentences[:2]))

    # final consolidation
    final_prompt = "You are DocuLex. Consolidate the following batch summaries into a final structured summary answering: {}\n\nSummaries:\n{}\n\nOutput: Provide structured summary with citations.".format(question, "\n\n".join(batch_summaries))

    final_resp = call_llm(final_prompt, model=model, max_tokens=800)
    if final_resp:
        return final_resp

    return "\n\n".join(batch_summaries)

def multi_hop_long_summarize(question: str, top_chunks: List[Dict], batch_chars: int = 2500, model: str = "gpt"):
    if not top_chunks:
        return "No content found."

    batches = chunk_batches_for_summarize(top_chunks, approx_chunk_chars=batch_chars)
    batch_outputs = []

    for i, batch in enumerate(batches, 1):
        ctx = "\n\n".join([f"[{j+1}] {c.get('text','')}\n(Source: {c.get('source')}, chunk {c.get('chunk_id')})" for j,c in enumerate(batch)])
        prompt = f"""You are DocuLex. Summarize the following passages with focus on: {question}

Passages:
{ctx}

Output format:
- Short summary (3-5 bullet points)
- Key supporting citations (source + chunk)
"""
        resp = call_llm(prompt, model=model, max_tokens=500)
        if resp:
            batch_outputs.append(resp)
        else:
            combined = " ".join([c.get("text","") for c in batch])
            batch_outputs.append(combined[:1000])

    consolidated_prompt = f"""You are DocuLex. Consolidate the following {len(batch_outputs)} batch summaries into a single structured summary that directly answers: {question}

Batch summaries:
{chr(10).join([f"Batch {i+1}:{chr(10)}{b}" for i,b in enumerate(batch_outputs)])}

Provide:
1) Executive summary (5-8 bullets)
2) Key evidence (list with citations)
3) Recommendations / conclusions (if applicable)
"""
    final = call_llm(consolidated_prompt, model=model, max_tokens=800)
    if final:
        return final

    return "\n\n".join(batch_outputs)