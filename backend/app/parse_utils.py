# app/parse_utils.py
"""
DocuLex PDF Parsing Module (robust)
- Extracts text using PyPDF2
- Falls back to OCR (Tesseract) for scanned PDFs if available
- Returns page-aware, clean, chunked text
"""

from typing import List, Dict, Tuple
import os
import re
import shutil
import PyPDF2

# Optional imports (may fail if system binaries / libs not present)
try:
    from pdf2image import convert_from_path
except Exception:
    convert_from_path = None  # pdf2image not installed or import failed

try:
    import pytesseract
except Exception:
    pytesseract = None  # pytesseract not installed


# -------------------------
# Helpers: binary detection
# -------------------------
def _which_bin(name: str) -> str:
    """Return path to binary if found on PATH, else empty string."""
    p = shutil.which(name)
    return p or ""


def _poppler_available() -> Tuple[bool, str]:
    """
    Check if Poppler (pdftoppm) is available.
    Returns (available, path_to_pdftoppm_or_empty).
    """
    # Allow explicit override via POPPLER_PATH env var (points to folder containing bin)
    env_path = os.getenv("POPPLER_PATH", "").strip()
    if env_path:
        # If user provided folder, look for pdftoppm in that folder or its bin subfolder
        candidates = [env_path, os.path.join(env_path, "bin")]
        for c in candidates:
            exe = os.path.join(c, "pdftoppm.exe" if os.name == "nt" else "pdftoppm")
            if os.path.exists(exe):
                return True, c
    # otherwise detect in PATH
    binpath = _which_bin("pdftoppm")
    if binpath:
        # return directory containing the binary
        return True, os.path.dirname(binpath)
    return False, ""


def _tesseract_available() -> bool:
    """Return True if tesseract binary seems available on PATH (or via TESSERACT_CMD env var)."""
    # allow environment override for tesseract executable
    tess_cmd = os.getenv("TESSERACT_CMD", "").strip()
    if tess_cmd:
        return shutil.which(tess_cmd) is not None
    return bool(_which_bin("tesseract"))


# -------------------------
# 1. Extract text from PDF
# -------------------------
def extract_text_from_pdf(path: str) -> List[Tuple[int, str]]:
    """
    Extract text from PDF page by page.
    Returns list of tuples: [(page_num, text), ...]
    Try PyPDF2 extraction. If no readable text → OCR fallback (only if available).
    """
    pages: List[Tuple[int, str]] = []
    has_text = False

    try:
        with open(path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page_num, page in enumerate(reader.pages):
                try:
                    page_text = page.extract_text() or ""
                except Exception:
                    page_text = ""
                if page_text and page_text.strip():
                    has_text = True
                pages.append((page_num, page_text or ""))
    except Exception as e:
        print(f"⚠ PyPDF2 extraction failed: {e}")
        pages = []
        has_text = False

    # If PyPDF2 produced any non-empty page text, return cleaned pages
    if has_text and any((t and t.strip()) for _, t in pages):
        cleaned = [(pnum, clean_text(text)) for pnum, text in pages]
        print("📄 Using PyPDF2 text extraction")
        return cleaned

    # Otherwise attempt OCR if possible
    print("🔍 No readable text found with PyPDF2 — attempting OCR fallback")
    ocr_pages = ocr_pdf(path)
    if ocr_pages:
        return [(pnum, clean_text(text)) for pnum, text in ocr_pages]
    else:
        # OCR not available or failed: return empty pages list (caller decides)
        print("❌ OCR not available or OCR failed; returning empty content")
        return []


# -------------------------
# 2. OCR fallback (Tesseract)
# -------------------------
def ocr_pdf(path: str) -> List[Tuple[int, str]]:
    """
    Convert each PDF page -> image -> OCR (Tesseract)
    Returns list of tuples: [(page_num, text), ...]
    If prerequisites are missing, returns [] and logs a clear message.
    """
    final_pages: List[Tuple[int, str]] = []

    # Check prerequisites
    poppler_ok, poppler_dir = _poppler_available()
    tesseract_ok = _tesseract_available()

    if convert_from_path is None:
        print("❌ pdf2image is not installed or failed to import. Install pdf2image and Poppler.")
        return []

    if not poppler_ok:
        print("❌ Poppler (pdftoppm) not found on PATH and POPPLER_PATH not set.")
        print("   Install Poppler and add its bin folder to PATH, or set POPPLER_PATH env.")
        return []

    if not tesseract_ok or pytesseract is None:
        print("❌ Tesseract OCR not available (pytesseract not installed or tesseract binary not found).")
        print("   Install Tesseract and add it to PATH, or set TESSERACT_CMD env var.")
        return []

    # Determine poppler_path argument for convert_from_path
    poppler_path_arg = poppler_dir if poppler_dir else None

    try:
        # convert_from_path supports poppler_path parameter on Windows
        if poppler_path_arg:
            images = convert_from_path(path, poppler_path=poppler_path_arg)
        else:
            images = convert_from_path(path)
    except Exception as e:
        print(f"❌ pdf2image.convert_from_path failed: {e}")
        return []

    # Run pytesseract on each image
    for idx, img in enumerate(images):
        try:
            print(f"🖼 OCR page {idx + 1}...")
            # Use TESSERACT_CMD env override if set
            tess_cmd_env = os.getenv("TESSERACT_CMD", "").strip()
            if tess_cmd_env:
                pytesseract.pytesseract.tesseract_cmd = tess_cmd_env
            text = pytesseract.image_to_string(img)
            final_pages.append((idx, text or ""))
        except Exception as e:
            print(f"❌ pytesseract failed on page {idx + 1}: {e}")
            final_pages.append((idx, ""))

    return final_pages


# -------------------------
# 3. Clean extracted text
# -------------------------
def clean_text(text: str) -> str:
    if not text:
        return ""
    # normalize whitespace and remove BOMs
    text = re.sub(r"\s+", " ", text)
    text = text.replace("\ufeff", "")
    return text.strip()


# -------------------------
# 4. Page-aware chunking
# -------------------------
def chunk_text(raw_pages: List[Tuple[int, str]], chunk_size: int = 400, overlap: int = 60) -> List[Dict]:
    """
    Takes page-aware input: [(page_num, text), ...]
    Splits text into overlapping chunks.
    Each chunk contains:
    - text
    - meta: chunk_id, page_num, start, end
    """
    chunks: List[Dict] = []
    cid = 0

    for page_num, page_text in raw_pages:
        # ensure cleaned text
        text = clean_text(page_text)
        if not text:
            continue
        n = len(text)
        start = 0

        while start < n:
            end = min(start + chunk_size, n)
            chunk_body = text[start:end].strip()

            if chunk_body:
                chunks.append({
                    "text": chunk_body,
                    "meta": {
                        "chunk_id": cid,
                        "page_num": page_num,
                        "start": start,
                        "end": end
                    }
                })
                cid += 1

            # advance with overlap
            start += (chunk_size - overlap)

    return chunks
