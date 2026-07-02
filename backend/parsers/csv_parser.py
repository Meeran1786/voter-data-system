"""
CSV voter roll parser with auto-encoding detection.
"""

import csv
from pathlib import Path
from typing import List, Dict, Any

import chardet


def detect_encoding(path: Path) -> str:
    """Detect file encoding using chardet (handles ISO-8859-1 govt files)."""
    raw = path.read_bytes()[:10_000]
    result = chardet.detect(raw)
    return result.get("encoding") or "utf-8"


def parse_csv(file_path: Path) -> List[Dict[str, Any]]:
    """
    Parse a CSV electoral roll file.
    Handles:
    - Multiple encodings (UTF-8, UTF-8-BOM, ISO-8859-1, Windows-1252)
    - Files with extra blank header rows
    - Inconsistent quoting
    """
    encoding = detect_encoding(file_path)

    records: List[Dict[str, Any]] = []
    with open(file_path, encoding=encoding, errors="replace", newline="") as f:
        # Sniff delimiter (some govt CSVs use ; or |)
        sample = f.read(4096)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        except csv.Error:
            dialect = csv.excel  # type: ignore[assignment]

        reader = csv.DictReader(f, dialect=dialect)

        # Skip rows where all values are blank (common in Indian govt rolls)
        for row in reader:
            if any(v and str(v).strip() for v in row.values()):
                records.append(dict(row))

    return records
