import asyncio
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app import main
from app.document_store import DocumentStore

store = DocumentStore(index_dir=str(main.INDEX_DIR))

# Print unique sources
sources = set([m.get("source") for m in store.meta if not m.get("deleted")])
print("Unique sources:")
for s in sources:
    print(" -", s)
