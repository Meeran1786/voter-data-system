"""
Authentication router — login, token verification.
Uses PyJWT + stdlib hashlib (no passlib dependency).

Default credentials (override via .env):
    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=admin@123
    JWT_SECRET=change-me-in-production
"""

import hashlib
import hmac
import os
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

router = APIRouter()

# ── Config (read from env / .env) ────────────────────────────────────────────
JWT_SECRET       = os.getenv("JWT_SECRET", "mdis-voter-system-secret-2024")
JWT_ALGORITHM    = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

ADMIN_USERNAME   = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD   = os.getenv("ADMIN_PASSWORD", "admin@123")

# PBKDF2 hash — uses 100k iterations (secure but faster than 200k for a single-user local app).
# Computed once at startup.
_ADMIN_HASH: str = hashlib.pbkdf2_hmac(
    "sha256",
    ADMIN_PASSWORD.encode("utf-8"),
    b"mdis-voter-salt",
    100_000,
).hex()


def _verify_password(plain: str) -> bool:
    """Constant-time password comparison to prevent timing attacks."""
    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        plain.encode("utf-8"),
        b"mdis-voter-salt",
        100_000,
    ).hex()
    return hmac.compare_digest(candidate, _ADMIN_HASH)


def _create_token(username: str) -> str:
    payload = {
        "sub": username,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired — please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Bearer scheme (used as dependency in protected routes) ───────────────────
_bearer = HTTPBearer(auto_error=False)


def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """FastAPI dependency — raises 401 if no valid JWT is present."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode_token(credentials.credentials)


# ── Schemas ───────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    expires_in_hours: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
def auth_status():
    """Health check — confirms the auth router is reachable (no credentials needed)."""
    return {"status": "auth_router_ok", "admin_user": ADMIN_USERNAME}


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    """
    Validate credentials and return a JWT.
    Default: admin / admin@123  (override via ADMIN_USERNAME / ADMIN_PASSWORD env vars)
    """
    try:
        ok = (body.username == ADMIN_USERNAME) and _verify_password(body.password)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication error: {exc}",
        )

    if not ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    token = _create_token(body.username)
    return LoginResponse(
        access_token=token,
        username=body.username,
        expires_in_hours=JWT_EXPIRE_HOURS,
    )


@router.get("/me")
def me(user: dict = Depends(require_auth)):
    """Return the currently authenticated user info (requires Bearer token)."""
    return {"username": user["sub"]}
