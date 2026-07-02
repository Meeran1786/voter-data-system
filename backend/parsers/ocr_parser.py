"""
OCR parser for scanned voter rolls (image files and image-PDF pages).

Handles the ECI (Election Commission of India) standard electoral roll format:
  - 3-column grid layout per page (Name fields appear at ~3%, 35%, 67% of page width)
  - Each voter card: Name, Father/Mother/Husband name, House No, Age, Gender, EPIC No
  - Page header: Assembly Constituency, Part No, Section No

Language:
  Override via TESSDATA_LANGS env var — e.g. "eng+hin+tel"

Dependencies:
  - Tesseract OCR  (system: apt install tesseract-ocr)
  - pytesseract    (pip install pytesseract)
  - pdf2image      (pip install pdf2image; needs poppler-utils)
  - Pillow         (pip install Pillow)
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

from PIL import Image, ImageFilter, ImageEnhance

TESS_LANG   = os.getenv("TESSDATA_LANGS", "eng")
USE_EASYOCR = os.getenv("USE_EASYOCR", "false").lower() == "true"

# Field labels that mark the START of a new field — used to stop value extraction
_FIELD_LABEL = re.compile(
    r'\b(?:Name\.?\s*:'
    r'|Fathers?\s+Name'
    r'|Mothers?\s+Name'
    r'|Husbands?\s+Name'
    r'|Others?\s*:'
    r'|House\s+(?:No\.?|Number)'
    r'|Age\s*[:\-]'
    r'|Gender\s*[:\-]'
    r'|Photo\b'
    r'|Available\b)',
    re.I,
)


def _clean_value(raw: str) -> str:
    """Truncate a field value at the first following field label.
    Prevents OCR column-bleed from embedding adjacent voter's data.
    """
    m = _FIELD_LABEL.search(raw)
    if m and m.start() > 0:
        raw = raw[: m.start()]
    return raw.strip().rstrip(",|/.")


# ─── Image Preprocessing ──────────────────────────────────────────────────────

def _preprocess(img: Image.Image) -> Image.Image:
    """Greyscale → upscale if small → sharpen → high contrast."""
    img = img.convert("L")
    w, h = img.size
    if w < 900:
        scale = 900 / w
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(2.0)
    return img


# ─── OCR Engines ─────────────────────────────────────────────────────────────

def _ocr_tesseract(img: Image.Image) -> str:
    import pytesseract
    # PSM 6 = treat image as a single uniform block of text
    # (best after we pre-split into single columns)
    return pytesseract.image_to_string(
        img, lang=TESS_LANG, config="--oem 3 --psm 6"
    )


def _ocr_easyocr(img: Image.Image) -> str:
    import easyocr, numpy as np
    reader = easyocr.Reader(["en"], gpu=False)
    return "\n".join(reader.readtext(np.array(img), detail=0, paragraph=True))


def _ocr_image(img: Image.Image) -> str:
    return _ocr_easyocr(_preprocess(img)) if USE_EASYOCR else _ocr_tesseract(_preprocess(img))


# ─── Page-level metadata extraction ──────────────────────────────────────────

def _extract_page_meta(text: str) -> Dict[str, Any]:
    """Pull constituency / part / section info from the page header text."""
    meta: Dict[str, Any] = {}

    # "Assembly Constituency No and Name : 57-MUSHEERABAD & Part No.:5"
    # or "Assembly Constituency No and Name : 57-MUSHEERABAD FE Part No.:5"
    # Capture AC number and name — stop at any non-alpha/space char (e.g. "&", "|")
    m = re.search(
        r"Assembly\s+Constituency\s+No\s+and\s+Name\s*[:\-]\s*(\d+)[- ]+(.+)",
        text[:1200], re.I,
    )
    if m:
        try:
            meta["assembly_constituency_no"] = int(m.group(1))
        except ValueError:
            pass
        # Extract just the alpha-space portion (stops at "&", "|", digits, etc.)
        raw_ac = m.group(2).strip()
        ac_m = re.match(r"([A-Za-z][A-Za-z ]*)", raw_ac)
        if ac_m:
            ac_name = ac_m.group(1).strip()
            # Strip trailing 2-3 char OCR artifacts like "FE", "PE", "SE"
            ac_name = re.sub(r"\s+[A-Z]{1,3}\s*$", "", ac_name).strip()
            if len(ac_name) >= 3:
                meta["assembly_constituency"] = ac_name

    # "Part No.:5"
    m = re.search(r"Part\s*No\.?\s*[:\-]?\s*(\d+)", text[:1200], re.I)
    if m:
        try:
            meta["part_no"] = int(m.group(1))
        except ValueError:
            pass

    # "Section No and Name 1-Icici Bank"
    m = re.search(r"Section\s+No\s+and\s+Name\s+(\d+)[- ]+(.+?)(?:\n|$)", text[:1200], re.I)
    if m:
        try:
            meta["section_no"] = int(m.group(1))
        except ValueError:
            pass
        meta["polling_station_name"] = _clean_value(m.group(2).strip())

    return meta


# ─── Single voter block parser ────────────────────────────────────────────────

def _fix_epic(s: str) -> str:
    """Fix common OCR letter→digit misreads in EPIC numbers.
    The first 3 chars are state/district alpha code; digits follow.
    """
    prefix = s[:3]  # e.g. "RXA"
    rest = s[3:].translate(str.maketrans("QOILS", "00115"))
    return prefix + rest


def _parse_voter_block(block: str, page_meta: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Extract one voter record from a text block that starts with 'Name :'.
    _clean_value() stops each field at the next label to handle column bleed.
    EPICs in ECI rolls appear on a standalone line AFTER the Age/Gender line.
    """
    record = dict(page_meta)

    # ── Name ──────────────────────────────────────────────────────────────────
    m = re.search(r"Name\.?\s*:\s*(.+?)(?:\n|$)", block, re.I)
    if not m:
        return None
    candidate = _clean_value(m.group(1).strip())

    if re.search(r"(?:Section|Constituency|Part)\s+No", candidate, re.I):
        return None
    if len(candidate) < 3 or len(candidate) > 80:
        return None
    if re.match(r"^\d+[- ]", candidate):  # "57-MUSHEERABAD" from AC header
        return None

    record["full_name"] = candidate

    # ── Relation type + relative's name ───────────────────────────────────────
    for pat_str, rel_code in [
        (r"Fathers?\s*Name\s*:\s*(.+?)(?:\n|$)",  "F"),
        (r"Mothers?\s*Name\s*:\s*(.+?)(?:\n|$)",  "M"),
        (r"Husbands?\s*Name\s*:\s*(.+?)(?:\n|$)", "H"),
        (r"Others?\s*:\s*(.+?)(?:\n|$)",           "O"),
    ]:
        m2 = re.search(pat_str, block, re.I)
        if m2:
            record["father_or_husband_name"] = _clean_value(m2.group(1).strip())
            record["relation_type"] = rel_code
            break

    # ── House / Door number ───────────────────────────────────────────────────
    m2 = re.search(r"House\s+(?:No\.?|Number)\s*[:\-]?\s*(.+?)(?:\n|$)", block, re.I)
    if m2:
        record["house_door_no"] = _clean_value(m2.group(1).strip())

    # ── Age ───────────────────────────────────────────────────────────────────
    m2 = re.search(r"\bAge\.?\s*[:\-]\s*(\d{1,3})", block, re.I)
    if m2:
        try:
            record["age"] = int(m2.group(1))
        except ValueError:
            pass

    # ── Gender ────────────────────────────────────────────────────────────────
    m2 = re.search(r"Gender\s*[:\-]\s*(Male|Female|Transgender|M|F|T)\b", block, re.I)
    if m2:
        g = m2.group(1).strip().upper()
        record["gender"] = {"M": "Male", "F": "Female", "T": "Transgender"}.get(g, m2.group(1).capitalize())

    # ── EPIC number ───────────────────────────────────────────────────────────
    # EPIC appears near the end of the voter block, on its own line.
    # OCR often adds garbage before it (e.g. "[a RXAT672766") so we allow
    # up to 15 non-EPIC characters at the start of the line.
    # Pattern: 2-5 uppercase alpha prefix + 1 more alphanum + 5-9 digits (total 8-15 chars)
    m2 = re.search(r"(?m)^.{0,15}?([A-Z]{2,5}[A-Z0-9]\d{5,9})\s*$", block)
    if m2:
        record["voter_id"] = _fix_epic(m2.group(1))

    return record


# ─── Text → list of voter records ────────────────────────────────────────────

def _text_to_records(text: str) -> List[Dict[str, Any]]:
    """
    Parse OCR text from a SINGLE column strip into voter records.

    Splitting strategy: insert a null-byte marker before every line that
    starts with 'Name :' (standalone voter name label).
    Lines like 'Fathers Name:', 'Mothers Name:' start with 'Fathers'/'Mothers'
    so they are NOT at line-start 'Name :' — they are NOT split points.
    """
    # Do NOT extract page metadata from column text — the full-width page header
    # is not reliably captured in a narrow column strip. Metadata (AC, Part No,
    # Section) is extracted from the full-page thumbnail in _ocr_eci_page and
    # applied there via setdefault, which correctly overrides an empty dict here.
    page_meta: Dict[str, Any] = {}

    # Mark voter-block boundaries: lines that begin with "Name :" (or "Name. :")
    # (?m) = multiline; ^ = true line start; \.? handles OCR period artifact
    marked = re.sub(r"(?m)^(Name\.?\s*:)", "\x00\\1", text)
    blocks = marked.split("\x00")

    records: List[Dict[str, Any]] = []
    for block in blocks:          # blocks[0] is pre-first-voter content (header)
        voter = _parse_voter_block(block, page_meta)
        if voter:
            records.append(voter)

    return records


# ─── Full-page OCR with 3-column splitting ───────────────────────────────────

def _ocr_eci_page(page_img: Image.Image) -> List[Dict[str, Any]]:
    """
    OCR a single ECI electoral roll page.

    ECI pages have a 3-column voter-card grid.  We split the image into
    3 vertical strips and OCR each with PSM 6 (single text block), which
    avoids the cross-column line-mixing that happens with PSM 3 on the
    full page.

    Column x-boundaries (empirically verified from bounding-box analysis):
      Col 1:  0%  – 33.5%
      Col 2: 33.5%– 67%
      Col 3: 67%  – 100%
    """
    w, h = page_img.size

    # ── Full-page thumbnail: skip check + metadata extraction ─────────────────
    # The page header spans the FULL WIDTH, so we must OCR the full width
    # to reliably capture "Assembly Constituency No and Name : 57-MUSHEERABAD".
    # A 900px-wide thumbnail is fast and has enough resolution for the header text.
    thumb_w = 900
    thumb = page_img.resize((thumb_w, int(thumb_w * h / w)))
    thumb_text = _ocr_tesseract(_preprocess(thumb))

    # Skip pages with very little text (cover page, map/sketch page)
    if len(thumb_text.split()) < 25:
        return []

    page_meta = _extract_page_meta(thumb_text)

    # ── Split into 3 columns for voter-record extraction ─────────────────────
    x1 = int(w * 0.335)
    x2 = int(w * 0.670)

    col1_img = page_img.crop((0,  0, x1, h))
    col2_img = page_img.crop((x1, 0, x2, h))
    col3_img = page_img.crop((x2, 0, w,  h))

    # OCR each column with PSM 6 (single text block — correct for a single column)
    col1_text = _ocr_image(col1_img)
    col2_text = _ocr_image(col2_img)
    col3_text = _ocr_image(col3_img)

    # Parse voter records from all three columns
    records: List[Dict[str, Any]] = []
    for col_text in (col1_text, col2_text, col3_text):
        for voter in _text_to_records(col_text):
            # Fill in page-level metadata fields (AC, Part No, Section) from thumbnail
            for k, val in page_meta.items():
                voter.setdefault(k, val)
            records.append(voter)

    return records


# ─── Public API ───────────────────────────────────────────────────────────────

def parse_image(file_path: Path) -> List[Dict[str, Any]]:
    """OCR a single standalone image file (PNG, JPG, TIFF, BMP, WEBP)."""
    img = Image.open(str(file_path))
    return _ocr_eci_page(img)


def parse_scanned_pdf(file_path: Path) -> List[Dict[str, Any]]:
    """
    Convert every page of a scanned PDF to an image, OCR with 3-column
    splitting, and return all extracted voter records.

    Pages are processed ONE AT A TIME to keep RAM usage low — loading all
    pages at once at 200 DPI can exceed 1 GB for a 35-page roll.

    Requires poppler-utils:  apt install poppler-utils
    Set OCR_DPI env var to control resolution (default 150).
    """
    from pdf2image import convert_from_path
    from pdf2image.exceptions import PDFInfoNotInstalledError

    dpi = int(os.getenv("OCR_DPI", "150"))

    # Count pages using pdfinfo (fast, doesn't load images)
    try:
        from pdf2image.pdf2image import pdfinfo_from_path
        info = pdfinfo_from_path(str(file_path))
        num_pages = int(info.get("Pages", 0))
    except Exception:
        # Fallback: try pypdf for page count
        try:
            from pypdf import PdfReader
            num_pages = len(PdfReader(str(file_path)).pages)
        except Exception:
            num_pages = 50  # safe upper bound; empty pages are skipped anyway

    records: List[Dict[str, Any]] = []
    for page_num in range(1, num_pages + 1):
        try:
            # Load exactly one page — frees memory before loading the next
            imgs = convert_from_path(
                str(file_path), dpi=dpi,
                first_page=page_num, last_page=page_num,
            )
            if imgs:
                records.extend(_ocr_eci_page(imgs[0]))
                del imgs  # release PIL image RAM immediately
        except Exception:
            continue   # skip unreadable pages rather than aborting the whole upload

    return records
