"""
Auto-import watcher — drop PDF/CSV/XLSX files into the watch folder
and they will be automatically imported into the voter database.

Usage:
    python watcher.py

By default watches:  ./watch_inbox/
Configure via env:   WATCH_DIR=<path>  WATCH_INTERVAL=10
"""

import os
import time
import shutil
import logging
from pathlib import Path
from datetime import datetime

# ── Bootstrap path so local imports work ─────────────────────────────────────
import sys
sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal, init_db
from models import UploadJob, Voter
from parsers import dispatch_parser
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

# ── Config ────────────────────────────────────────────────────────────────────
WATCH_DIR     = Path(os.getenv("WATCH_DIR", "./watch_inbox"))
DONE_DIR      = Path(os.getenv("DONE_DIR",  "./watch_done"))
FAILED_DIR    = Path(os.getenv("FAILED_DIR","./watch_failed"))
INTERVAL      = int(os.getenv("WATCH_INTERVAL", "10"))   # seconds between scans
BATCH_SIZE    = 500
SUPPORTED_EXT = {".csv", ".xlsx", ".xls", ".docx", ".doc",
                 ".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("watcher")


def bulk_insert(db, records: list[dict], source_file: str, source_format: str) -> tuple[int, int]:
    """Insert records in batches; returns (inserted, skipped)."""
    inserted = skipped = 0
    for i in range(0, len(records), BATCH_SIZE):
        chunk = records[i : i + BATCH_SIZE]
        rows = []
        for r in chunk:
            rows.append({
                "voter_id":                    r.get("voter_id"),
                "full_name":                   r.get("full_name", ""),
                "full_name_regional":          r.get("full_name_regional"),
                "father_or_husband_name":      r.get("father_or_husband_name"),
                "father_or_husband_name_regional": r.get("father_or_husband_name_regional"),
                "relation_type":               r.get("relation_type"),
                "age":                         r.get("age"),
                "gender":                      r.get("gender"),
                "state":                       r.get("state"),
                "district":                    r.get("district"),
                "parliamentary_constituency":  r.get("parliamentary_constituency"),
                "assembly_constituency":       r.get("assembly_constituency"),
                "assembly_constituency_no":    r.get("assembly_constituency_no"),
                "section_no":                  r.get("section_no"),
                "part_no":                     r.get("part_no"),
                "part_name":                   r.get("part_name"),
                "serial_no":                   r.get("serial_no"),
                "polling_station_no":          r.get("polling_station_no"),
                "polling_station_name":        r.get("polling_station_name"),
                "house_door_no":               r.get("house_door_no"),
                "source_file":                 source_file,
                "source_format":               source_format,
            })
        stmt = sqlite_insert(Voter).values(rows)
        stmt = stmt.on_conflict_do_nothing()
        result = db.execute(stmt)
        inserted += result.rowcount
        skipped  += len(rows) - result.rowcount
        db.commit()
    return inserted, skipped


def process_file(filepath: Path) -> None:
    """Parse a single file and insert its records into the DB."""
    filename = filepath.name
    ext      = filepath.suffix.lower()

    log.info(f"Processing: {filename}")
    db = SessionLocal()

    # Create job record
    job = UploadJob(
        filename=filename,
        file_format=ext.lstrip("."),
        file_size_bytes=filepath.stat().st_size,
        status="processing",
        started_at=datetime.utcnow(),
    )
    db.add(job); db.commit(); db.refresh(job)

    try:
        records = dispatch_parser(str(filepath), ext.lstrip("."))
        inserted, skipped = bulk_insert(db, records, filename, ext.lstrip("."))

        job.status            = "done"
        job.records_parsed    = len(records)
        job.records_inserted  = inserted
        job.records_skipped   = skipped
        job.completed_at      = datetime.utcnow()
        db.commit()

        log.info(f"  ✓ {filename}: {inserted} inserted, {skipped} skipped ({len(records)} parsed)")

        # Move to done folder
        DONE_DIR.mkdir(exist_ok=True)
        dest = DONE_DIR / f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{filename}"
        shutil.move(str(filepath), str(dest))

    except Exception as exc:
        job.status        = "failed"
        job.error_message = str(exc)
        job.completed_at  = datetime.utcnow()
        db.commit()

        log.error(f"  ✗ {filename}: {exc}")

        # Move to failed folder
        FAILED_DIR.mkdir(exist_ok=True)
        dest = FAILED_DIR / f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{filename}"
        shutil.move(str(filepath), str(dest))
    finally:
        db.close()


def scan_and_process() -> None:
    """Scan the watch folder for new files and process each one."""
    if not WATCH_DIR.exists():
        WATCH_DIR.mkdir(parents=True)
        return

    files = sorted(
        [f for f in WATCH_DIR.iterdir()
         if f.is_file() and f.suffix.lower() in SUPPORTED_EXT],
        key=lambda f: f.stat().st_mtime
    )

    if files:
        log.info(f"Found {len(files)} file(s) to process")

    for f in files:
        # Wait until file is fully written (size stable for 1 s)
        try:
            size1 = f.stat().st_size
            time.sleep(1)
            size2 = f.stat().st_size
            if size1 != size2:
                log.info(f"  Skipping {f.name} — still being written")
                continue
        except FileNotFoundError:
            continue
        process_file(f)


def main() -> None:
    log.info("=" * 60)
    log.info("  Voter Data System — Auto-Import Watcher")
    log.info("=" * 60)
    log.info(f"  Watch folder : {WATCH_DIR.resolve()}")
    log.info(f"  Done folder  : {DONE_DIR.resolve()}")
    log.info(f"  Failed folder: {FAILED_DIR.resolve()}")
    log.info(f"  Scan interval: {INTERVAL}s")
    log.info(f"  Formats      : {', '.join(sorted(SUPPORTED_EXT))}")
    log.info("=" * 60)

    # Ensure DB is ready
    init_db()
    WATCH_DIR.mkdir(parents=True, exist_ok=True)

    log.info(f"Watching {WATCH_DIR.resolve()} — drop files here to auto-import")

    while True:
        try:
            scan_and_process()
        except KeyboardInterrupt:
            log.info("Watcher stopped.")
            break
        except Exception as exc:
            log.error(f"Watcher error: {exc}")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
