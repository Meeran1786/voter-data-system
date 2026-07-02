"""
Pydantic schemas for request validation and API response serialization.
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# ─── Voter Schemas ───────────────────────────────────────────────────────────

class VoterBase(BaseModel):
    voter_id: Optional[str] = None

    # Personal details — English
    full_name: str
    father_or_husband_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None

    # Bilingual regional-script names (Telugu / Hindi / Tamil / etc.)
    full_name_regional: Optional[str] = None
    father_or_husband_name_regional: Optional[str] = None

    # Relation type: O = Other, H = Husband, F = Father, S = Self
    relation_type: Optional[str] = None

    # Geography
    state: Optional[str] = None
    district: Optional[str] = None
    parliamentary_constituency: Optional[str] = None
    assembly_constituency: Optional[str] = None
    assembly_constituency_no: Optional[int] = None

    # Polling unit
    section_no: Optional[int] = None
    part_no: Optional[int] = None
    part_name: Optional[str] = None
    serial_no: Optional[int] = None
    polling_station_no: Optional[int] = None
    polling_station_name: Optional[str] = None

    # Address
    house_door_no: Optional[str] = None


class VoterCreate(VoterBase):
    source_file: Optional[str] = None
    source_format: Optional[str] = None


class VoterRead(VoterBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_file: Optional[str] = None
    source_format: Optional[str] = None
    created_at: Optional[datetime] = None


# ─── Search / Filter Schemas ─────────────────────────────────────────────────

class VoterSearchParams(BaseModel):
    """All fields optional; combined with AND logic."""
    q: Optional[str] = Field(None, description="Full-text search")
    voter_id: Optional[str] = None
    full_name: Optional[str] = None
    father_or_husband_name: Optional[str] = None
    relation_type: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    parliamentary_constituency: Optional[str] = None
    assembly_constituency: Optional[str] = None
    section_no: Optional[int] = None
    part_no: Optional[int] = None
    polling_station_no: Optional[int] = None
    gender: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None

    # Pagination
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=500)

    # Sorting
    sort_by: str = Field("serial_no", description="Column to sort by")
    sort_order: str = Field("asc", pattern="^(asc|desc)$")


class PaginatedVoterResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    results: List[VoterRead]
    # Context fields for the constituency header banner
    assembly_constituency_context: Optional[str] = None
    ps_no_context: Optional[int] = None


# ─── Upload Job Schemas ───────────────────────────────────────────────────────

class UploadJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    file_format: str
    file_size_bytes: Optional[int] = None
    status: str
    records_parsed: int
    records_inserted: int
    records_skipped: int
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


# ─── Filter Options (for dropdowns) ──────────────────────────────────────────

class FilterOptions(BaseModel):
    states: List[str]
    districts: List[str]
    parliamentary_constituencies: List[str]
    assembly_constituencies: List[str]
