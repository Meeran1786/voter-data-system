"""
File upload and ingestion endpoint.
Accepts voter roll files, dispatches to the correct parser,
bulk-inserts into SQLite, and streams progress via SSE.
"""

import asyncio
import tempfile
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db, DATABASE_URL
from models import Voter, UploadJob
from parsers import dispatch_parser
from schemas import UploadJobRead

router = APIRouter()

ALLOWED_EXTENSIONS = {
    "csv", "xlsx", "xls", "docx", "doc",
    "pdf", "png", "jpg", "jpeg", "tiff", "bmp", "webp",
}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


def _infer_format(filename: str) -> str:
    return Path(filename).suffix.lstrip(".").lower()


def _make_upsert_stmt(rows: list):
    """
    Build a dialect-appropriate INSERT … ON CONFLICT DO NOTHING statement.
    Works with both SQLite (local dev) and PostgreSQL (Neon / Render).
    """
    if DATABASE_URL.startswith("postgresql"):
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        stmt = pg_insert(Voter).values(rows)
        return stmt.on_conflict_do_nothing()
    else:
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert
        stmt = sqlite_insert(Voter).values(rows)
        return stmt.on_conflict_do_nothing()


def _bulk_insert_voters(records: list, source_file: str, source_format: str, db: Session):
    """
    Upsert voter records — skip duplicates by (voter_id, source_file).
    Returns (inserted, skipped) counts.
    """
    inserted = skipped = 0
    batch_size = 500

    # Only keep columns that actually exist on the Voter model
    _voter_cols = {c.key for c in Voter.__table__.columns}

    for i in range(0, len(records), batch_size):
        batch = records[i: i + batch_size]
        rows_to_insert = []
        for r in batch:
            if not r.get("full_name"):
                skipped += 1
                continue
            row = {k: v for k, v in r.items() if k in _voter_cols}
            row["source_file"] = source_file
            row["source_format"] = source_format
            rows_to_insert.append(row)

        if not rows_to_insert:
            continue

        try:
            stmt = _make_upsert_stmt(rows_to_insert)
            result = db.execute(stmt)
            db.flush()
            inserted += result.rowcount if result.rowcount >= 0 else len(rows_to_insert)
            skipped += len(rows_to_insert) - (result.rowcount if result.rowcount >= 0 else 0)
        except IntegrityError:
            db.rollback()
            skipped += len(rows_to_insert)
        except Exception:
            db.rollback()
            skipped += len(rows_to_insert)

    db.commit()
    return inserted, skipped


def _process_upload(job_id: int, file_path: Path, filename: str, fmt: str):
    """Background task: parse file and insert records, updating job status."""
    from database import SessionLocal
    db = SessionLocal()
    job = db.query(UploadJob).filter(UploadJob.id == job_id).first()
    if not job:
        db.close()
        return

    job.status = "processing"
    job.started_at = datetime.utcnow()
    db.commit()

    try:
        records = dispatch_parser(file_path, fmt)
        job.records_parsed = len(records)
        db.commit()

        inserted, skipped = _bulk_insert_voters(records, filename, fmt, db)

        job.records_inserted = inserted
        job.records_skipped = skipped
        job.status = "done"
        job.completed_at = datetime.utcnow()
        db.commit()

    except Exception as exc:
        job.status = "failed"
        job.error_message = str(exc)[:2000]
        job.completed_at = datetime.utcnow()
        db.commit()
    finally:
        file_path.unlink(missing_ok=True)
        db.close()


@router.post("/", response_model=UploadJobRead, status_code=202)
async def upload_voter_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a voter roll file (CSV, Excel, DOCX, PDF, or image).
    Returns a job object immediately; parsing runs in the background.
    Poll /api/upload/jobs/{id} for status.
    """
    if not file.filename:
        raise HTTPException(400, "Filename is required")

    fmt = _infer_format(file.filename)
    if fmt not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file type '.{fmt}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Read content, check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_FILE_SIZE // (1024*1024)} MB limit")

    # Save to a temp file (parsers need a path, not a buffer)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{fmt}")
    tmp.write(content)
    tmp.close()
    tmp_path = Path(tmp.name)

    # Create job record
    job = UploadJob(
        filename=file.filename,
        file_format=fmt,
        file_size_bytes=len(content),
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Kick off background processing
    background_tasks.add_task(_process_upload, job.id, tmp_path, file.filename, fmt)

    return UploadJobRead.model_validate(job)


@router.get("/jobs", response_model=list[UploadJobRead])
async def list_jobs(db: Session = Depends(get_db)):
    """List all upload jobs (most recent first)."""
    jobs = db.query(UploadJob).order_by(UploadJob.created_at.desc()).limit(50).all()
    return [UploadJobRead.model_validate(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=UploadJobRead)
async def get_job(job_id: int, db: Session = Depends(get_db)):
    """Poll the status of an upload job."""
    job = db.query(UploadJob).filter(UploadJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return UploadJobRead.model_validate(job)


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(UploadJob).filter(UploadJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status == "processing":
        raise HTTPException(409, "Cannot delete a job that is currently processing")
    db.delete(job)
    db.commit()


# ── URL-based import ──────────────────────────────────────────────────────────

class UrlImportRequest(BaseModel):
    url: str
    filename: Optional[str] = None   # optional override; auto-detected from URL otherwise


@router.post("/from-url", response_model=UploadJobRead, status_code=202)
async def import_from_url(
    body: UrlImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Download a voter roll file from a URL and import it automatically.
    Useful for ECI / CEO state portal PDFs. Paste the direct PDF link.
    """
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL must start with http:// or https://")

    # Derive filename from URL if not provided
    filename = body.filename or Path(url.split("?")[0]).name or "downloaded_roll.pdf"
    fmt = _infer_format(filename)
    if fmt not in ALLOWED_EXTENSIONS:
        fmt = "pdf"  # default assumption for ECI links
        filename = filename + ".pdf"

    # Download to temp file
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            },
        )
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{fmt}")
        with urllib.request.urlopen(req, timeout=120) as response:
            content = response.read()
            if len(content) > MAX_FILE_SIZE:
                tmp.close()
                Path(tmp.name).unlink(missing_ok=True)
                raise HTTPException(413, "Downloaded file exceeds 100 MB limit")
            tmp.write(content)
        tmp.close()
    except urllib.error.URLError as exc:
        raise HTTPException(400, f"Failed to download URL: {exc.reason}")
    except Exception as exc:
        raise HTTPException(400, f"Download error: {str(exc)}")

    tmp_path = Path(tmp.name)

    # Create job record
    job = UploadJob(
        filename=filename,
        file_format=fmt,
        file_size_bytes=len(content),
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_process_upload, job.id, tmp_path, filename, fmt)

    return UploadJobRead.model_validate(job)
