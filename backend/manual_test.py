import asyncio
from app import main
from app.document_store import DocumentStore
from app.retrieval_service import retrieve_government_context
from app.evidence_validator import validate_evidence

store = DocumentStore(index_dir=str(main.INDEX_DIR))
q = "What are the benefits under IT Policy Schemes 2018?"
docs = retrieve_government_context(q, store)
ans = validate_evidence(q, docs, model="llama")
print(f"Supported: {ans}")
