import asyncio
import os
from pathlib import Path
import sys

# Ensure backend is in path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import main
from app.main import query_endpoint, QueryRequest
from app.document_store import DocumentStore

async def run_test():
    print("Running Stage 1 Test: /query endpoint directly...")
    
    # Initialize store since lifespan event didn't run
    main.store = DocumentStore(index_dir=str(main.INDEX_DIR))
    
    # Fake user
    current_user = {
        "id": "fake-user-123",
        "username": "test_citizen",
        "is_admin": False
    }
    
    req = QueryRequest(
        question="What is GramSakhi?",
        use_mmr=False
    )
    
    try:
        response = await query_endpoint(req, current_user=current_user)
        print("SUCCESS: query_endpoint executed without throwing an error.")
        print(f"Question: {response.get('question')}")
        print(f"Answer snippet: {response.get('answer', '')[:100]}...")
        print(f"References found: {len(response.get('references', []))}")
    except Exception as e:
        print(f"ERROR: query_endpoint failed with exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
