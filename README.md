# Indian Voter Data Management System

A lightweight, modern web application for parsing, indexing, searching, and exporting Indian Electoral Roll data across all official formats.

---

## Architecture

```
voter-data-system/
├── backend/                   # Python FastAPI + SQLite
│   ├── main.py                # FastAPI app & lifespan
│   ├── database.py            # SQLite + SQLAlchemy + FTS5 setup
│   ├── models.py              # ORM models (Voter, UploadJob)
│   ├── schemas.py             # Pydantic request/response schemas
│   ├── requirements.txt
│   ├── .env.example
│   ├── parsers/
│   │   ├── __init__.py        # Dispatcher + column normaliser
│   │   ├── csv_parser.py      # Auto-encoding CSV parser
│   │   ├── excel_parser.py    # XLSX + XLS (merged headers)
│   │   ├── docx_parser.py     # Tables + paragraph-layout DOCX
│   │   ├── pdf_parser.py      # pdfplumber — ECI block & tabular PDFs
│   │   └── ocr_parser.py      # Tesseract/EasyOCR for scanned files
│   └── routers/
│       ├── voters.py          # FTS5 search, filter options, single voter
│       ├── upload.py          # Async file upload + background ingestion
│       └── export.py          # XLSX (openpyxl) + PDF (reportlab) export
│
└── frontend/                  # Next.js 14 + TailwindCSS
    ├── app/
    │   ├── layout.tsx          # Root layout (Noto Sans / Devanagari fonts)
    │   ├── page.tsx            # Main dashboard
    │   └── globals.css
    ├── components/
    │   ├── SearchPanel.tsx     # Global search + advanced filter panel
    │   ├── VoterTable.tsx      # Sortable, paginated data table
    │   ├── VoterCard.tsx       # Digital Voter ID card (print/share)
    │   ├── UploadModal.tsx     # Drag-drop upload with job status polling
    │   └── ExportButton.tsx    # XLSX / PDF export dropdown
    ├── lib/api.ts              # Typed API client
    └── types/voter.ts          # TypeScript interfaces
```

---

## Quick Start

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# (Optional) OCR support — install system packages
# Ubuntu/Debian:
# sudo apt install tesseract-ocr tesseract-ocr-hin poppler-utils
# macOS:
# brew install tesseract tesseract-lang poppler

# Copy and edit env file
cp .env.example .env

# Run the API server
uvicorn backend.main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/docs**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

---

## Supported File Formats

| Format | Notes |
|--------|-------|
| `.csv` | Auto-detects encoding (UTF-8, ISO-8859-1, Windows-1252). Sniffs delimiter (`,` `;` `\t` `\|`). |
| `.xlsx` / `.xls` | Handles merged header cells, multi-row headers, multiple sheets. |
| `.docx` / `.doc` | Table-layout and paragraph-block formats. |
| `.pdf` (native) | ECI standard 3-column block layout and tabular layouts via pdfplumber. |
| `.pdf` (scanned) | Auto-detected when no text layer found → OCR via Tesseract. |
| `.png` / `.jpg` / `.tiff` | Direct OCR with preprocessing (upscale, sharpen, binarise). |

---

## Data Schema

Every record is normalised to the following fields:

| Field | Description |
|-------|-------------|
| `voter_id` | EPIC number (e.g. `DL/04/101/123456`) |
| `full_name` | Elector's name |
| `father_or_husband_name` | Relation name |
| `age` | Age in years |
| `gender` | Male / Female / Transgender |
| `state` | State name |
| `district` | District name |
| `parliamentary_constituency` | Lok Sabha constituency |
| `assembly_constituency` | Vidhan Sabha constituency |
| `assembly_constituency_no` | AC number |
| `part_no` | Electoral part number |
| `part_name` | Part/booth name |
| `serial_no` | Serial number within the part |
| `polling_station_no` | Polling station number |
| `polling_station_name` | Polling station name |
| `house_door_no` | House/door number |

---

## OCR Language Support

Default: `eng+hin`. Set `TESSDATA_LANGS` in `.env` to add regional scripts:

```
TESSDATA_LANGS=eng+hin+tam+tel+kan+mal+ben+guj+pan+ori+asm
```

Install corresponding Tesseract language packs:
```bash
sudo apt install tesseract-ocr-tam tesseract-ocr-tel tesseract-ocr-kan \
                 tesseract-ocr-mal tesseract-ocr-ben tesseract-ocr-guj
```

For higher accuracy on regional scripts, enable EasyOCR: `USE_EASYOCR=true`

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/voters/search` | Full-text + filter search with pagination |
| `GET` | `/api/voters/filter-options` | Distinct values for dropdown menus |
| `GET` | `/api/voters/{id}` | Single voter by EPIC or DB ID |
| `POST` | `/api/upload/` | Upload a voter roll file |
| `GET` | `/api/upload/jobs` | List upload jobs |
| `GET` | `/api/upload/jobs/{id}` | Poll job status |
| `GET` | `/api/export/xlsx` | Export filtered records as Excel |
| `GET` | `/api/export/pdf` | Export filtered records as PDF |
