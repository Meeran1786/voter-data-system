"""
SQLAlchemy ORM models for the Indian Voter Data Management System.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Text, Index, UniqueConstraint
)
from sqlalchemy.sql import func
from database import Base


class Voter(Base):
    """Core voter record matching official Indian Electoral Roll schema."""
    __tablename__ = "voters"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Unique identifier — EPIC (Electors Photo Identity Card) number
    voter_id = Column(String(20), nullable=True, index=True)

    # Personal details — English
    full_name = Column(String(255), nullable=False)
    father_or_husband_name = Column(String(255), nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(10), nullable=True)  # M / F / T

    # Bilingual / regional-script names (Telugu, Hindi, Tamil, etc.)
    full_name_regional = Column(String(512), nullable=True)
    father_or_husband_name_regional = Column(String(512), nullable=True)

    # Relation type code matching ECI rolls: O=Other, H=Husband, F=Father, S=Self
    relation_type = Column(String(5), nullable=True)

    # Geographic hierarchy
    state = Column(String(100), nullable=True, index=True)
    district = Column(String(100), nullable=True, index=True)
    parliamentary_constituency = Column(String(200), nullable=True, index=True)
    assembly_constituency = Column(String(200), nullable=True, index=True)
    assembly_constituency_no = Column(Integer, nullable=True)

    # Polling unit identifiers
    section_no = Column(Integer, nullable=True)      # Section within a part
    part_no = Column(Integer, nullable=True)
    part_name = Column(String(255), nullable=True)
    serial_no = Column(Integer, nullable=True)
    polling_station_no = Column(Integer, nullable=True)
    polling_station_name = Column(String(500), nullable=True)

    # Address
    house_door_no = Column(String(100), nullable=True)

    # Source tracking
    source_file = Column(String(500), nullable=True)   # original filename
    source_format = Column(String(20), nullable=True)  # csv / xlsx / pdf / image

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # Composite index for common filter combos
        Index("ix_voters_ac_part", "assembly_constituency", "part_no"),
        Index("ix_voters_state_district", "state", "district"),
        # Prevent exact duplicate records from same source
        UniqueConstraint("voter_id", "source_file", name="uq_voter_source"),
    )

    def __repr__(self):
        return f"<Voter id={self.id} voter_id={self.voter_id} name={self.full_name}>"


class UploadJob(Base):
    """Tracks file upload/ingestion jobs and their status."""
    __tablename__ = "upload_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(500), nullable=False)
    file_format = Column(String(20), nullable=False)  # csv / xlsx / pdf / docx / image
    file_size_bytes = Column(Integer, nullable=True)
    status = Column(String(20), default="pending")    # pending / processing / done / failed
    records_parsed = Column(Integer, default=0)
    records_inserted = Column(Integer, default=0)
    records_skipped = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<UploadJob id={self.id} file={self.filename} status={self.status}>"
