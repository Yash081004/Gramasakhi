import asyncio
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app import main
from app.document_store import DocumentStore
import json

store = DocumentStore(index_dir=str(main.INDEX_DIR))

queries = {
    "1_Supported": [
        "What are the benefits under IT Policy Schemes 2018?",
        "How can I apply for training with new production?",
        "What is the ITSYS Scheme?",
        "Who is eligible for IT Policy 2018?",
        "What is the application procedure for ITSYS scheme?"
    ],
    "2_Ambiguous": [
        "Tell me about government schemes for training.",
        "What IT policies exist in the state?",
        "Can I get funding for a new production?"
    ],
    "3_Unsupported": [
        "What is GramSakhi?",
        "Who invented Python?",
        "What is the capital of France?",
        "Explain photosynthesis.",
        "How do I bake a cake?"
    ],
    "4_Missing": [
        "What is the PM KISAN Samman Nidhi scheme?",
        "How do I apply for a driver's license in Delhi?"
    ]
}

print("Running Retrieval Evaluation...\n")

results = []

for category, qs in queries.items():
    print(f"=== {category} ===")
    for q in qs:
        # Get hybrid search results
        hybrid_res = store.search(q, k=8, embed_weight=0.7, bm25_weight=0.3)
        if not hybrid_res:
            print(f"Q: {q}\n  NO RESULTS\n")
            continue
            
        # Run cross-encoder on top candidates
        reranked = store.rerank_with_cross_encoder(q, hybrid_res, top_k=5)
        
        best = reranked[0] if reranked else hybrid_res[0]
        hybrid_score = best.get("score", 0.0)
        ce_score = best.get("cross_score", 0.0) # Fixed key
        source = best.get("source", "Unknown")
        
        print(f"Q: {q}")
        print(f"  Best Source: {source}")
        print(f"  Hybrid Score: {hybrid_score:.4f}")
        print(f"  CE Score: {ce_score:.4f}")
        print(f"  Preview: {best.get('text', '')[:100].replace(chr(10), ' ')}")
        print()
