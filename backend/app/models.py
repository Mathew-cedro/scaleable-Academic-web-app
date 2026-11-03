"""
Relational Database Models for Scalable Academic Scheduling Application.
Built with SQLModel (SQLAlchemy + Pydantic).
Enforces DepEd Order No. 009, s. 2026 (Key Stage 3) & RA 4670 Workload Limits.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from sqlmodel import Field, SQLModel


class TeacherStatus(str, Enum):
    """Faculty availability status."""
    ACTIVE = "Active"
    ON_LEAVE = "On Leave"
    WELLNESS_LEAVE = "Wellness Leave"  # DO 002, s. 2026 (Mental health/wellness leave)


class ProgramType(str, Enum):
    """Curriculum program tracks in Philippine Junior High Schools."""
    REGULAR = "Regular"
    BEC = "BEC"
    STE = "STE"  # Science, Technology, and Engineering
    SPS = "SPS"  # Special Program in Sports
    SPA = "SPA"  # Special Program in the Arts
    SPJ = "SPJ"  # Special Program in Journalism


class Department(SQLModel, table=True):
    """
    Academic Department (8 Core DepEd Learning Areas).
    1. Science
    2. Mathematics
    3. English
    4. Filipino
    5. Araling Panlipunan (AP)
    6. EPP / TLE (Technology & Livelihood Education)
    7. MAPEH (Music, Arts, PE, Health)
    8. Values Education / Edukasyon sa Pagpapakatao (EsP)
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    code: str = Field(unique=True, index=True)


class Teacher(SQLModel, table=True):
    """
    Faculty member entity.
    Enforces RA 4670 (max 6 hours/day classroom teaching) and DO 005, s. 2024 (load tracking).
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    department_id: int = Field(foreign_key="department.id", index=True)
    position: str = Field(default="Teacher I")  # Teacher I-III, Master Teacher I-II
    max_daily_hours: int = Field(default=6)  # Hard ceiling of <= 6 hrs/day under RA 4670
    max_weekly_hours: int = Field(default=30)  # Standard weekly instructional cap
    current_load_hours: int = Field(default=0)  # Tracks assigned weekly loads
    is_adviser: bool = Field(default=False)
    advisory_section_id: Optional[int] = Field(default=None, foreign_key="section.id")
    status: str = Field(default="Active")
    avatar_url: Optional[str] = Field(default=None)


class Section(SQLModel, table=True):
    """
    Student Cohort / Section (Grades 7 to 10 - Key Stage 3).
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)  # e.g., "Grade 8 - STE Darwin"
    grade_level: int = Field(index=True)  # 7, 8, 9, or 10
    program_type: str = Field(default="BEC")
    room_number: str


class Subject(SQLModel, table=True):
    """
    Curriculum Subject.
    Each core subject requires 4 hours/week per section (Key Stage 3, DepEd Order 009, s. 2026).
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)  # Science, Mathematics, English, etc.
    department_id: int = Field(foreign_key="department.id", index=True)
    grade_level: int = Field(index=True)
    required_weekly_loads: int = Field(default=4)  # 4 loads/week
    duration_minutes: int = Field(default=60)  # 30, 40, 50, or 60 minutes per load
    preferred_placement: Optional[str] = Field(default=None)  # MORNING, AFTERNOON, MON_P1_LOCK, FLEXIBLE


class ScheduleSlot(SQLModel, table=True):
    """
    Single Timetable Assignment Slot.
    Connects (day_of_week, period_index) to (section, subject, teacher).
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    section_id: int = Field(foreign_key="section.id", index=True)
    subject_id: int = Field(foreign_key="subject.id", index=True)
    teacher_id: int = Field(foreign_key="teacher.id", index=True)
    day_of_week: int = Field(index=True)  # 0 = Monday ... 4 = Friday
    period_index: int = Field(index=True)  # 1 to 7 (1-hour instructional periods)
    is_locked: bool = Field(default=False)  # True for Monday Period 1 Homeroom & fixed locks
    is_substituted: bool = Field(default=False)  # True if temporarily substituted
    original_teacher_id: Optional[int] = Field(default=None, foreign_key="teacher.id")
    substitution_reason: Optional[str] = Field(default=None)


class SavedSchedule(SQLModel, table=True):
    """
    Saved Schedule Snapshot / Version File.
    Allows administrators to save, tag, browse, and restore complete timetable states.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    period_duration_minutes: int = Field(default=60)
    slots_count: int = Field(default=0)
    slots_json: str = Field(description="JSON serialized list of slot dictionaries")
    config_json: Optional[str] = Field(default=None, description="Serialized solver config or subject allotments")
    is_active: bool = Field(default=False)


class ScheduleDeployment(SQLModel, table=True):
    """
    Official Deployment of Master Timetable to Academic Departments.
    Tracks deployment date, academic year, semester, memo, deployed_by, target_departments_json, status, and slot count.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    academic_year: str = Field(default="2026-2027", index=True)
    semester: str = Field(default="1st", index=True)
    deployed_by: str = Field(default="Office of the Principal")
    memo: Optional[str] = Field(default="Master Schedule officially released and deployed to academic departments.")
    target_departments_json: str = Field(default="[]")  # JSON string e.g. "[1, 2, 3, 4, 5, 6, 7, 8]"
    status: str = Field(default="ACTIVE")  # "ACTIVE", "SUPERSEDED", "ARCHIVED"
    slots_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BiometricAttendanceLog(SQLModel, table=True):
    """
    Biometric Daily Time Record (DTR) Scan Log.
    Ingested from fingerprint/facial recognition biometric machines to track attendance
    and trigger automated dynamic substitution for absent/tardy teachers.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str = Field(index=True)  # YYYY-MM-DD
    teacher_id: Optional[int] = Field(default=None, foreign_key="teacher.id", index=True)
    teacher_name: str = Field(index=True)
    department_code: Optional[str] = Field(default=None, index=True)
    time_in: Optional[str] = Field(default=None)  # e.g., "07:15 AM"
    time_out: Optional[str] = Field(default=None)
    status: str = Field(default="PRESENT", index=True)  # "PRESENT", "LATE", "ABSENT", "ON_LEAVE"
    is_covered: bool = Field(default=False)
    substitute_teacher_id: Optional[int] = Field(default=None, foreign_key="teacher.id")
    substitute_teacher_name: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
