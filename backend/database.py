"""
Database setup — supports both:
  • SQLite  (local development, default when DATABASE_URL is not set)
  • PostgreSQL (production via Neon / Render / any PG host)

Set the DATABASE_URL environment variable to switch:
    sqlite:///./voter_data.db          ← local (default)
    postgresql://user:pass@host/db     ← Neon / Render Postgres
"""

import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# ── Connection URL ────────────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./voter_data.db")

# Neon (and old Heroku/Render) provide "postgres://" — SQLAlchemy needs "postgresql://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

_is_sqlite = DATABASE_URL.startswith("sqlite")

# ── Engine ────────────────────────────────────────────────────────────────────
_connect_args: dict = {}
if _is_sqlite:
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,   # discard stale connections automatically
    echo=False,
)

# SQLite-only performance pragmas (WAL mode, cache, foreign-key enforcement)
if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _record):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA cache_size=-64000")   # ~64 MB page cache
        cur.close()

# ── Session factory ───────────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a database session and closes it when done."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Create all tables on startup.
    Works with both SQLite and PostgreSQL — no FTS5 virtual tables needed
    (full-text search is now handled by ILIKE queries in the ORM layer).
    """
    from models import Base  # noqa: F401 — import triggers model registration
    Base.metadata.create_all(bind=engine)
