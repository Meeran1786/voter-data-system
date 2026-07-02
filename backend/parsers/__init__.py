"""
Voter data parsers — dispatches to the correct parser based on file extension.
"""

import re
from pathlib import Path
from typing import List, Dict, Any

# Column name aliases — maps various header spellings → canonical field names
COLUMN_ALIASES: Dict[str, str] = {
    # voter_id / epic_no
    "voter id": "voter_id", "voter_id": "voter_id", "epic no": "voter_id",
    "epic_no": "voter_id", "epic number": "voter_id", "card no": "voter_id",
    "elector no": "voter_id", "electoral roll no": "voter_id",

    # full_name
    "name": "full_name", "full name": "full_name", "elector name": "full_name",
    "voter name": "full_name", "elector's name": "full_name",

    # father_or_husband_name
    "father name": "father_or_husband_name", "father's name": "father_or_husband_name",
    "husband name": "father_or_husband_name", "husband's name": "father_or_husband_name",
    "relation name": "father_or_husband_name", "guardian name": "father_or_husband_name",
    "father/husband name": "father_or_husband_name",

    # bilingual / regional-script names (columns in scanned/exported rolls)
    "name (regional)": "full_name_regional", "elector name (regional)": "full_name_regional",
    "name regional": "full_name_regional", "vernacular name": "full_name_regional",
    "relation name (regional)": "father_or_husband_name_regional",

    # relation_type — ECI column header is "Rln Type"
    "rln type": "relation_type", "rln_type": "relation_type",
    "relation type": "relation_type", "relationship type": "relation_type",

    # section_no — appears in ECI rolls between part_no and serial_no
    "section no": "section_no", "section_no": "section_no",
    "section number": "section_no", "sec no": "section_no",

    # age
    "age": "age",

    # gender
    "gender": "gender", "sex": "gender",

    # geography
    "state": "state", "state name": "state",
    "district": "district", "district name": "district",
    "parliamentary constituency": "parliamentary_constituency",
    "pc": "parliamentary_constituency", "lok sabha constituency": "parliamentary_constituency",
    "assembly constituency": "assembly_constituency",
    "ac": "assembly_constituency", "vidhan sabha constituency": "assembly_constituency",
    "assembly constituency no": "assembly_constituency_no",
    "ac no": "assembly_constituency_no", "ac number": "assembly_constituency_no",

    # polling unit
    "part no": "part_no", "part number": "part_no", "booth no": "part_no",
    "part name": "part_name", "booth name": "part_name",
    "serial no": "serial_no", "sr no": "serial_no", "sl no": "serial_no",
    "polling station no": "polling_station_no", "ps no": "polling_station_no",
    "polling station": "polling_station_name", "polling station name": "polling_station_name",
    "booth": "polling_station_name",

    # address
    "house no": "house_door_no", "house door no": "house_door_no",
    "door no": "house_door_no", "house number": "house_door_no",
    "address": "house_door_no",
}

CANONICAL_FIELDS = {
    "voter_id", "full_name", "father_or_husband_name", "age", "gender",
    "full_name_regional", "father_or_husband_name_regional", "relation_type",
    "state", "district", "parliamentary_constituency", "assembly_constituency",
    "assembly_constituency_no", "section_no", "part_no", "part_name", "serial_no",
    "polling_station_no", "polling_station_name", "house_door_no",
}


def normalize_header(raw: str) -> str:
    """Lowercase + strip → canonical field name lookup."""
    cleaned = re.sub(r"[_\-]+", " ", raw.lower().strip())
    return COLUMN_ALIASES.get(cleaned, cleaned)


def clean_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalise a raw parsed dict into the canonical voter schema.
    Converts numeric fields, strips whitespace, drops empty strings.
    """
    cleaned: Dict[str, Any] = {}
    for raw_key, value in record.items():
        canon = normalize_header(str(raw_key))
        if canon not in CANONICAL_FIELDS:
            continue  # drop unknown columns
        if value is None:
            continue
        str_val = str(value).strip()
        if str_val in ("", "nan", "NaN", "None", "-", "N/A"):
            continue
        # Cast numeric fields
        if canon in ("age", "section_no", "part_no", "serial_no", "polling_station_no",
                     "assembly_constituency_no"):
            try:
                cleaned[canon] = int(float(str_val))
            except (ValueError, TypeError):
                pass  # leave out if unparseable
        else:
            cleaned[canon] = str_val
    return cleaned


def dispatch_parser(file_path: Path, source_format: str) -> List[Dict[str, Any]]:
    """Route a file to the appropriate parser and return clean records."""
    fmt = source_format.lower()

    if fmt == "csv":
        from parsers.csv_parser import parse_csv
        records = parse_csv(file_path)
    elif fmt in ("xlsx", "xls"):
        from parsers.excel_parser import parse_excel
        records = parse_excel(file_path)
    elif fmt in ("docx", "doc"):
        from parsers.docx_parser import parse_docx
        records = parse_docx(file_path)
    elif fmt == "pdf":
        from parsers.pdf_parser import parse_pdf
        records = parse_pdf(file_path)
    elif fmt in ("png", "jpg", "jpeg", "tiff", "bmp", "webp"):
        from parsers.ocr_parser import parse_image
        records = parse_image(file_path)
    else:
        raise ValueError(f"Unsupported format: {fmt}")

    return [clean_record(r) for r in records if r]
