# app/main.py — DocuLex Backend (complete with all improvements)
import os
import logging
from dotenv import load_dotenv
from pathlib import Path

# Load env explicitly from backend folder BEFORE importing modules that read env
ENV_PATH = str(Path(__file__).resolve().parent.parent / ".env")
print("Loading .env at:", ENV_PATH)
load_dotenv(ENV_PATH, override=True)

# Now import the rest (safe to import modules that depend on env)
import shutil
import uuid
import numpy as np
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Depends, Body, Request, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator
import uvicorn
import random
import time
import asyncio
from io import BytesIO
import re
import psutil
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi.responses import Response

# Import local modules
from .parse_utils import extract_text_from_pdf, clean_text, chunk_text
from .document_store import DocumentStore
from .llm import simple_answer_from_retrieval, call_gpt, call_llama, _get_openai_key, _get_llama_url, _get_llama_model
from .agents import summarize_agent, compare_agent, report_agent
from .export_pdf import export_pdf, export_pdf_structured
from .export_docx import export_docx, export_docx_structured
from .auth import create_user, authenticate_user, create_token, decode_token, get_current_user, pwd, _load_users, _save_users
from .chat import get_sessions, create_session, chat_message, load_sessions, save_sessions
from .chat_prompt import build_chat_prompt
from .retrieval_service import retrieve_government_context
from .evidence_validator import validate_evidence
from .query_rewriter import rewrite_query_for_retrieval

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('doculex.log')
    ]
)
logger = logging.getLogger(__name__)

# Rate limit state (in-memory with persistence to file)
_OTP_REQS_BY_USER = {}  # username -> list of timestamps (seconds)
_OTP_REQS_BY_IP = {}    # ip -> list of timestamps (seconds)
_RATE_LIMIT_FILE = Path(__file__).parent / "rate_limit_data.json"

# Configurable limits from environment
OTP_LIMIT_PER_USER_PER_HOUR = int(os.getenv("OTP_LIMIT_USER_PER_HOUR", "3"))
OTP_LIMIT_PER_IP_PER_HOUR = int(os.getenv("OTP_LIMIT_IP_PER_HOUR", "10"))
OTP_MIN_SECONDS_BETWEEN = int(os.getenv("OTP_MIN_SECONDS_BETWEEN", "30"))
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50"))
MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024

# ------------------------------------------------------------
# Paths and Directories
# ------------------------------------------------------------

APP_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = APP_DIR / "uploads"
EXPORT_DIR = APP_DIR / "exports"
INDEX_DIR = APP_DIR / "indexes"
LOGS_DIR = APP_DIR / "logs"

# Create necessary directories
for dir_path in [UPLOAD_DIR, EXPORT_DIR, INDEX_DIR, LOGS_DIR]:
    dir_path.mkdir(exist_ok=True)

# Read relevant envs for diagnostics
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
LLAMA_API_URL = os.getenv("LLAMA_API_URL", "")
LLAMA_MODEL = os.getenv("LLAMA_MODEL", "llama")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama")
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")

# Critical startup check
if not OPENAI_API_KEY and not LLAMA_API_URL:
    logger.warning("CRITICAL: Neither OPENAI_API_KEY nor LLAMA_API_URL is configured!")
    logger.warning("LLM functionality will be limited or unavailable.")

print("==== DocuLex startup ====")
print(f"OPENAI_API_KEY present: {bool(OPENAI_API_KEY)}")
print(f"LLAMA_API_URL present: {bool(LLAMA_API_URL)} -> {LLAMA_API_URL}")
print(f"LLAMA_MODEL: {LLAMA_MODEL}")
print(f"DEFAULT_MODEL: {DEFAULT_MODEL}")
print(f"Max upload size: {MAX_UPLOAD_SIZE_MB}MB")
print("=========================")

# ------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------

def clean_for_json(obj):
    """Convert numpy types to Python types for JSON serialization."""
    if isinstance(obj, (np.int32, np.int64, np.integer)):
        return int(obj)
    if isinstance(obj, (np.float32, np.float64, np.floating)):
        return float(obj)
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_for_json(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

def highlight_query(text: str, query: str) -> str:
    """Highlight the first occurrence of query in text."""
    if not query or not text:
        return text
    q = query.lower()
    t = text
    tl = t.lower()
    idx = tl.find(q)
    if idx == -1:
        return t
    start = idx
    end = start + len(q)
    return t[:start] + "[[" + t[start:end] + "]]" + t[end:]

def get_safe_model(model_param: Optional[str]) -> str:
    """Safely determine which model to use with fallbacks."""
    model = (model_param or "").strip().lower()
    
    if not model:
        model = DEFAULT_MODEL.strip().lower()
    
    # Validate model is available
    available_models = []
    if OPENAI_API_KEY:
        available_models.extend(["gpt-4", "gpt-3.5-turbo", "gpt"])
    if LLAMA_API_URL:
        available_models.extend(["llama", "llama2", "llama3", LLAMA_MODEL.lower()])
    
    # Remove duplicates and ensure lowercase
    available_models = list(set([m.lower() for m in available_models]))
    
    # Check if requested model is available
    if model not in available_models:
        # Try to find a similar model
        for avail_model in available_models:
            if model in avail_model or avail_model in model:
                model = avail_model
                break
        else:
            # No similar model found, use first available
            if available_models:
                model = available_models[0]
                logger.warning(f"Model {model_param} not available, falling back to {model}")
            else:
                raise HTTPException(
                    status_code=503,
                    detail="No LLM models configured. Please check environment variables."
                )
    
    return model

def validate_file_size(file_content: bytes) -> bool:
    """Validate file size against maximum limit."""
    return len(file_content) <= MAX_UPLOAD_SIZE

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal attacks."""
    filename = os.path.basename(filename)
    filename = re.sub(r'[^\w\-. ]', '', filename)
    return filename[:255]  # Limit length

# ------------------------------------------------------------
# Pydantic Models with Validation
# ------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    use_mmr: bool = False
    model: Optional[str] = None
    
    @validator('question')
    def validate_question(cls, v):
        v = re.sub(r'\s+', ' ', v).strip()
        if len(v) < 2:
            raise ValueError('Question too short')
        return v

class SummarizeReq(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    use_mmr: bool = False
    model: Optional[str] = None

class CompareReq(BaseModel):
    doc_ids: List[str] = Field(..., min_items=2, max_items=10)
    question: Optional[str] = Field(None, max_length=500)
    use_mmr: bool = False
    model: Optional[str] = None

class ReportReq(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    use_mmr: bool = False
    model: Optional[str] = None

class ExportReq(BaseModel):
    content: str = Field(..., min_length=1)
    filename: str = Field("DocuLex_Report", max_length=100)

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern='^[a-zA-Z0-9_]+$')  # Fixed: regex= → pattern=
    password: str = Field(..., min_length=8)
    email: str = Field(..., pattern=r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')  # Fixed: regex= → pattern=
    full_name: Optional[str] = Field("", max_length=100)

class ChatMessageInput(BaseModel):
    session_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=2000)
    model: Optional[str] = None

class OTPRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)

class OTPVerify(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    otp: int = Field(..., ge=100000, le=999999)

class ResetPassword(BaseModel):
    new_password: str = Field(..., min_length=8)
    token: str

class RenameSessionRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)

# ------------------------------------------------------------
# Application Lifespan Management
# ------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("DocuLex Backend starting up...")
    
    # Initialize Document Store
    global store
    store = DocumentStore(index_dir=str(INDEX_DIR))
    logger.info(f"Document store initialized with {len(store.meta)} chunks")
    
    # Load rate limit data if exists
    if _RATE_LIMIT_FILE.exists():
        try:
            import json
            with open(_RATE_LIMIT_FILE, 'r') as f:
                data = json.load(f)
                global _OTP_REQS_BY_USER, _OTP_REQS_BY_IP
                _OTP_REQS_BY_USER = data.get('by_user', {})
                _OTP_REQS_BY_IP = data.get('by_ip', {})
            logger.info("Loaded rate limit data from disk")
        except Exception as e:
            logger.error(f"Failed to load rate limit data: {e}")
    
    yield
    
    # Shutdown
    logger.info("DocuLex Backend shutting down...")
    
    # Save rate limit data
    try:
        import json
        with open(_RATE_LIMIT_FILE, 'w') as f:
            json.dump({
                'by_user': _OTP_REQS_BY_USER,
                'by_ip': _OTP_REQS_BY_IP
            }, f)
        logger.info(" Saved rate limit data to disk")
    except Exception as e:
        logger.error(f"Failed to save rate limit data: {e}")

# ------------------------------------------------------------
# FastAPI App
# ------------------------------------------------------------

app = FastAPI(
    title="DocuLex API",
    version="2.1",
    description="Document Intelligence and RAG System",
    lifespan=lifespan
)

# CORS middleware
ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "")
if ALLOWED_ORIGINS_ENV:
    ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS_ENV.split(",") if o.strip()]
else:
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# GZip middleware for compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ------------------------------------------------------------
# Rate Limiting Functions
# ------------------------------------------------------------

def check_rate_limit(user_key: str, ip_key: str, request_time: int) -> bool:
    """Check if request is within rate limits."""
    global _OTP_REQS_BY_USER, _OTP_REQS_BY_IP
    
    # Helper to prune old entries
    def _prune(lst, cutoff):
        return [t for t in lst if t >= cutoff]
    
    cutoff = request_time - 3600  # 1 hour ago
    
    # Check per-user rate
    user_list = _OTP_REQS_BY_USER.get(user_key, [])
    user_list = _prune(user_list, cutoff)
    
    if user_list:
        # Minimum spacing check
        if request_time - user_list[-1] < OTP_MIN_SECONDS_BETWEEN:
            return False
        if len(user_list) >= OTP_LIMIT_PER_USER_PER_HOUR:
            return False
    
    # Check per-IP rate
    ip_list = _OTP_REQS_BY_IP.get(ip_key, [])
    ip_list = _prune(ip_list, cutoff)
    
    if len(ip_list) >= OTP_LIMIT_PER_IP_PER_HOUR:
        return False
    
    return True

def record_request(user_key: str, ip_key: str, request_time: int):
    """Record a successful request."""
    global _OTP_REQS_BY_USER, _OTP_REQS_BY_IP
    
    if user_key not in _OTP_REQS_BY_USER:
        _OTP_REQS_BY_USER[user_key] = []
    _OTP_REQS_BY_USER[user_key].append(request_time)
    
    if ip_key not in _OTP_REQS_BY_IP:
        _OTP_REQS_BY_IP[ip_key] = []
    _OTP_REQS_BY_IP[ip_key].append(request_time)

# ------------------------------------------------------------
# Health & Root Endpoints
# ------------------------------------------------------------

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "DocuLex API",
        "version": "2.1",
        "status": "operational",
        "documentation": "/docs",
        "health": "/health",
        "openapi_schema": "/openapi.json"
    }

@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint."""
    try:
        # Check disk space
        disk_usage = psutil.disk_usage('/')
        
        # Check memory
        memory = psutil.virtual_memory()
        
        # Check process
        process = psutil.Process()
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "system": {
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": memory.percent,
                "disk_free_percent": disk_usage.free / disk_usage.total * 100,
                "disk_free_gb": disk_usage.free / (1024**3),
            },
            "process": {
                "memory_mb": process.memory_info().rss / (1024**2),
                "cpu_percent": process.cpu_percent(),
                "threads": process.num_threads(),
            },
            "api": {
                "models_configured": bool(OPENAI_API_KEY or LLAMA_API_URL),
                "openai_configured": bool(OPENAI_API_KEY),
                "llama_configured": bool(LLAMA_API_URL),
                "default_model": DEFAULT_MODEL,
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}

@app.get("/health/llms")
async def health_check_llms():
    """Detailed LLM connectivity check."""
    results = {
        "openai": {"configured": bool(OPENAI_API_KEY), "working": False, "error": None},
        "llama": {"configured": bool(LLAMA_API_URL), "working": False, "error": None}
    }
    
    # Test OpenAI
    if OPENAI_API_KEY:
        try:
            start_time = time.time()
            response = call_gpt("Say only: OK", max_tokens=5, temperature=0.1)
            elapsed = time.time() - start_time
            results["openai"]["working"] = bool(response and "OK" in response)
            results["openai"]["response_time"] = f"{elapsed:.2f}s"
        except Exception as e:
            results["openai"]["error"] = str(e)
            logger.error(f"OpenAI health check failed: {e}")
    
    # Test LLaMA
    if LLAMA_API_URL:
        try:
            start_time = time.time()
            response = call_llama("Say only: OK", max_tokens=5, temperature=0.1)
            elapsed = time.time() - start_time
            results["llama"]["working"] = bool(response and "OK" in response)
            results["llama"]["response_time"] = f"{elapsed:.2f}s"
        except Exception as e:
            results["llama"]["error"] = str(e)
            logger.error(f"LLaMA health check failed: {e}")
    
    # Overall status
    results["overall"] = "healthy" if (results["openai"]["working"] or results["llama"]["working"]) else "degraded"
    results["recommendation"] = "At least one LLM is working" if results["overall"] == "healthy" else "Check LLM configurations"
    
    return results

# ------------------------------------------------------------
# Authentication Endpoints
# ------------------------------------------------------------

@app.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest):
    """Register a new user."""
    logger.info(f"Registration attempt for user: {data.username}")
    
    try:
        user = create_user(
            data.username,
            data.password,
            data.full_name
        )
        logger.info(f"User {data.username} registered successfully")
        return {"status": "ok", "user": {**user, "password_hash": "[REDACTED]"}}
    except HTTPException as e:
        logger.warning(f"Registration failed for {data.username}: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected registration error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/token")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    """Authenticate user and return access token."""
    logger.info(f"Login attempt for user: {form.username}")
    
    user = authenticate_user(form.username, form.password)
    if not user:
        logger.warning(f"Failed login for user: {form.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_token({"username": user["username"], "user_id": user["id"]})
    logger.info(f"Successful login for user: {form.username}")
    
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.post("/auth/request-otp")
async def request_otp(request: Request, data: OTPRequest):
    """Request OTP (rate-limited)."""
    username = data.username.strip()
    client_ip = request.headers.get("x-forwarded-for", 
                  request.client.host if request.client else "unknown").split(",")[0].strip()
    
    logger.info(f"OTP request for user: {username} from IP: {client_ip}")
    
    now = int(time.time())
    
    # Check rate limits
    if not check_rate_limit(username, client_ip, now):
        logger.warning(f"Rate limit exceeded for {username} from {client_ip}")
        raise HTTPException(
            status_code=429,
            detail="Too many OTP requests. Please try again later."
        )
    
    # Look up user
    users = _load_users()
    user = next((u for u in users if u["username"] == username), None)
    
    # For security, don't reveal if user exists
    if not user:
        logger.info(f"OTP requested for non-existent user: {username}")
        # Still record the attempt for rate limiting
        record_request(username, client_ip, now)
        return {
            "status": "sent",
            "message": "If an account exists with this username, an OTP has been sent."
        }
    
    # Generate OTP
    otp = random.randint(100000, 999999)
    user["otp"] = otp
    user["otp_expiry"] = now + 300  # 5 minutes
    
    _save_users(users)
    record_request(username, client_ip, now)
    
    # TODO: Implement actual email sending
    logger.info(f"Generated OTP for {username}: {otp}")
    print(f"OTP for {username}: {otp}")
    
    return {"status": "sent", "message": "OTP sent to registered email."}

@app.post("/auth/verify-otp")
async def verify_otp(data: OTPVerify):
    """Verify OTP and return reset token."""
    logger.info(f"OTP verification attempt for user: {data.username}")
    
    users = _load_users()
    user = next((u for u in users if u["username"] == data.username), None)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get("otp"):
        raise HTTPException(status_code=400, detail="No OTP requested")
    
    if int(time.time()) > user["otp_expiry"]:
        raise HTTPException(status_code=400, detail="OTP expired")
    
    if int(data.otp) != int(user["otp"]):
        logger.warning(f"Invalid OTP attempt for user: {data.username}")
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    reset_token = create_token({"username": data.username, "reset": True})
    logger.info(f"OTP verified successfully for user: {data.username}")
    
    return {"reset_token": reset_token, "expires_in": 300}

@app.post("/auth/reset-password")
async def reset_password(data: ResetPassword):
    """Reset password using reset token."""
    try:
        payload = decode_token(data.token)
        
        if not payload.get("reset"):
            raise HTTPException(status_code=401, detail="Invalid reset token")
        
        username = payload.get("username")
        users = _load_users()
        
        user = next((u for u in users if u["username"] == username), None)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        hashed = pwd.hash(data.new_password)
        user["password_hash"] = hashed
        user["otp"] = None
        user["otp_expiry"] = None
        
        _save_users(users)
        logger.info(f"Password reset successfully for user: {username}")
        
        return {"status": "ok", "message": "Password reset successful"}
    except Exception as e:
        logger.error(f"Password reset failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ------------------------------------------------------------
# Chat Endpoints (Fixed with all endpoints)
# ------------------------------------------------------------

@app.get("/chat/sessions")
async def chat_sessions(current_user=Depends(get_current_user)):
    return await get_sessions(current_user)

@app.post("/chat/sessions")
async def chat_new(current_user=Depends(get_current_user)):
    return await create_session(current_user)

@app.post("/chat/message")
async def chat_msg(payload: ChatMessageInput, current_user=Depends(get_current_user)):
    model = (payload.model or "").strip().lower()
    if model == "":
        model = DEFAULT_MODEL.strip().lower()
    
    payload_dict = payload.dict()
    payload_dict["model"] = model
    return await chat_message(payload_dict, store, current_user)

@app.get("/chat/session/{session_id}")
async def get_chat_session(session_id: str, current_user=Depends(get_current_user)):
    sessions = load_sessions()
    s = next((x for x in sessions if x["id"] == session_id and x["user_id"] == current_user["id"]), None)
    
    if not s:
        raise HTTPException(404, "Session not found")

    return s

@app.patch("/chat/session/{session_id}")
async def rename_chat_session(
    session_id: str,
    title: str = Body(...),
    current_user=Depends(get_current_user)
):
    """PATCH endpoint to rename a chat session"""
    sessions = load_sessions()
    s = next((x for x in sessions if x["id"] == session_id and x["user_id"] == current_user["id"]), None)

    if not s:
        raise HTTPException(404, "Session not found")

    s["title"] = title
    save_sessions(sessions)

    return {"status": "renamed", "session_id": session_id, "title": title}

@app.put("/chat/sessions/{session_id}")
async def rename_chat_session_put(
    session_id: str,
    body: RenameSessionRequest,
    current_user=Depends(get_current_user)
):
    """PUT endpoint to rename a chat session (alternative to PATCH)"""
    sessions = load_sessions()
    s = next((x for x in sessions if x["id"] == session_id and x["user_id"] == current_user["id"]), None)
    
    if not s:
        raise HTTPException(404, "Session not found")
    
    s["title"] = body.title
    save_sessions(sessions)
    
    return {"status": "renamed", "session_id": session_id, "title": body.title}

@app.delete("/chat/session/{session_id}")
async def delete_chat_session_singular(session_id: str, current_user=Depends(get_current_user)):
    """DELETE endpoint for /chat/session/{session_id} (singular)"""
    sessions = load_sessions()
    new_sessions = [
        s for s in sessions 
        if not (s["id"] == session_id and s["user_id"] == current_user["id"])
    ]

    if len(new_sessions) == len(sessions):
        raise HTTPException(404, "Session not found")

    save_sessions(new_sessions)

    return {"status": "deleted", "session_id": session_id}

@app.delete("/chat/sessions/{session_id}")
async def delete_chat_session_plural(session_id: str, current_user=Depends(get_current_user)):
    """DELETE endpoint for /chat/sessions/{session_id} (plural)"""
    sessions = load_sessions()
    
    # Find the session
    session_to_delete = None
    for i, s in enumerate(sessions):
        if s["id"] == session_id and s["user_id"] == current_user["id"]:
            session_to_delete = i
            break
    
    if session_to_delete is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Remove the session
    deleted_session = sessions.pop(session_to_delete)
    save_sessions(sessions)
    
    return {"status": "ok", "deleted": session_id, "message": "Session deleted successfully"}

@app.post("/chat/message/stream")
async def chat_message_stream(payload: ChatMessageInput, current_user=Depends(get_current_user)):
    session_id = payload.session_id
    message = payload.message
    model = (payload.model or "").strip().lower()
    if model == "":
        model = DEFAULT_MODEL.strip().lower()

    # validate session
    sessions = load_sessions()
    s = next((x for x in sessions if x["id"] == session_id and x["user_id"] == current_user["id"]), None)
    if not s:
        raise HTTPException(404, "Session not found")

    # store user message
    s["messages"].append({"role": "user", "content": message})

    # Optional query rewriting for conversational context
    # Use history up to the message just added
    search_query = rewrite_query_for_retrieval(s["messages"][:-1], message, model)

    # retrieval (Unified GramSakhi Retrieval)
    retrieved = retrieve_government_context(search_query, store)

    if not retrieved:
        # Fallback for irrelevant or unsupported queries
        reply = "I could not find sufficient verified information in the available government documents to answer this question."
        s["messages"].append({"role": "assistant", "content": reply})
        save_sessions(sessions)
        
        async def fallback_generator():
            words = reply.split()
            for i, word in enumerate(words):
                yield word + (" " if i < len(words) - 1 else "")
                await asyncio.sleep(0.01)
                
        return StreamingResponse(fallback_generator(), media_type="text/plain")

    # Evidence Sufficiency Validation
    validation_query = f"User asked: {message}\n(Resolved to: {search_query})"
    is_supported = validate_evidence(validation_query, retrieved, model=model)
    
    if not is_supported:
        reply = "I could not find sufficient verified information in the available government documents to answer this question."
        s["messages"].append({"role": "assistant", "content": reply})
        save_sessions(sessions)
        
        async def fallback_generator():
            words = reply.split()
            for i, word in enumerate(words):
                yield word + (" " if i < len(words) - 1 else "")
                await asyncio.sleep(0.01)
                
        return StreamingResponse(fallback_generator(), media_type="text/plain")

    prompt = build_chat_prompt(s["messages"], retrieved)

    async def token_generator():
        # Call the appropriate LLM directly using the constructed prompt
        try:
            if "gpt" in model.lower():
                reply = call_gpt(prompt, max_tokens=1000) or "I'm sorry, the service is currently unavailable."
            else:
                reply = call_llama(prompt, max_tokens=1000, model=model) or "I'm sorry, the service is currently unavailable."
        except Exception as e:
            reply = "I'm sorry, an error occurred while generating the answer."
        
        # Stream the reply token by token
        words = reply.split()
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")
            await asyncio.sleep(0.01)
        
        # save assistant reply after streaming is complete
        s["messages"].append({"role": "assistant", "content": reply})
        save_sessions(sessions)

    return StreamingResponse(token_generator(), media_type="text/plain")

# ------------------------------------------------------------
# Document Management Endpoints
# ------------------------------------------------------------

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    scheme_name: Optional[str] = Form(None),
    ministry: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload and process a PDF file."""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required to upload documents.")
        
    logger.info(f"Upload attempt by Admin {current_user['username']}: {file.filename}")
    
    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF uploads supported.")
    
    # Read and validate file size
    content = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {MAX_UPLOAD_SIZE_MB}MB"
        )
    
    # Reset file pointer
    await file.seek(0)
    
    # Generate unique file ID
    file_id = str(uuid.uuid4())
    sanitized_name = sanitize_filename(file.filename)
    dest = UPLOAD_DIR / f"{file_id}.pdf"
    
    # Save file
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    logger.info(f"File saved: {dest}")
    
    try:
        # Extract text from PDF
        raw_pages = extract_text_from_pdf(str(dest))
        
        # Check if any text was extracted
        total_text_present = any(bool(p_text.strip()) for _, p_text in raw_pages)
        if not total_text_present:
            raise HTTPException(
                status_code=400, 
                detail="No readable text found in PDF. Consider using OCR."
            )
        
        # Chunk the text
        chunks = chunk_text(raw_pages, chunk_size=400, overlap=60)
        
        # Prepare documents for storage
        docs = []
        for idx, c in enumerate(chunks):
            meta = c["meta"]
            meta.update({
                "source": sanitized_name,
                "file_id": file_id,
                # "user_id": current_user["id"], # Removed to make it global
                "chunk_id": idx,
                "deleted": False,
                "uploaded_at": time.time(),
                "scheme_name": scheme_name,
                "ministry": ministry,
                "state": state
            })
            docs.append({"text": c["text"], "meta": meta})
        
        # Add to document store
        store.add_documents(docs, source_name=sanitized_name)
        
        logger.info(f"Successfully processed {len(docs)} chunks from {sanitized_name}")
        
        return {
            "status": "ok",
            "file_id": file_id,
            "file_name": sanitized_name,
            "chunks_added": len(docs),
            "file_size_mb": len(content) / (1024 * 1024),
        }
        
    except Exception as e:
        # Clean up on error
        if dest.exists():
            dest.unlink()
        logger.error(f"File processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")

@app.get("/documents")
async def list_documents(current_user: dict = Depends(get_current_user)):
    """List all global government documents."""
    docs = {}
    
    for m in store.meta:
        if m.get("deleted", False):
            continue
        
        fid = m.get("file_id")
        if fid not in docs:
            docs[fid] = {
                "file_id": fid,
                "file_name": m.get("source"),
                "scheme_name": m.get("scheme_name"),
                "ministry": m.get("ministry"),
                "state": m.get("state"),
                "chunks": 0,
                "uploaded_at": m.get("uploaded_at"),
                "pages": set()
            }
        
        docs[fid]["chunks"] += 1
        if "page_num" in m:
            docs[fid]["pages"].add(m["page_num"])
    
    # Convert sets to sorted lists
    for doc in docs.values():
        if doc["pages"]:
            doc["pages"] = sorted(doc["pages"])
    
    return list(docs.values())

@app.get("/document/{file_id}")
async def document_details(file_id: str, current_user: dict = Depends(get_current_user)):
    """Get details for a specific global government document."""
    chunks = [m for m in store.meta 
              if m.get("file_id") == file_id 
              and not m.get("deleted", False)]
    
    if not chunks:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Sort by page_num and chunk
    chunks.sort(key=lambda x: (x.get("page_num", 0), x.get("chunk_id", 0)))
    
    # Extract preview from first few chunks
    preview_texts = []
    for c in chunks[:5]:
        text = c.get("text", "")
        if len(text) > 200:
            text = text[:200] + "..."
        preview_texts.append(text)
    
    preview = " ".join(preview_texts)[:1000]
    
    return {
        "file_id": file_id,
        "file_name": chunks[0].get("source"),
        "scheme_name": chunks[0].get("scheme_name"),
        "ministry": chunks[0].get("ministry"),
        "state": chunks[0].get("state"),
        "chunk_count": len(chunks),
        "pages": sorted(set(c.get("page_num", 0) for c in chunks)),
        "uploaded_at": chunks[0].get("uploaded_at"),
        "preview": preview,
        "total_size_bytes": sum(len(c.get("text", "")) for c in chunks)
    }

@app.delete("/document/delete/{file_id}")
async def delete_document(file_id: str, current_user: dict = Depends(get_current_user)):
    """Soft-delete a global government document (Admin only)."""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required to delete documents.")
        
    changes = 0
    for m in store.meta:
        if (m.get("file_id") == file_id 
            and not m.get("deleted", False)):
            m["deleted"] = True
            changes += 1
    
    if changes == 0:
        raise HTTPException(status_code=404, detail="Document not found or already deleted")
    
    # Delete the physical PDF file
    pdf_path = UPLOAD_DIR / f"{file_id}.pdf"
    if pdf_path.exists():
        try:
            pdf_path.unlink()
            logger.info(f"Deleted PDF file: {pdf_path}")
        except Exception as e:
            logger.warning(f"Failed to delete PDF file: {e}")
    
    # Persist changes
    store._persist()
    store._build_bm25_from_meta()
    
    logger.info(f"Deleted {changes} chunks for document {file_id}")
    
    return {
        "status": "deleted", 
        "file_id": file_id, 
        "chunks_marked_deleted": changes
    }

@app.get("/document/search/{file_id}")
async def search_in_document(
    file_id: str, 
    query: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Search within a specific document."""
    # Filter chunks for this document
    doc_chunks = [m for m in store.meta 
                  if m.get("file_id") == file_id 
                  and not m.get("deleted", False)]
    
    if not doc_chunks:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    # Get BM25 scores
    bm25_scores_all = store._bm25_scores_for_query(query)
    results = []
    
    for m in doc_chunks:
        idx = m.get("id", 0)
        embed_score = float(m.get("embed_score", 0))
        bm25_score = float(bm25_scores_all[idx]) if (bm25_scores_all and idx < len(bm25_scores_all)) else 0.0
        
        # Hybrid scoring
        score = 0.7 * embed_score + 0.3 * bm25_score
        
        result = m.copy()
        result["score"] = score
        result["highlight"] = highlight_query(m.get("text", ""), query)
        results.append(result)
    
    # Sort and limit results
    results = sorted(results, key=lambda x: x["score"], reverse=True)[:limit]
    
    return {
        "file_id": file_id, 
        "query": query, 
        "results": clean_for_json(results),
        "total_matches": len(results)
    }

@app.get("/documents/{file_id}/view")
async def view_pdf(file_id: str):
    pdf_path = UPLOAD_DIR / f"{file_id}.pdf"

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF not found")

    # Ensure document exists
    chunks = [m for m in store.meta 
              if m.get("file_id") == file_id 
              and not m.get("deleted", False)]
    if not chunks:
        raise HTTPException(status_code=403, detail="Access denied")

    # CORRECT INLINE PREVIEW RESPONSE
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"{file_id}.pdf",
        headers={
            "Content-Disposition": "inline; filename=\"preview.pdf\"",
            "X-Frame-Options": "ALLOWALL"
        }
    )

# ------------------------------------------------------------
# Query & Analysis Endpoints
# ------------------------------------------------------------

@app.post("/query")
async def query_endpoint(
    req: QueryRequest, 
    current_user: dict = Depends(get_current_user)
):
    """Query across all government documents."""
    logger.info(f"Query from {current_user['username']}: {req.question[:50]}...")
    
    try:
        model = get_safe_model(req.model)
        
        # Unified GramSakhi Retrieval
        results = retrieve_government_context(req.question, store)
        
        if not results:
            return {
                "question": req.question,
                "answer": "I could not find sufficient verified information in the available government documents to answer this question.",
                "references": [],
                "model": model
            }
            
        # Evidence Sufficiency Validation
        is_supported = validate_evidence(req.question, results, model=model)
        if not is_supported:
            return {
                "question": req.question,
                "answer": "I could not find sufficient verified information in the available government documents to answer this question.",
                "references": [],
                "model": model
            }
        
        # Generate answer
        answer = simple_answer_from_retrieval(req.question, results, model=model)
        
        logger.info(f"Query completed successfully for {current_user['username']}")
        
        return {
            "question": req.question,
            "answer": answer,
            "references": clean_for_json(results),
            "model": model,
            "total_references": len(results)
        }
        
    except Exception as e:
        logger.error(f"Query failed: {e}")
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@app.post("/summarize")
async def summarize(
    req: SummarizeReq, 
    current_user: dict = Depends(get_current_user)
):
    """Summarize documents on a specific topic."""
    logger.info(f"Summarize request from {current_user['username']}: {req.topic}")
    
    try:
        model = get_safe_model(req.model)
        
        # Search for relevant content
        chunks = store.search(
            req.topic,
            k=12,
            embed_weight=0.7,
            bm25_weight=0.3,
            user_id=current_user["id"],
            use_mmr=req.use_mmr,
            mmr_k=8,
            mmr_lambda=0.6,
        )
        
        # Apply cross-encoder reranking if available
        if chunks and hasattr(store, "rerank_with_cross_encoder"):
            chunks = store.rerank_with_cross_encoder(req.topic, chunks, top_k=8)
        
        if not chunks:
            raise HTTPException(status_code=404, detail="No relevant content found.")
        
        # Generate summary
        summary = summarize_agent(req.topic, chunks, model=model)
        
        logger.info(f"Summarize completed for {current_user['username']}")
        
        return {
            "topic": req.topic,
            "summary": summary,
            "references": clean_for_json(chunks),
            "model": model
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Summarize failed: {e}")
        raise HTTPException(status_code=500, detail=f"Summarize failed: {str(e)}")

@app.post("/compare")
async def compare(
    req: CompareReq, 
    current_user: dict = Depends(get_current_user)
):
    """Compare two or more documents."""
    logger.info(f"Compare request from {current_user['username']}: {req.doc_ids}")
    
    try:
        model = get_safe_model(req.model)
        topic = req.question or "Document Comparison"
        
        # Filter chunks belonging to given docs (exclude deleted and check user ownership)
        filtered = [m for m in store.meta 
                    if (m.get("file_id") in set(req.doc_ids)) 
                    and not m.get("deleted", False)
                    and m.get("user_id") == current_user["id"]]

        if not filtered:
            raise HTTPException(status_code=404, detail="Documents not found.")

        # Hybrid scoring only for filtered chunks
        reranked = []
        bm25_scores = store._bm25_scores_for_query(topic)

        for m in filtered:
            idx = m.get("id", 0)
            embed_score = float(m.get("embed_score", 0))
            bm25_score = float(bm25_scores[idx]) if (bm25_scores and idx < len(bm25_scores)) else 0
            hybrid = (0.7 * embed_score) + (0.3 * bm25_score)

            nm = m.copy()
            nm["score"] = hybrid
            reranked.append(nm)

        reranked = sorted(reranked, key=lambda x: x["score"], reverse=True)[:15]

        # Apply cross-encoder reranking if available
        if reranked and hasattr(store, "rerank_with_cross_encoder"):
            reranked = store.rerank_with_cross_encoder(topic, reranked, top_k=10)

        # Optional MMR re-selection for diversity within the selected set
        if getattr(req, "use_mmr", False) and reranked:
            try:
                texts = [r.get("text", "") for r in reranked]
                cand_embs = store._encode_texts_with_cache(texts)
                q_emb = store.embed_model.encode([topic], convert_to_numpy=True)
                q_emb = q_emb / (np.linalg.norm(q_emb, axis=1, keepdims=True) + 1e-12)
                q_emb = q_emb.astype("float32")[0]
                sel_k = min(8, len(reranked))
                reranked = store.mmr_select(cand_embs, reranked, q_emb, top_k=sel_k, lambda_param=0.6)
            except Exception as e:
                logger.warning(f"MMR for compare failed: {e}")

        comparison = compare_agent(topic, reranked, model=model)
        
        logger.info(f"Compare completed for {current_user['username']}")

        return {
            "comparison": comparison,
            "sources": req.doc_ids,
            "references": clean_for_json(reranked),
            "model": model
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Compare failed: {e}")
        raise HTTPException(status_code=500, detail=f"Compare failed: {str(e)}")

@app.post("/report")
async def report(
    req: ReportReq, 
    current_user: dict = Depends(get_current_user)
):
    """Generate a comprehensive report on a topic."""
    logger.info(f"Report request from {current_user['username']}: {req.topic}")
    
    try:
        model = get_safe_model(req.model)
        
        chunks = store.search(
            req.topic,
            k=15,
            embed_weight=0.7,
            bm25_weight=0.3,
            user_id=current_user["id"],
            use_mmr=req.use_mmr,
            mmr_k=8,
            mmr_lambda=0.6,
        )
        
        # Apply cross-encoder reranking if available
        if chunks and hasattr(store, "rerank_with_cross_encoder"):
            chunks = store.rerank_with_cross_encoder(req.topic, chunks, top_k=10)

        if not chunks:
            raise HTTPException(status_code=404, detail="No relevant content found.")

        rep = report_agent(req.topic, chunks, model=model)
        
        logger.info(f"Report completed for {current_user['username']}")

        return {
            "topic": req.topic,
            "report": rep,
            "references": clean_for_json(chunks),
            "model": model
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Report failed: {e}")
        raise HTTPException(status_code=500, detail=f"Report failed: {str(e)}")

# ------------------------------------------------------------
# Export Endpoints
# ------------------------------------------------------------

@app.post("/export/pdf")
async def export_as_pdf(
    req: ExportReq, 
    current_user: dict = Depends(get_current_user)
):
    """Export content as PDF"""
    out_path = str(EXPORT_DIR / (req.filename + ".pdf"))
    
    # Ensure exports directory exists
    EXPORT_DIR.mkdir(exist_ok=True)
    
    export_pdf(req.content, out_path)
    return FileResponse(
        out_path, 
        media_type="application/pdf", 
        filename=req.filename + ".pdf"
    )

@app.post("/export/docx")
async def export_as_docx(
    req: ExportReq, 
    current_user: dict = Depends(get_current_user)
):
    """Export content as DOCX"""
    out_path = str(EXPORT_DIR / (req.filename + ".docx"))
    
    # Ensure exports directory exists
    EXPORT_DIR.mkdir(exist_ok=True)

    export_docx(req.content, out_path)
    return FileResponse(
        out_path, 
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=req.filename + ".docx"
    )

@app.post("/export/chat/{session_id}")
async def export_chat_session(session_id: str, fmt: str = Body("pdf"), current_user=Depends(get_current_user)):
    """
    Export a chat session as pdf or docx.
    Body: { "fmt": "pdf" }  (optional, defaults to pdf)
    """
    # find session and ownership
    sessions = load_sessions()
    s = next((x for x in sessions if x["id"] == session_id and x["user_id"] == current_user["id"]), None)
    if not s:
        raise HTTPException(404, "Session not found")

    messages = s.get("messages", [])
    title = s.get("title") or f"Chat_{session_id}"
    content = ""
    for m in messages:
        role = m.get("role", "").upper()
        content += f"{role}:\n{m.get('content','')}\n\n"

    filename = f"{title.replace(' ','_')}_{session_id}"

    if fmt.lower() == "docx":
        data = export_docx_structured(content, references=None, file_path=None, filename=filename, title=title)
        return StreamingResponse(BytesIO(data), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers={"Content-Disposition": f"attachment; filename={filename}.docx"})
    else:
        data = export_pdf_structured(content, references=None, file_path=None, filename=filename, title=title)
        return StreamingResponse(BytesIO(data), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}.pdf"})

@app.post("/export/advanced")
async def export_advanced(req: dict = Body(...), current_user=Depends(get_current_user)):
    """
    Generic exporter for summaries, reports, comparisons.
    Body (JSON):
    {
      "content": "main text",
      "references": [ {source, chunk_id, citation}, ... ],
      "fmt": "pdf" | "docx",
      "filename": "My_Report",
      "title": "Optional Title",
      "author": "Optional Author",
      "logo_b64": "optional base64 string of PNG/JPG"
    }
    """
    content = req.get("content", "")
    references = req.get("references", None)
    fmt = req.get("fmt", "pdf")
    filename = req.get("filename", "doculex_export")
    title = req.get("title", filename)
    author = req.get("author", current_user.get("username"))
    logo_b64 = req.get("logo_b64")

    filename_clean = filename.replace(" ", "_")

    if fmt == "docx":
        data = export_docx_structured(content, references=references, file_path=None, filename=filename_clean, title=title, author=author, logo_b64=logo_b64)
        return StreamingResponse(BytesIO(data), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers={"Content-Disposition": f"attachment; filename={filename_clean}.docx"})
    else:
        data = export_pdf_structured(content, references=references, file_path=None, filename=filename_clean, title=title, author=author, logo_b64=logo_b64)
        return StreamingResponse(BytesIO(data), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename_clean}.pdf"})

# ------------------------------------------------------------
# Debug & Admin Endpoints
# ------------------------------------------------------------

@app.get("/debug")
async def debug_index(current_user: dict = Depends(get_current_user)):
    # show total meta entries and active (not deleted) chunks for current user
    user_chunks = [m for m in store.meta if m.get("user_id") == current_user["id"]]
    total = len(user_chunks)
    active = sum(1 for m in user_chunks if not m.get("deleted", False))
    return {
        "total_meta_entries": total, 
        "active_chunks": active,
        "user_id": current_user["id"]
    }

@app.post("/admin/rebuild-index")
async def admin_rebuild_index(current_user=Depends(get_current_user)):
    """
    Rebuild FAISS index from metadata. Only accessible to admin users.
    Set ADMIN_USERS environment variable to a comma separated list of usernames, e.g. "admin,alice".
    """
    # Allowed admins (default "admin" for convenience)
    admin_env = os.getenv("ADMIN_USERS", "admin")
    admins = [a.strip() for a in admin_env.split(",") if a.strip()]
    if current_user.get("username") not in admins:
        raise HTTPException(status_code=403, detail="Forbidden: admin only")

    # call the rebuild on your DocumentStore instance 'store'
    try:
        result = store.rebuild_index_from_meta(reencode=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rebuild failed: {e}")

    return {"status": "ok", "result": result}

# ------------------------------------------------------------
# Additional Health Check
# ------------------------------------------------------------

@app.get("/debug/llm-status")
async def debug_llm_status():
    """Debug endpoint to check LLM connectivity"""
    from app.llm import _get_openai_key, _get_llama_url, _get_llama_model, call_llama, call_gpt
    
    # Test LLaMA
    llama_test = None
    llama_time = None
    try:
        import time
        start_time = time.time()
        llama_test = call_llama("Say only: LLaMA_WORKS", max_tokens=10)
        llama_time = time.time() - start_time
    except Exception as e:
        llama_test = f"Error: {str(e)}"
    
    # Test OpenAI
    openai_test = None
    openai_time = None
    try:
        start_time = time.time()
        openai_test = call_gpt("Say only: GPT_WORKS", max_tokens=10)
        openai_time = time.time() - start_time
    except Exception as e:
        openai_test = f"Error: {str(e)}"
    
    return {
        "status": "diagnostic",
        "llama": {
            "configured": bool(_get_llama_url()),
            "model": _get_llama_model(),
            "test_result": llama_test,
            "response_time": f"{llama_time:.2f}s" if llama_time else None,
            "working": bool(llama_test and "LLaMA_WORKS" in llama_test)
        },
        "openai": {
            "configured": bool(_get_openai_key()),
            "test_result": openai_test,
            "response_time": f"{openai_time:.2f}s" if openai_time else None,
            "working": bool(openai_test and "GPT_WORKS" in openai_test)
        },
        "recommendation": "Both LLMs should work now with faster responses"
    }

# ------------------------------------------------------------
# Run Server
# ------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)