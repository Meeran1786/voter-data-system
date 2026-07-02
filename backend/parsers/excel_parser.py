"""
Excel voter roll parser (xlsx / xls).
Handles merged header cells, multi-row headers, and multiple sheets.
"""

from pathlib import Path
from typing import List, Dict, Any

import openpyxl
import xlrd  # for legacy .xls


def _find_header_row(sheet, max_scan: int = 10) -> int:
    """
    Scan the first max_scan rows for the header row.
    Heuristic: row with the most non-empty string cells is the header.
    Returns 0-based row index.
    """
    best_row, best_count = 0, 0
    for i in range(min(max_scan, sheet.max_row if hasattr(sheet, "max_row") else max_scan)):
        if hasattr(sheet, "iter_rows"):  # openpyxl
            cells = [c.value for c in list(sheet.iter_rows(min_row=i + 1, max_row=i + 1))[0]]
        else:  # xlrd
            cells = sheet.row_values(i)
        count = sum(1 for c in cells if c and str(c).strip())
        if count > best_count:
            best_count, best_row = count, i
    return best_row


def parse_excel(file_path: Path) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    suffix = file_path.suffix.lower()

    if suffix == ".xlsx":
        records.extend(_parse_xlsx(file_path))
    elif suffix == ".xls":
        records.extend(_parse_xls(file_path))
    else:
        # Try xlsx first, fall back to xls
        try:
            records.extend(_parse_xlsx(file_path))
        except Exception:
            records.extend(_parse_xls(file_path))

    return records


def _parse_xlsx(file_path: Path) -> List[Dict[str, Any]]:
    """Parse .xlsx using openpyxl (handles merged cells, multiple sheets)."""
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    records: List[Dict[str, Any]] = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        all_rows = list(ws.iter_rows(values_only=True))
        if not all_rows:
            continue

        # Find header row
        header_idx = _find_header_row_from_list(all_rows)
        headers = [str(c).strip() if c is not None else f"col_{i}"
                   for i, c in enumerate(all_rows[header_idx])]

        for row in all_rows[header_idx + 1:]:
            if not any(c for c in row):
                continue
            record = {headers[i]: row[i] for i in range(min(len(headers), len(row)))}
            records.append(record)

    wb.close()
    return records


def _find_header_row_from_list(rows: list, max_scan: int = 10) -> int:
    best_row, best_count = 0, 0
    for i, row in enumerate(rows[:max_scan]):
        count = sum(1 for c in row if c is not None and str(c).strip())
        if count > best_count:
            best_count, best_row = count, i
    return best_row


def _parse_xls(file_path: Path) -> List[Dict[str, Any]]:
    """Parse legacy .xls using xlrd."""
    wb = xlrd.open_workbook(str(file_path))
    records: List[Dict[str, Any]] = []

    for sheet_idx in range(wb.nsheets):
        ws = wb.sheet_by_index(sheet_idx)
        all_rows = [ws.row_values(i) for i in range(ws.nrows)]
        if not all_rows:
            continue

        header_idx = _find_header_row_from_list(all_rows)
        headers = [str(c).strip() if c else f"col_{i}"
                   for i, c in enumerate(all_rows[header_idx])]

        for row in all_rows[header_idx + 1:]:
            if not any(row):
                continue
            record = {headers[i]: row[i] for i in range(min(len(headers), len(row)))}
            records.append(record)

    return records
