import asyncio
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app import main
from app.document_store import DocumentStore
from app.retrieval_service import retrieve_government_context
from app.llm import call_gpt, call_llama
from app.chat_prompt import build_chat_prompt
from app.query_rewriter import rewrite_query_for_retrieval
import json

store = DocumentStore(index_dir=str(main.INDEX_DIR))
model = "llama" # Using local llama to avoid OpenAI rate limits

queries = {
    "1_Supported": [
        "What are the benefits under IT Policy Schemes 2018?",
        "How can I apply for training with new production?",
        "What is the ITSYS Scheme?",
        "Who is eligible for IT Policy 2018?",
        "What is the application procedure for ITSYS scheme?",
        "What is the duration of the IT Saksham Yuva Scheme?",
        "Are there any age limits for the ITSYS scheme?",
        "Can a registered group apply for training with new production?"
    ],
    "2_Ambiguous": [
        "Tell me about government schemes for training.",
        "What IT policies exist in the state?",
        "Can I get funding for a new production?",
        "What support is there for youths?",
        "Are there any allowances provided by the government?"
    ],
    "3_Missing_KB": [
        "What is the PM KISAN Samman Nidhi scheme?",
        "How do I apply for a driver's license in Delhi?",
        "What are the benefits of the Ayushman Bharat scheme?",
        "Who is eligible for the MGNREGA scheme?",
        "Tell me about the National Education Policy 2020."
    ],
    "4_Unsupported": [
        "What is GramSakhi?",
        "Who invented Python?",
        "What is the capital of France?",
        "Explain photosynthesis.",
        "How do I bake a cake?"
    ]
}

def simulate_chat_answer(query: str) -> str:
    # 1. Retrieval
    retrieved = retrieve_government_context(query, store)
    if not retrieved:
        return "I could not find sufficient verified information in the available government documents to answer this question."
        
    # 2. Prompt Builder
    messages = [{"role": "user", "content": query}]
    prompt = build_chat_prompt(messages, retrieved)
    
    # 3. LLM Call
    if "gpt" in model.lower():
        reply = call_gpt(prompt, max_tokens=1000)
    else:
        reply = call_llama(prompt, max_tokens=1000, model=model)
    return reply or "Error"

print("Running Final Stage 3 Evaluation...\n")

missing_kb_failures = 0

for category, qs in queries.items():
    print(f"\n=== {category} ===")
    for q in qs:
        ans = simulate_chat_answer(q)
        ans_preview = ans.replace('\n', ' ')[:100] + "..."
        
        # Determine success
        if category == "3_Missing_KB":
            if "sufficient verified information" in ans or "I'm sorry" in ans or "I could not find" in ans:
                print(f"Q: {q} | [PASS] Refused correctly.")
            else:
                print(f"Q: {q} | [FAIL] LLM tried to answer: {ans_preview}")
                missing_kb_failures += 1
        elif category == "4_Unsupported":
            if "sufficient verified information" in ans:
                print(f"Q: {q} | [PASS] Rejected by thresholds.")
            else:
                print(f"Q: {q} | [FAIL] Answered: {ans_preview}")
        else:
            if "sufficient verified information" in ans:
                print(f"Q: {q} | [REJECTED]")
            else:
                print(f"Q: {q} | [ANSWERED]: {ans_preview}")

print(f"\nMissing KB Failures: {missing_kb_failures}")
if missing_kb_failures > 0:
    print("!!! STOP CONDITION TRIGGERED: LLM hallucinated Missing-KB scheme !!!")
    
print("\n=== Chat Context Tests ===")

# Test A
print("\nTest A: Contextual Rewrite")
hist_A = [
    {"role": "user", "content": "Tell me about IT Policy 2018."},
    {"role": "assistant", "content": "The IT Policy 2018 provides various benefits..."}
]
query_A = "Who is eligible?"
rewritten_A = rewrite_query_for_retrieval(hist_A, query_A, model)
print(f"Original: {query_A} -> Rewritten: {rewritten_A}")

# Test B
print("\nTest B: Contextual Rewrite (Scheme A)")
hist_B = [
    {"role": "user", "content": "Tell me about the ITSYS Scheme."},
    {"role": "assistant", "content": "ITSYS is an IT scheme for youths."}
]
query_B = "What are the benefits?"
rewritten_B = rewrite_query_for_retrieval(hist_B, query_B, model)
print(f"Original: {query_B} -> Rewritten: {rewritten_B}")

# Test C
print("\nTest C: Self-Contained Rewrite")
hist_C = hist_B
query_C = "How do I apply for the ITSYS Scheme?"
rewritten_C = rewrite_query_for_retrieval(hist_C, query_C, model)
print(f"Original: {query_C} -> Rewritten: {rewritten_C}")
