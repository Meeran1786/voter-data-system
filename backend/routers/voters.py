"""
Voter search and filter endpoints.
Full-text search uses cross-field ILIKE queries — compatible with both
SQLite (local dev) and PostgreSQL (Neon / Render production).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from database import get_db
from models import Voter
from schemas import VoterRead, PaginatedVoterResponse, FilterOptions

router = APIRouter()

SORTABLE_COLUMNS = {
    "full_name", "voter_id", "state", "district", "assembly_constituency",
    "part_no", "section_no", "serial_no", "age", "created_at",
}

# Fields searched when the user types in the global search box
_FTS_FIELDS = [
    Voter.voter_id,
    Voter.full_name,
    Voter.father_or_husband_name,
    Voter.house_door_no,
    Voter.polling_station_name,
    Voter.part_name,
    Voter.district,
    Voter.assembly_constituency,
]


def _apply_text_search(query, q: str):
    """
    Cross-database full-text search using ILIKE.
    Each space-separated term must appear in at least one of the searched fields.
    Works with SQLite (local) and PostgreSQL (Neon/Render).
    """
    terms = [t for t in q.strip().split() if len(t) >= 2][:8]  # max 8 terms
    for term in terms:
        pattern = f"%{term}%"
        query = query.filter(or_(*[col.ilike(pattern) for col in _FTS_FIELDS]))
    return query


@router.get("/search", response_model=PaginatedVoterResponse)
async def search_voters(
    q: Optional[str] = Query(None, description="Full-text search"),
    voter_id: Optional[str] = Query(None),
    full_name: Optional[str] = Query(None),
    father_or_husband_name: Optional[str] = Query(None),
    relation_type: Optional[str] = Query(None, description="O / H / F / S"),
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    parliamentary_constituency: Optional[str] = Query(None),
    assembly_constituency: Optional[str] = Query(None),
    section_no: Optional[int] = Query(None),
    part_no: Optional[int] = Query(None),
    polling_station_no: Optional[int] = Query(None),
    gender: Optional[str] = Query(None),
    age_min: Optional[int] = Query(None),
    age_max: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: str = Query("serial_no"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    """
    Search voters with any combination of filters.
    `q` triggers FTS5 full-text search. All other params are AND-combined filters.
    """
    query = db.query(Voter)

    # ── Full-text search (ILIKE across key fields) ──
    if q and q.strip():
        query = _apply_text_search(query, q.strip())

    # ── Field filters ──
    filters = []
    if voter_id:
        filters.append(Voter.voter_id.ilike(f"%{voter_id}%"))
    if full_name:
        filters.append(Voter.full_name.ilike(f"%{full_name}%"))
    if father_or_husband_name:
        filters.append(Voter.father_or_husband_name.ilike(f"%{father_or_husband_name}%"))
    if relation_type:
        filters.append(Voter.relation_type.ilike(f"{relation_type}%"))
    if state:
        filters.append(Voter.state.ilike(f"%{state}%"))
    if district:
        filters.append(Voter.district.ilike(f"%{district}%"))
    if parliamentary_constituency:
        filters.append(Voter.parliamentary_constituency.ilike(f"%{parliamentary_constituency}%"))
    if assembly_constituency:
        filters.append(Voter.assembly_constituency.ilike(f"%{assembly_constituency}%"))
    if section_no is not None:
        filters.append(Voter.section_no == section_no)
    if part_no is not None:
        filters.append(Voter.part_no == part_no)
    if polling_station_no is not None:
        filters.append(Voter.polling_station_no == polling_station_no)
    if gender:
        filters.append(Voter.gender.ilike(f"{gender}%"))
    if age_min is not None:
        filters.append(Voter.age >= age_min)
    if age_max is not None:
        filters.append(Voter.age <= age_max)

    if filters:
        query = query.filter(and_(*filters))

    # ── Sorting ──
    sort_col = sort_by if sort_by in SORTABLE_COLUMNS else "serial_no"
    col = getattr(Voter, sort_col, Voter.serial_no)
    query = query.order_by(col.desc() if sort_order == "desc" else col.asc())

    # ── Pagination ──
    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    offset = (page - 1) * page_size
    voters = query.offset(offset).limit(page_size).all()

    # ── Context for the header banner ──
    ac_ctx: Optional[str] = None
    ps_ctx: Optional[int] = None
    if voters:
        ac_ctx = voters[0].assembly_constituency
        ps_ctx = voters[0].polling_station_no

    return PaginatedVoterResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        results=[VoterRead.model_validate(v) for v in voters],
        assembly_constituency_context=ac_ctx,
        ps_no_context=ps_ctx,
    )


@router.get("/filter-options", response_model=FilterOptions)
async def get_filter_options(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return distinct values for dropdown filter menus (cascading)."""

    def distinct_vals(col, *conditions):
        q = db.query(col).filter(col.isnot(None)).filter(col != "")
        for cond in conditions:
            q = q.filter(cond)
        return sorted([r[0] for r in q.distinct().all()])

    state_filter = Voter.state.ilike(f"%{state}%") if state else None
    district_filter = Voter.district.ilike(f"%{district}%") if district else None
    conds_for_district = [state_filter] if state_filter else []
    conds_for_pc = [f for f in [state_filter, district_filter] if f]

    return FilterOptions(
        states=distinct_vals(Voter.state),
        districts=distinct_vals(Voter.district, *conds_for_district),
        parliamentary_constituencies=distinct_vals(Voter.parliamentary_constituency, *conds_for_pc),
        assembly_constituencies=distinct_vals(Voter.assembly_constituency, *conds_for_pc),
    )


@router.get("/{voter_id_or_id}", response_model=VoterRead)
async def get_voter(voter_id_or_id: str, db: Session = Depends(get_db)):
    """Fetch a single voter by EPIC number or internal database ID."""
    voter = db.query(Voter).filter(Voter.voter_id.ilike(voter_id_or_id)).first()
    if not voter and voter_id_or_id.isdigit():
        voter = db.query(Voter).filter(Voter.id == int(voter_id_or_id)).first()
    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found")
    return VoterRead.model_validate(voter)
