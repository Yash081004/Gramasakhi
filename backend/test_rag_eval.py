import asyncio
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app import main
from app.document_store import DocumentStore
from app.retrieval_service import RAG_MIN_HYBRID_SCORE
import json

store = DocumentStore(index_dir=str(main.INDEX_DIR))

# Expanded Evaluation Dataset
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

print("Running Expanded Retrieval Evaluation...\n")

results = []

for category, qs in queries.items():
    print(f"\n=== {category} ===")
    for q in qs:
        hybrid_res = store.search(q, k=10, embed_weight=0.7, bm25_weight=0.3)
        if not hybrid_res:
            print(f"Q: {q} | NO RESULTS")
            continue
            
        best_hybrid = hybrid_res[0].get("score", 0.0)
        
        # Cross encoder manually to get raw scores for threshold finding
        reranked = store.rerank_with_cross_encoder(q, hybrid_res, top_k=5) if hasattr(store, "rerank_with_cross_encoder") else hybrid_res
        best_ce = reranked[0].get("cross_score", 0.0)
        
        source = reranked[0].get("source", "Unknown") if reranked else "Unknown"
        scheme = reranked[0].get("meta", {}).get("scheme_name", "None") if reranked else "None"
        
        # Apply current hybrid gate logic
        decision = "ACCEPT" if best_hybrid >= RAG_MIN_HYBRID_SCORE else "REJECT (HYBRID)"
        
        print(f"Q: {q}")
        print(f"  Expected Class: {category}")
        print(f"  Top Doc: {source} | Top Scheme: {scheme}")
        print(f"  Hybrid Score: {best_hybrid:.4f} | CE Score: {best_ce:.4f}")
        print(f"  Decision: {decision}")
        
print("\n=== Chat Follow-up Test ===")
follow_up = "Who is eligible?"
hybrid_res = store.search(follow_up, k=5, embed_weight=0.7, bm25_weight=0.3)
if hybrid_res:
    print(f"Raw follow-up query: '{follow_up}'")
    for i, c in enumerate(hybrid_res[:3]):
        print(f"  Rank {i+1}: Score={c.get('score',0):.4f}, Source={c.get('source')}, Preview={c.get('text','')[:50]}")
