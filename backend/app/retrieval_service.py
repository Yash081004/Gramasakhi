import os
import logging
from typing import List, Dict, Any
from .document_store import DocumentStore

logger = logging.getLogger(__name__)

# Configurable Relevance Thresholds
RAG_MIN_HYBRID_SCORE = float(os.getenv("RAG_MIN_HYBRID_SCORE", "0.35"))
RAG_MIN_CE_SCORE = float(os.getenv("RAG_MIN_CE_SCORE", "-8.0"))

def retrieve_government_context(query: str, store: DocumentStore) -> List[Dict[str, Any]]:
    """
    Unified retrieval pipeline for GramSakhi.
    Ensures that both /query and /chat/message use the exact same retrieval wrapper,
    enforcing relevance thresholds and preventing hallucinations.
    """
    # 1. Hybrid FAISS + BM25 Retrieval
    hybrid_candidates = store.search(
        query,
        k=10,
        embed_weight=0.7,
        bm25_weight=0.3,
        use_mmr=False,
        use_cross_encoder=False
    )
    
    if not hybrid_candidates:
        return []
        
    # 2. Hybrid Relevance Gate
    best_hybrid_score = hybrid_candidates[0].get("score", 0.0)
    if best_hybrid_score < RAG_MIN_HYBRID_SCORE:
        logger.warning(f"Query '{query}' rejected by hybrid threshold. Score: {best_hybrid_score:.4f} < {RAG_MIN_HYBRID_SCORE}")
        return []
        
    # 3. CrossEncoder Reranking, Relevance Validation & 4. MMR Diversity
    final_context = store.rerank_and_mmr(
        candidates=hybrid_candidates,
        query=query,
        top_k=15,
        final_k=8,
        mmr_lambda=0.6,
        min_ce_score=RAG_MIN_CE_SCORE
    )
    
    if not final_context:
        logger.warning(f"Query '{query}' rejected by CE threshold {RAG_MIN_CE_SCORE}.")
        return []
        
    return final_context
