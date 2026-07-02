"""
DOCX voter roll parser.
Indian electoral rolls in Word format use either tables or structured paragraphs.
This parser handles both layouts.
"""

import re
from pathlib import Path
from typing import List, Dict, Any

from docx import Document
from docx.table import Table


# Regex patterns for key fields found in paragraph-format rolls
PATTERNS = {
    "voter_id":              re.compile(r"(?:EPIC No|Voter ID|Card No)[.\s:]+([A-Z]{3,5}\d{7,10})", re.I),
    "full_name":             re.compile(r"(?:Name of Elector|Name|Elector's Name)[.\s:]+([^\n\r]+)", re.I),
    "father_or_husband_name": re.compile(r"(?:Father['']s|Husband['']s|Relation) Name[.\s:]+([^\n\r]+)", re.I),
    "house_door_no":         re.compile(r"(?:House No|Door No|H\.No)[.\s:]+([^\n\r,]+)", re.I),
    "age":                   re.compile(r"\bAge[.\s:]+(\d{1,3})\b", re.I),
    "gender":                re.compile(r"\b(?:Gender|Sex)[.\s:]+(Male|Female|Transgender|M|F|T)\b", re.I),
    "serial_no":             re.compile(r"(?:Serial No|Sl\. No|Sr\. No)[.\s:]+(\d+)", re.I),
    "part_no":               re.compile(r"(?:Part No)[.\s:]+(\d+)", re.I),
    "polling_station_name":  re.compile(r"(?:Polling Station|Booth)[.\s:]+([^\n\r]+)", re.I),
}


def _parse_table(table: Table) -> List[Dict[str, Any]]:
    """Extract records from a Word table (each row = one voter or header)."""
    rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
    if not rows:
        return []

    # First non-empty row is the header
    header = rows[0]
    records = []
    for row in rows[1:]:
        if not any(row):
            continue
        record = {header[i]: row[i] for i in range(min(len(header), len(row)))}
        records.append(record)
    return records


def _parse_paragraphs(doc: Document) -> List[Dict[str, Any]]:
    """
    Extract records from paragraph-based electoral rolls.
    Each voter record is a block of paragraphs separated by blank lines.
    """
    full_text = "\n".join(p.text for p in doc.paragraphs)
    # Split on 2+ blank lines (section separator in many ECI rolls)
    blocks = re.split(r"\n{2,}", full_text)

    records = []
    for block in blocks:
        if len(block.strip()) < 20:
            continue  # too short to be a voter record
        record: Dict[str, Any] = {}
        for field, pattern in PATTERNS.items():
            m = pattern.search(block)
            if m:
                record[field] = m.group(1).strip()
        if record.get("full_name") or record.get("voter_id"):
            records.append(record)
    return records


def parse_docx(file_path: Path) -> List[Dict[str, Any]]:
    doc = Document(str(file_path))
    records: List[Dict[str, Any]] = []

    # Try tables first (preferred format)
    for table in doc.tables:
        rows = _parse_table(table)
        records.extend(rows)

    # If no table records, fall back to paragraph parsing
    if not records:
        records = _parse_paragraphs(doc)

    return records
