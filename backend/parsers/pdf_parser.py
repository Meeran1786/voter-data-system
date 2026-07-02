"""
PDF voter roll parser using pdfplumber.

Indian Electoral Roll PDFs come in two common layouts:
  1. Multi-column block layout (ECI standard) — 3-4 voter cards per page
  2. Tabular layout — rows and columns with headers

This parser handles both. For scanned (image-only) PDFs, it detects the
absence of selectable text and delegates to the OCR parser.
"""

import re
from pathlib import Path
from typing import List, Dict, Any, Optional

import pdfplumber


# ECI voter card block patterns (English)
BLOCK_PATTERNS = {
    "serial_no":              re.compile(r"(?:Serial No\.?|Sl\.?\s*No\.?)\s*[:\-]?\s*(\d+)", re.I),
    "voter_id":               re.compile(r"(?:EPIC No\.?|Voter ID|Card No\.?)\s*[:\-]?\s*([A-Z]{3,5}\d{7,10})", re.I),
    "full_name":              re.compile(r"(?:Name of Elector|Elector['']s Name|Name)\s*[:\-]\s*(.+?)(?:\n|$)", re.I),
    "father_or_husband_name": re.compile(r"(?:Father['']s Name|Husband['']s Name|Relation Name)\s*[:\-]\s*(.+?)(?:\n|$)", re.I),
    "house_door_no":          re.compile(r"(?:House No\.?|Door No\.?|H\.No\.?)\s*[:\-]\s*(.+?)(?:\n|$)", re.I),
    "age":                    re.compile(r"\bAge\s*[:\-]\s*(\d{1,3})", re.I),
    "gender":                 re.compile(r"(?:Sex|Gender)\s*[:\-]\s*(Male|Female|Transgender|M|F|T)\b", re.I),
}

# Page-level metadata patterns
META_PATTERNS = {
    "state":                       re.compile(r"State\s*[:\-]\s*(.+?)(?:\n|$)", re.I),
    "district":                    re.compile(r"District\s*[:\-]\s*(.+?)(?:\n|$)", re.I),
    "assembly_constituency":       re.compile(r"(?:Assembly Constituency|Vidhan Sabha)\s*[:\-]\s*(.+?)(?:\n|$)", re.I),
    "parliamentary_constituency":  re.compile(r"(?:Parliamentary Constituency|Lok Sabha)\s*[:\-]\s*(.+?)(?:\n|$)", re.I),
    "part_no":                     re.compile(r"Part\s*No\.?\s*[:\-]\s*(\d+)", re.I),
    "part_name":                   re.compile(r"Part\s*Name\s*[:\-]\s*(.+?)(?:\n|$)", re.I),
    "polling_station_name":        re.compile(r"(?:Polling Station|Booth)\s*[:\-]\s*(.+?)(?:\n|$)", re.I),
    "polling_station_no":          re.compile(r"Polling\s*Station\s*No\.?\s*[:\-]\s*(\d+)", re.I),
}

# Block separator — ECI PDFs separate each voter card by a box/line
BLOCK_SEPARATOR = re.compile(r"-{10,}|_{10,}|={10,}")


def _extract_page_metadata(text: str) -> Dict[str, Any]:
    """Extract constituency/part metadata that appears at the top of each page."""
    meta: Dict[str, Any] = {}
    for field, pat in META_PATTERNS.items():
        m = pat.search(text[:800])  # header is in the first ~800 chars
        if m:
            val = m.group(1).strip()
            if field in ("part_no", "polling_station_no", "assembly_constituency_no"):
                try:
                    meta[field] = int(val)
                except ValueError:
                    meta[field] = val
            else:
                meta[field] = val
    return meta


def _parse_voter_block(block: str, page_meta: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parse a single voter card text block."""
    record = dict(page_meta)  # inherit page-level fields
    for field, pat in BLOCK_PATTERNS.items():
        m = pat.search(block)
        if m:
            val = m.group(1).strip()
            if field == "age":
                try:
                    record[field] = int(val)
                except ValueError:
                    pass
            else:
                record[field] = val

    # Require at minimum a name or EPIC number to be a valid record
    if not (record.get("full_name") or record.get("voter_id")):
        return None
    return record


def _parse_table_page(page) -> List[Dict[str, Any]]:
    """Extract tabular data from a page using pdfplumber's table extractor."""
    tables = page.extract_tables()
    records = []
    for table in tables:
        if not table or len(table) < 2:
            continue
        headers = [str(h).strip() if h else f"col_{i}" for i, h in enumerate(table[0])]
        for row in table[1:]:
            if not any(row):
                continue
            record = {headers[i]: row[i] for i in range(min(len(headers), len(row)))}
            records.append(record)
    return records


def parse_pdf(file_path: Path) -> List[Dict[str, Any]]:
    """
    Parse a native (text-layer) PDF electoral roll.
    Falls back to OCR parser if no text is detected.
    """
    records: List[Dict[str, Any]] = []

    with pdfplumber.open(str(file_path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""

            # Detect scanned page (no selectable text) → skip here, handled by OCR
            if len(text.strip()) < 50:
                continue

            page_meta = _extract_page_metadata(text)

            # First try table extraction (tabular layout PDFs)
            table_records = _parse_table_page(page)
            if table_records:
                for r in table_records:
                    merged = {**page_meta, **r}
                    records.append(merged)
                continue

            # Fall back to block-based parsing (ECI card-per-voter layout)
            # Split page into voter blocks using separator lines or double newlines
            blocks = BLOCK_SEPARATOR.split(text)
            if len(blocks) < 3:
                # No clear separators — try splitting on serial number patterns
                blocks = re.split(r"(?=(?:Serial No\.?|Sl\.?\s*No\.?)\s*[:\-]?\s*\d+)", text, flags=re.I)

            for block in blocks:
                voter = _parse_voter_block(block, page_meta)
                if voter:
                    records.append(voter)

    # If zero records and this might be a scanned PDF, try OCR
    if not records:
        try:
            from parsers.ocr_parser import parse_scanned_pdf
            records = parse_scanned_pdf(file_path)
        except ImportError:
            pass  # OCR not available

    return records
