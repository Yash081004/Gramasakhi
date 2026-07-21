# app/document_store.py
import os
import pickle
import hashlib
from typing import List, Dict, Any
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer, CrossEncoder
from rank_bm25 import BM25Okapi


class DocumentStore:
    def __init__(
        self,
        index_dir="indexes",
        embed_model_name="multi-qa-mpnet-base-dot-v1",
        cross_encoder_name="cross-encoder/ms-marco-MiniLM-L-6-v2",
    ):
        os.makedirs(index_dir, exist_ok=True)
        self.index_dir = index_dir
        self.index_path = os.path.join(index_dir, "faiss.index")
        self.meta_path = os.path.join(index_dir, "meta.pkl")
        # sentence-transformers and optionally cross-encoder
        self.embed_model = SentenceTransformer(embed_model_name)
        try:
            self.cross_encoder = CrossEncoder(cross_encoder_name)
            print(f"✅ Embed model loaded: {embed_model_name}")
        except Exception as e:
            # cross-encoder optional — don't crash if not installed
            print("❌ Failed to load embedding model:", e)
            raise
        self.dimension = self.embed_model.get_sentence_embedding_dimension()
        self._load_or_init()
        self._embed_cache = self._load_embedding_cache()
        self._build_bm25_from_meta()

    def _load_or_init(self):
        if os.path.exists(self.index_path) and os.path.exists(self.meta_path):
            try:
                idx = faiss.read_index(self.index_path)
                if idx.d != self.dimension:
                    print(
                        f"⚠ FAISS dim mismatch (found {idx.d}, expected {self.dimension}) -> reinit"
                    )
                    self.index = faiss.IndexFlatIP(self.dimension)
                    self.meta = []
                else:
                    self.index = idx
                    with open(self.meta_path, "rb") as f:
                        self.meta = pickle.load(f)
                    print(
                        f"✅ Loaded FAISS index with {self.index.ntotal} vectors (dim {self.dimension})."
                    )
                    return
            except Exception as e:
                print("⚠ Failed to load FAISS/meta, reinitializing:", e)
        self.index = faiss.IndexFlatIP(self.dimension)
        self.meta = []
        print(f"🆕 Initialized new FAISS index (dim {self.dimension}).")

    def _persist(self):
        try:
            faiss.write_index(self.index, self.index_path)
            with open(self.meta_path, "wb") as f:
                pickle.dump(self.meta, f)
        except Exception as e:
            print("⚠ Failed to persist index/meta:", e)

    def _build_bm25_from_meta(self):
        texts = [m.get("text", "") for m in self.meta if not m.get("deleted", False)]
        tokenized = [self._tokenize(t) for t in texts] if texts else []
        self.bm25 = BM25Okapi(tokenized) if tokenized else None
        self._bm25_corpus = texts

    # ---------- Embedding cache helpers ----------
    def _embedding_cache_path(self):
        return os.path.join(self.index_dir, "embed_cache.pkl")

    def _load_embedding_cache(self):
        path = self._embedding_cache_path()
        if os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    return pickle.load(f)
            except Exception:
                return {}
        return {}

    def _save_embedding_cache(self):
        path = self._embedding_cache_path()
        try:
            with open(path, "wb") as f:
                pickle.dump(self._embed_cache, f)
        except Exception as e:
            print("⚠ Failed to persist embed cache:", e)

    def _text_hash(self, text: str):
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def _encode_texts_with_cache(self, texts: List[str]):
        """
        Returns numpy array of embeddings (normalized) using cache where possible.
        """
        to_encode = []
        to_encode_idx = []
        results = [None] * len(texts)

        for i, t in enumerate(texts):
            h = self._text_hash(t)
            if h in self._embed_cache:
                results[i] = np.array(self._embed_cache[h], dtype="float32")
            else:
                to_encode.append(t)
                to_encode_idx.append(i)

        if to_encode:
            embs = self.embed_model.encode(to_encode, convert_to_numpy=True, show_progress_bar=False)
            # normalize
            norms = np.linalg.norm(embs, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            embs = (embs / norms).astype("float32")

            for j, idx in enumerate(to_encode_idx):
                vec = embs[j].tolist()
                results[idx] = np.array(vec, dtype="float32")
                # save into cache
                self._embed_cache[self._text_hash(texts[idx])] = vec

            # persist cache asynchronously (quick save)
            try:
                self._save_embedding_cache()
            except Exception:
                pass

        return np.stack(results, axis=0)

    def _tokenize(self, text: str):
        # simple whitespace split and lowercase
        return [t.strip().lower() for t in text.replace("\n", " ").split() if t.strip()]

    def add_documents(self, docs: List[Dict], source_name: str):
        """
        docs: list of {"text": "...", "meta": {...}} where meta may include page, chunk_id, file_id, user_id
        """
        if not docs:
            return
        texts = [d["text"] for d in docs]
        embeddings = self._encode_texts_with_cache(texts)
        
        if embeddings.shape[1] != self.dimension:
            print("❌ Embedding dim mismatch -> rebuilding index")
            self.index = faiss.IndexFlatIP(self.dimension)
            self.meta = []

        self.index.add(embeddings)
        for d in docs:
            meta = d.get("meta", {}).copy()
            meta.update({"source": source_name, "text": d["text"]})
            # ensure deleted flag exists if omitted
            if "deleted" not in meta:
                meta["deleted"] = False
            self.meta.append(meta)

        self._persist()
        self._build_bm25_from_meta()
        print(f"✅ Added {len(docs)} chunks from {source_name} to index.")

    def _bm25_scores_for_query(self, query: str) -> List[float]:
        if not self.bm25:
            return [0.0] * len(self.meta)
        q_tok = self._tokenize(query)
        scores = self.bm25.get_scores(q_tok)  # numpy array
        if scores.size == 0:
            return [0.0] * len(self.meta)
        min_s, max_s = float(scores.min()), float(scores.max())
        if max_s - min_s < 1e-8:
            norm = [0.0 if max_s == 0 else 1.0 for _ in scores]
        else:
            norm = [float((s - min_s) / (max_s - min_s)) for s in scores]
        # NOTE: self.bm25.corpus order corresponds to non-deleted meta texts; we'll map back by index in meta when needed
        # But to keep it simple we built BM25 from non-deleted meta only. For indexing alignment, we will return
        # a list sized to len(self.meta) and put 0 for deleted entries.
        full_norm = []
        bm25_texts = self._bm25_corpus or []
        # create mapping: for each meta entry, if not deleted, consume next bm25 score, else 0
        j = 0
        for m in self.meta:
            if m.get("deleted", False):
                full_norm.append(0.0)
            else:
                if j < len(norm):
                    full_norm.append(norm[j])
                else:
                    full_norm.append(0.0)
                j += 1
        return full_norm

    def rerank_with_cross_encoder(self, query: str, results: List[Dict], top_k: int = 5):
        """
        Cross-Encoder Reranking — VERY ACCURATE (optional, requires CrossEncoder)
        """
        if not results:
            return []
        if not self.cross_encoder:
            return results[:top_k]
        pairs = [(query, r["text"]) for r in results]
        try:
            scores = self.cross_encoder.predict(pairs)
        except Exception:
            # if cross-encoder fails, return original ordering
            return results[:top_k]
        for r, s in zip(results, scores):
            r["cross_score"] = float(s)
        results = sorted(results, key=lambda x: x.get("cross_score", 0.0), reverse=True)
        return results[:top_k]

    # ---------- MMR function ----------
    def mmr_select(self, candidate_embeddings: np.ndarray, candidate_texts: List[Dict], query_embedding: np.ndarray, top_k: int = 5, lambda_param: float = 0.6):
        """
        Simple MMR selection for diversity in results.
        candidate_embeddings: np.array shape (N, dim)
        candidate_texts: list of candidate meta dicts length N
        query_embedding: np.array shape (dim,)
        returns list of selected meta dicts (length <= top_k)
        """
        if len(candidate_texts) <= top_k:
            return candidate_texts

        selected = []
        selected_idxs = []
        # compute similarity to query
        # candidate_embeddings already normalized
        qv = query_embedding.reshape(-1)
        sims = (candidate_embeddings @ qv).tolist()  # dot product
        remaining = set(range(len(candidate_texts)))

        # pick best by similarity first
        first = int(np.argmax(sims))
        selected.append(candidate_texts[first])
        selected_idxs.append(first)
        remaining.remove(first)

        while len(selected) < top_k and remaining:
            mmr_scores = {}
            for idx in list(remaining):
                sim_to_query = sims[idx]
                sim_to_selected = 0.0
                # compute max similarity to any selected
                for sidx in selected_idxs:
                    sim = float(candidate_embeddings[idx].dot(candidate_embeddings[sidx]))
                    if sim > sim_to_selected:
                        sim_to_selected = sim
                mmr_score = lambda_param * sim_to_query - (1 - lambda_param) * sim_to_selected
                mmr_scores[idx] = mmr_score
            # select max mmr
            next_idx = max(mmr_scores.items(), key=lambda x: x[1])[0]
            selected.append(candidate_texts[next_idx])
            selected_idxs.append(next_idx)
            remaining.remove(next_idx)

        return selected

    # ---------- Combined Rerank + MMR Helper ----------
    def rerank_and_mmr(self, candidates: List[Dict[str, Any]], query: str, 
                       cross_encoder=None, top_k: int = 50, final_k: int = 10, 
                       mmr_lambda: float = 0.7, min_ce_score: float = None) -> List[Dict[str, Any]]:
        """
        Combined Cross-encoder reranking + MMR for diversity.
        
        candidates: list of dicts with at least keys: 'text', 'score', 'file_id', 'page', 'chunk_id'
        cross_encoder: a CrossEncoder instance (uses self.cross_encoder if None)
        top_k: number of top candidates to consider for rerank
        final_k: how many results to return after MMR
        mmr_lambda: tradeoff parameter (0 => relevance only, 1 => diversity only)
        """
        if not candidates:
            return []
        
        # Use class cross_encoder if not specified
        if cross_encoder is None:
            cross_encoder = self.cross_encoder
        
        # 1) sort by original score and trim
        candidates = sorted(candidates, key=lambda x: x.get("score", 0), reverse=True)[:top_k]

        # 2) Cross-encoder reranking (if available)
        if cross_encoder is not None:
            pairs = [[query, c["text"]] for c in candidates]
            try:
                ce_scores = cross_encoder.predict(pairs)  # higher => more relevant
                for c, s in zip(candidates, ce_scores):
                    c["_rerank_score"] = float(s)
            except Exception as e:
                # fallback: leave as-is and log
                print("⚠ Cross-encoder failed:", e)
                for c in candidates:
                    c["_rerank_score"] = c.get("score", 0)
        else:
            for c in candidates:
                c["_rerank_score"] = c.get("score", 0)

        # 2.5) Filter by min_ce_score if provided
        if min_ce_score is not None:
            filtered_candidates = [c for c in candidates if c.get("_rerank_score", 0) >= min_ce_score]
            # If all candidates fail the CE threshold, return empty
            if not filtered_candidates:
                return []
            candidates = filtered_candidates

        # normalize rerank scores to numpy array
        scores = np.array([c["_rerank_score"] for c in candidates], dtype=float)
        if scores.max() - scores.min() > 0:
            scores = (scores - scores.min()) / (scores.max() - scores.min())
        else:
            scores = np.ones_like(scores)

        # 3) MMR selection over the reranked set
        # compute embeddings for candidate texts
        texts = [c["text"] for c in candidates]
        try:
            # Use the cache-based encoding method
            emb = self._encode_texts_with_cache(texts)  # shape (N, D)
            # Normalize embeddings
            emb = emb / (np.linalg.norm(emb, axis=1, keepdims=True) + 1e-12)
        except Exception as e:
            print("⚠ Embedding for MMR failed:", e)
            # if embedding not available, return top by rerank
            candidates_sorted = sorted(candidates, key=lambda x: x.get("_rerank_score", 0), reverse=True)
            return candidates_sorted[:final_k]

        # pairwise similarities
        sim_matrix = np.dot(emb, emb.T)

        selected = []
        selected_idx = []

        # Select the first candidate with highest relevance score
        idx = int(np.argmax(scores))
        selected_idx.append(idx)
        selected.append(candidates[idx])

        # Greedy MMR
        while len(selected_idx) < min(final_k, len(candidates)):
            mmr_scores = []
            for i in range(len(candidates)):
                if i in selected_idx:
                    mmr_scores.append(-np.inf)
                    continue
                relevance = scores[i]
                diversity = max(sim_matrix[i, selected_idx]) if selected_idx else 0.0
                mmr_score = mmr_lambda * relevance - (1 - mmr_lambda) * diversity
                mmr_scores.append(mmr_score)
            next_idx = int(np.argmax(mmr_scores))
            selected_idx.append(next_idx)
            selected.append(candidates[next_idx])

        # 4) Ensure metadata consistency + build citation string
        out = []
        for c in selected:
            meta = c.get("meta", {})
            file_id = c.get("file_id") or meta.get("file_id") or meta.get("source") or "unknown"
            page_num = meta.get("page_num", 0)
            chunk_id = c.get("chunk_id") or meta.get("chunk_id") or meta.get("id")
            scheme_name = meta.get("scheme_name")
            ministry = meta.get("ministry")
            
            if scheme_name:
                citation = f"{scheme_name}"
                if ministry:
                    citation += f" ({ministry})"
                citation += f" - {file_id}"
            else:
                citation = f"{file_id}"
                
            citation += f" - page {page_num + 1}"
            if chunk_id is not None:
                citation += f" (chunk {chunk_id})"

            out.append({
                "text": c["text"],
                "score": float(c.get("_rerank_score", c.get("score", 0))),
                "file_id": file_id,
                "page": page_num,
                "chunk_id": chunk_id,
                "citation": citation,
                "meta": meta,
                "id": c.get("id")
            })
        return out

    def search(
        self,
        query: str,
        k: int = 5,
        embed_weight: float = 0.7,
        bm25_weight: float = 0.3,
        use_cross_encoder: bool = False,
        cross_encoder_top_k: int = 5,
        user_id: str = None,
        use_mmr: bool = False,
        mmr_k: int = 5,
        mmr_lambda: float = 0.6,
    ) -> List[Dict]:
        """
        Hybrid search with optional user filter.
        Returns list of meta dicts containing: id, text, source, chunk_id, embed_score, bm25_score, score, citation, page (if available)
        """
        if self.index.ntotal == 0:
            return []

        # Build list of valid indices (not deleted and matching user_id if provided)
        valid_indices = [i for i, m in enumerate(self.meta) if not m.get("deleted", False) and (user_id is None or m.get("user_id") == user_id)]
        if not valid_indices:
            return []

        # Embedding search: retrieve more candidates and then filter by valid_indices
        q_emb = self.embed_model.encode([query], convert_to_numpy=True)
        q_emb = q_emb / (np.linalg.norm(q_emb, axis=1, keepdims=True) + 1e-12)
        q_emb = q_emb.astype("float32")

        # ask FAISS for k*5 candidates to allow filtering
        search_k = max(k * 5, 10)
        D, I = self.index.search(q_emb, search_k)
        embed_scores = D[0].tolist()
        indices = I[0].tolist()

        bm25_norm = self._bm25_scores_for_query(query)  # len == len(self.meta)

        results = []
        for es, idx in zip(embed_scores, indices):
            if idx < 0 or idx >= len(self.meta):
                continue
            if idx not in valid_indices:
                continue
            bm = float(bm25_norm[idx]) if bm25_norm else 0.0
            final = embed_weight * float(es) + bm25_weight * float(bm)
            m = self.meta[idx].copy()
            m.update({
                "embed_score": float(es),
                "bm25_score": float(bm),
                "score": float(final),
                "id": int(idx),
            })
            # add a human-readable citation
            page_num = m.get("page_num", 0)
            chunk_id = m.get("chunk_id")
            scheme = m.get("scheme_name")
            source_file = m.get('source','?')
            if scheme:
                m["citation"] = f"{scheme} - {source_file} (chunk {chunk_id}, page {page_num + 1})"
            else:
                m["citation"] = f"{source_file} (chunk {chunk_id}, page {page_num + 1})"
            results.append(m)

        # also consider missing top BM25-only results (so small definition chunks not present in embed top-k are included)
        if self.bm25:
            # get BM25 ranking across all meta entries
            bm25_scores_full = np.array(bm25_norm)
            # rank indices by bm25 score desc
            bm25_rank = np.argsort(-bm25_scores_full).tolist()
            added = {r["id"] for r in results}
            for idx in bm25_rank:
                if idx in added:
                    continue
                if idx not in valid_indices:
                    continue
                bm = float(bm25_scores_full[idx])
                final = embed_weight * 0.0 + bm25_weight * bm
                m = self.meta[idx].copy()
                m.update({
                    "embed_score": 0.0,
                    "bm25_score": bm,
                    "score": float(final),
                    "id": int(idx),
                })
                page_num = m.get("page_num", 0)
                chunk_id = m.get("chunk_id")
                scheme = m.get("scheme_name")
                source_file = m.get('source','?')
                if scheme:
                    m["citation"] = f"{scheme} - {source_file} (chunk {chunk_id}, page {page_num + 1})"
                else:
                    m["citation"] = f"{source_file} (chunk {chunk_id}, page {page_num + 1})"
                results.append(m)
                added.add(idx)
                # stop adding once we have a good buffer
                if len(added) >= k * 3:
                    break

        # At this point `results` is a candidate pool (hybrid scored by ANN + BM25).
        # Use the new combined rerank + MMR approach for better results
        if use_cross_encoder and use_mmr:
            try:
                # Use combined rerank + MMR with optimized parameters
                reranked_results = self.rerank_and_mmr(
                    results, 
                    query, 
                    cross_encoder=self.cross_encoder, 
                    top_k=min(50, len(results)),  # Limit for performance
                    final_k=k, 
                    mmr_lambda=mmr_lambda
                )
                return reranked_results
            except Exception as e:
                print("⚠ Combined rerank+MMR failed, falling back to standard approach:", e)
                # Fall back to original approach
                pass
        
        # Original fallback approach if combined method fails or not requested
        # Stage 1: Cross-encoder reranking on top candidates (for relevance)
        # Only run on a subset (e.g., top 20) to keep cost reasonable
        if use_cross_encoder and results:
            top_for_ce = min(20, len(results))  # rerank top 20
            top_results = results[:top_for_ce]
            rest_results = results[top_for_ce:]
            # Rerank top candidates by cross-encoder
            reranked_top = self.rerank_with_cross_encoder(query, top_results, top_for_ce)
            # Combine: reranked top + remaining
            results = reranked_top + rest_results
        
        # Stage 2: MMR selection for diversity (on the full scored set, but limit final k)
        if use_mmr and results:
            try:
                # Compute embeddings for candidates (use cache where possible)
                texts = [r.get("text", "") for r in results]
                cand_embs = self._encode_texts_with_cache(texts)
                # Query embedding (already computed above as q_emb)
                qvec = q_emb.reshape(-1)
                # Select with MMR to pick k diverse items
                sel_k = min(mmr_k, k, len(results))
                selected = self.mmr_select(cand_embs, results, qvec, top_k=sel_k, lambda_param=mmr_lambda)
                results = selected
            except Exception as e:
                # if MMR fails, fall back to score-based ranking
                print("⚠ MMR selection failed:", e)
                results = results[:k]
        else:
            # If no MMR, just limit to k results
            results = results[:k]
        for r in results:
            meta = r.get("meta", {})
            file_id = r.get("file_id") or meta.get("file_id") or meta.get("source") or "unknown"
            page_num = meta.get("page_num", 0)
            chunk = meta.get("chunk_id") or meta.get("id") or 0
            scheme = meta.get("scheme_name")
            if scheme:
                r["citation"] = f"{scheme} - {file_id} - page {page_num + 1} (chunk {chunk})"
            else:
                r["citation"] = f"{file_id} - page {page_num + 1} (chunk {chunk})"


        return results

    def rebuild_index_from_meta(self, reencode: bool = True):
        """
        Rebuild FAISS index from non-deleted metadata entries.

        Args:
          reencode (bool): if True, (re)encode texts to produce fresh embeddings.
                           If False, expects existing embeddings in meta['embed'] or similar.
        """
        print("🛠 Rebuilding FAISS index from metadata...")

        # Collect non-deleted docs (and keep ordering)
        entries = [m for m in self.meta if not m.get("deleted", False)]

        if not entries:
            # Reset to empty index
            try:
                self.index = faiss.IndexFlatIP(self.dimension)
            except Exception:
                self.index = None
            self._persist()
            self._build_bm25_from_meta()
            return {"status": "empty", "count": 0}

        # Extract texts in the same order we'll add to FAISS
        texts = [m.get("text", "") for m in entries]

        # If you have cached embeddings in metadata, you could reuse them:
        if not reencode:
            try:
                embs = []
                for m in entries:
                    e = m.get("embedding") or m.get("embed_vector") or m.get("embed")
                    if e is None:
                        raise RuntimeError("Missing embedding in metadata; reencode required")
                    embs.append(np.array(e, dtype="float32"))
                embs = np.vstack(embs)
            except Exception as e:
                print("⚠ Failed to reuse embeddings:", e)
                # fallback to reencoding
                reencode = True

        if reencode:
            # Use your embed model to encode texts (assumes returns numpy array)
            print("🔁 Encoding texts to embeddings (this may take a while)...")
            embs = self._encode_texts_with_cache(texts)  # should return numpy array shape (N, dim)
            # ensure float32
            embs = np.asarray(embs, dtype="float32")

        # Build a fresh FAISS index
        try:
            print("🔧 Building new FAISS IndexFlatIP (in-memory)")
            new_index = faiss.IndexFlatIP(self.dimension)
            new_index.add(embs)
            self.index = new_index
        except Exception as e:
            print("⚠ Faiss not available or failed to build index:", e)
            # fallback: keep old index if any, and return failure
            return {"status": "failed", "error": str(e)}

        # Rebuild internal id mapping if you store ids separately — keep meta ordering consistent
        # Optionally update meta with new 'id' sequence to match faiss index positions
        for i, m in enumerate(entries):
            m["id"] = i

        # Persist index and metadata
        try:
            self._persist()
            # Rebuild BM25 corpus (so deleted chunks excluded)
            self._build_bm25_from_meta()
        except Exception as e:
            print("⚠ Persisting rebuilt index failed:", e)
            return {"status": "partial", "error": str(e)}

        print(f"✅ Rebuilt FAISS index with {len(entries)} vectors")
        return {"status": "ok", "count": len(entries)}