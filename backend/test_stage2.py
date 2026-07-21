import asyncio
import os
from pathlib import Path
import sys
import uuid

# Ensure backend is in path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import main
from app.main import (
    list_documents, 
    document_details, 
    delete_document, 
    upload_file,
    query_endpoint,
    QueryRequest
)
from app.document_store import DocumentStore
from fastapi import UploadFile, HTTPException

async def run_test():
    print("Running Stage 2 Tests directly on endpoint functions...")
    
    # Initialize store since lifespan event didn't run
    main.store = DocumentStore(index_dir=str(main.INDEX_DIR))
    
    citizen_user = {"id": "citizen-123", "username": "citizen", "is_admin": False}
    admin_user = {"id": "admin-123", "username": "admin", "is_admin": True}
    
    print("\n--- A. Non-admin cannot upload ---")
    try:
        class DummyFile:
            filename = "dummy.pdf"
        await upload_file(file=DummyFile(), current_user=citizen_user)
        print("❌ FAIL: Citizen was able to upload.")
    except HTTPException as e:
        if e.status_code == 403:
            print("✅ PASS: Non-admin blocked from uploading.")
        else:
            print(f"❌ FAIL: Unexpected error {e}")
            
    print("\n--- B. Non-admin cannot delete ---")
    try:
        await delete_document(file_id="dummy-id", current_user=citizen_user)
        print("❌ FAIL: Citizen was able to delete.")
    except HTTPException as e:
        if e.status_code == 403:
            print("✅ PASS: Non-admin blocked from deleting.")
        else:
            print(f"❌ FAIL: Unexpected error {e}")
            
    print("\n--- C. Admin can list global documents ---")
    docs = await list_documents(current_user=admin_user)
    print(f"✅ PASS: Admin listed {len(docs)} documents.")
    
    if docs:
        first_doc_id = docs[0]["file_id"]
        print(f"\n--- D. Admin can inspect global document ({first_doc_id}) ---")
        details = await document_details(file_id=first_doc_id, current_user=admin_user)
        print(f"✅ PASS: Fetched details for {first_doc_id}.")
        print(f"   Pages: {details.get('pages')}")
        print(f"   Scheme: {details.get('scheme_name')}")
        
    print("\n--- E & F. Admin can upload and delete test document ---")
    # create dummy pdf via raw bytes
    pdf_path = "temp_test_doc.pdf"
    raw_pdf = b'''%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>
endobj
4 0 obj
<< /Length 64 >>
stream
BT
/F1 12 Tf
10 700 Td
(This is a super unique string for testing deletion 99887766.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000288 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
403
%%EOF
'''
    with open(pdf_path, "wb") as f:
        f.write(raw_pdf)
    
    with open(pdf_path, "rb") as f:
        # Mocking FastAPI UploadFile
        upload = UploadFile(filename="temp_test_doc.pdf", file=f)
        try:
            res = await upload_file(
                file=upload, 
                scheme_name="Test Scheme", 
                ministry="Test Min", 
                state="Test State", 
                current_user=admin_user
            )
            test_file_id = res["file_id"]
            print(f"✅ PASS: Admin uploaded test document: {test_file_id}")
            
            # Check retrieval before deletion
            q_res = await query_endpoint(QueryRequest(question="testing deletion 99887766"), current_user=citizen_user)
            refs = [r["file_id"] for r in q_res.get("references", [])]
            if test_file_id in refs:
                print("✅ PASS: Test document appears in retrieval.")
            else:
                print("❌ FAIL: Test document NOT found in retrieval.")
                
            # Delete the document
            del_res = await delete_document(file_id=test_file_id, current_user=admin_user)
            print(f"✅ PASS: Admin deleted test document: marked {del_res['chunks_marked_deleted']} chunks.")
            
            # Check retrieval after deletion
            q_res2 = await query_endpoint(QueryRequest(question="testing deletion 99887766"), current_user=citizen_user)
            refs2 = [r["file_id"] for r in q_res2.get("references", [])]
            if test_file_id not in refs2:
                print("✅ PASS: Deleted document no longer appears in retrieval.")
            else:
                print("❌ FAIL: Deleted document STILL appears in retrieval.")
                
        finally:
            f.close()
            
    print("\n--- G. Other government documents remain unaffected ---")
    docs_after = await list_documents(current_user=admin_user)
    if len(docs) == len(docs_after):
        print(f"✅ PASS: Document count remained consistent: {len(docs_after)}")
    else:
        print(f"❌ FAIL: Document count changed from {len(docs)} to {len(docs_after)}")

    print("\n--- H. Page metadata/citations remain correct ---")
    if docs_after:
        q_res3 = await query_endpoint(QueryRequest(question="GramSakhi"), current_user=citizen_user)
        refs = q_res3.get("references", [])
        if refs:
            citation = refs[0].get("citation", "")
            print(f"✅ PASS: Sample citation format: {citation}")
            if "page" in citation:
                print("✅ PASS: Citation includes page number.")
            else:
                print("❌ FAIL: Citation missing page number.")

    if os.path.exists(pdf_path):
        os.remove(pdf_path)

if __name__ == "__main__":
    asyncio.run(run_test())
