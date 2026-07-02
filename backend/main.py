"""
Indian Voter Data Management System — FastAPI entry point.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import init_db
from routers import voters, upload, export
from routers.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    yield


app = FastAPI(
    title="Indian Voter Data Management System",
    description="Parse, search, and export Indian Electoral Roll data across CSV, Excel, DOCX, PDF, and scanned images.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — comma-separated origins via ALLOWED_ORIGINS env var.
# Set this on Render to include your Vercel URL, e.g.:
#   http://localhost:3001,https://your-app.vercel.app
_default_origins = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001"
_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth_router,   prefix="/api/auth",   tags=["Auth"])
app.include_router(voters.router, prefix="/api/voters", tags=["Voters"])
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])


@app.get("/", include_in_schema=False)
async def root():
    return JSONResponse({"status": "ok", "service": "Voter Data Management System"})


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
