# app/auth.py
import time
import json
import os
from pathlib import Path
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
import jwt

# Local users DB (JSON file)
USERS_DB = Path(__file__).resolve().parent.parent / "users.json"
if not USERS_DB.exists():
    USERS_DB.write_text("[]")

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="token")

# IMPORTANT: require a strong SECRET_KEY from environment
SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
ALGO = "HS256"

if not SECRET_KEY:
    # Fail-fast: do not allow the app to run with empty or default secret
    raise RuntimeError(
        "SECURITY: SECRET_KEY environment variable is required and must be a strong secret. "
        "Set SECRET_KEY in your .env (do NOT use 'doculex-secret-key-change-this')."
    )

# -------------------------------------------------------
# Helper functions
# -------------------------------------------------------

def _load_users():
    try:
        return json.loads(USERS_DB.read_text())
    except:
        return []

def _save_users(users):
    USERS_DB.write_text(json.dumps(users, indent=2))


def create_user(username: str, password: str, full_name="", email=""):
    users = _load_users()

    # Check duplicates
    for u in users:
        if u["username"] == username:
            raise HTTPException(400, "Username already exists")
        if email and u.get("email") == email:
            raise HTTPException(400, "Email already registered")

    # Password length restriction
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(400, "Password is too long")

    hashed = pwd.hash(password)

    user = {
        "id": str(int(time.time() * 1000)),
        "username": username,
        "password_hash": hashed,
        "full_name": full_name,
        "email": email,
        "created_at": int(time.time()),
        "is_admin": False,
        "otp": None,
        "otp_expiry": None
    }

    users.append(user)
    _save_users(users)

    return {
        "id": user["id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "email": user["email"],
        "is_admin": user["is_admin"],
        "created_at": user["created_at"]
    }

def authenticate_user(username: str, password: str):
    users = _load_users()

    for u in users:
        if u["username"] == username:
            if pwd.verify(password, u["password_hash"]):
                return {k: u[k] for k in u if k != "password_hash"}

    return None


def create_token(data: dict):
    payload = data.copy()
    payload["exp"] = int(time.time()) + 3600 * 24  # expires in 1 days
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGO)
    return token


def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGO])
    except Exception:
        raise HTTPException(401, "Invalid token")


def get_current_user(token: str = Depends(oauth2)):
    payload = decode_token(token)
    username = payload.get("username")
    if not username:
        raise HTTPException(401, "Invalid token")

    users = _load_users()
    for u in users:
        if u["username"] == username:
            return {k: u[k] for k in u if k != "password_hash"}

    raise HTTPException(401, "User not found")