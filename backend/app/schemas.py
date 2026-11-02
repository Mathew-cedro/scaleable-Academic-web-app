"""
Pydantic schemas and Data Transfer Objects (DTOs) for API request/response validation.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field
from app.models import ProgramType, TeacherStatus


# --- Department Schemas ---
class DepartmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str


# --- Teacher Schemas ---
class TeacherRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    department_id: int
    position: str
    max_daily_hours: int
    max_weekly_hours: int
    current_load_hours: int
    is_adviser: bool
    advisory_section_id: Optional[int] = None
    status: str = "Active"
    avatar_url: Optional[str] = None


class TeacherCreate(BaseModel):
    name: str
    department_id: int
    position: str = "Teacher I"
    max_daily_hours: int = 6
    max_weekly_hours: int = 30
    is_adviser: bool = False
    advisory_section_id: Optional[int] = None
    status: str = "Active"
    avatar_url: Optional[str] = None


class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    position: Optional[str] = None
    max_daily_hours: Optional[int] = None
    max_weekly_hours: Optional[int] = None
    is_adviser: Optional[bool] = None
    advisory_section_id: Optional[int] = None
    status: Optional[str] = None
    avatar_url: Optional[str] = None


# --- Section & Subject Schemas ---
class SectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    grade_level: int
    program_type: str = "BEC"
    room_number: str


class SectionCreate(BaseModel):
    name: str
    grade_level: int = Field(ge=7, le=10)
    program_type: str = "BEC"
    room_number: str
    adviser_id: Optional[int] = None


class SectionUpdate(BaseModel):
    name: Optional[str] = None
    grade_level: Optional[int] = Field(default=None, ge=7, le=10)
    program_type: Optional[str] = None
    room_number: Optional[str] = None
    adviser_id: Optional[int] = None


class BatchSectionCreateRequest(BaseModel):
    sections: List[SectionCreate]


class SubjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    department_id: int
    grade_level: int
    required_weekly_loads: int
    duration_minutes: int = 60
    preferred_placement: Optional[str] = None


class SubjectCreate(BaseModel):
    name: str
    department_id: int
    grade_level: int = 8
    required_weekly_loads: int = 4
    duration_minutes: int = Field(default=60, ge=20, le=240)
    preferred_placement: Optional[str] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    grade_level: Optional[int] = None
    required_weekly_loads: Optional[int] = None
    duration_minutes: Optional[int] = Field(default=None, ge=20, le=240)
    preferred_placement: Optional[str] = None


# --- Schedule Slot Schemas ---
class ScheduleSlotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    section_id: int
    subject_id: int
    teacher_id: int
    day_of_week: int  # 0 = Monday ... 4 = Friday
    period_index: int  # 1 to 7
    is_locked: bool
    # Hydrated fields for frontend rendering
    section_name: Optional[str] = None
    subject_name: Optional[str] = None
    teacher_name: Optional[str] = None
    department_name: Optional[str] = None
    room_number: Optional[str] = None


class ManualOverrideRequest(BaseModel):
    slot_id: int
    new_teacher_id: Optional[int] = None
    new_subject_id: Optional[int] = None
    new_day_of_week: Optional[int] = None
    new_period_index: Optional[int] = None


class SlotAssignRequest(BaseModel):
    slot_id: Optional[int] = None
    section_id: int
    subject_id: int
    teacher_id: int
    day_of_week: int  # 0 to 4
    period_index: int  # 1 to 7
    allow_room_override: bool = False


class ManualSwapRequest(BaseModel):
    slot_id_a: int
    slot_id_b: int


# --- Diff & Metrics Schemas ---
class SlotDiffItem(BaseModel):
    action: str  # "MODIFIED", "REASSIGNED", "MOVED", "UNTOUCHED"
    slot_id: int
    section_name: str
    subject_name: str
    day_of_week: int
    period_index: int
    original_teacher_name: Optional[str] = None
    new_teacher_name: Optional[str] = None
    reason: str


class DiffResult(BaseModel):
    disruption_cost: int
    displaced_count: int
    reassigned_count: int
    unaffected_count: int
    diff_items: List[SlotDiffItem]


class ScheduleOperationResponse(BaseModel):
    success: bool
    message: str
    latency_ms: float
    disruption_cost: int = 0
    diff: Optional[DiffResult] = None
    llm_report: Optional[str] = None
    slots_count: int = 0
    slots: List[ScheduleSlotRead] = Field(default_factory=list)


class MasterScheduleResponse(BaseModel):
    slots: List[ScheduleSlotRead]
    sections: List[SectionRead]
    teachers: List[TeacherRead]
    subjects: List[SubjectRead]
    departments: List[DepartmentRead]


# --- Generator Configuration & Time Allotments ---
class SubjectAllotmentConfig(BaseModel):
    duration_minutes: int = Field(default=60, ge=15, le=300)
    required_weekly_loads: int = Field(default=4, ge=1, le=12)
    is_adviser_locked: Optional[bool] = Field(default=None)
    preferred_placement: Optional[str] = Field(default=None)


class GenerateScheduleRequest(BaseModel):
    period_duration_minutes: int = Field(default=60, ge=15, le=300)
    subject_allotments: Optional[Dict[Union[int, str], SubjectAllotmentConfig]] = None
    track_subjects: Optional[Dict[str, List[int]]] = None  # Track code -> List[subject_id]
    target_section_ids: Optional[List[int]] = None  # Specific sections to generate schedule for (Grades 7 to 10)
    objective_strategy: str = Field(default="WORKLOAD_BALANCE")  # WORKLOAD_BALANCE, COMPACT_SCHEDULE, HYBRID
    prefer_morning_academic: bool = True
    max_daily_hours: int = Field(default=6, ge=2, le=10)
    max_consecutive_hours: int = Field(default=3, ge=1, le=8)
    room_collision_mode: str = Field(default="SOFT_PENALTY")  # SOFT_PENALTY, STRICT_ISOLATION
    preserve_locked_slots: bool = True
    max_solve_time_seconds: float = Field(default=10.0, ge=1.0, le=120.0)


# --- Class Load Prioritization & Substitution Dispatch ---
class SlotReassignmentItem(BaseModel):
    slot_id: int
    substitute_teacher_id: int
    section_id: Optional[int] = None
    subject_id: Optional[int] = None
    day_of_week: Optional[int] = None
    period_index: Optional[int] = None


class ReassignTeacherSlotsRequest(BaseModel):
    absent_teacher_id: int
    strategy: str = Field(default="LEAST_LOAD")  # LEAST_LOAD, HIGHER_RANK, SELF_ASSIGN, MANUAL
    dept_head_teacher_id: Optional[int] = None
    manual_assignments: Optional[List[SlotReassignmentItem]] = None


# --- Saved Schedule Snapshot Schemas ---
class SavedScheduleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    period_duration_minutes: int = 60
    slots_count: int = 0
    is_active: bool = False
    config_json: Optional[str] = None


class SavedScheduleDetail(SavedScheduleRead):
    slots_json: str


class SavedScheduleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    period_duration_minutes: int = Field(default=60, ge=20, le=240)
    config_json: Optional[str] = None


class SavedScheduleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    period_duration_minutes: Optional[int] = Field(default=None, ge=20, le=240)
    config_json: Optional[str] = None


class DepartmentDeploySummary(BaseModel):
    department_id: int
    department_name: str
    department_code: str
    faculty_count: int
    slots_count: int
    weekly_hours: float


class ScheduleDeployRequest(BaseModel):
    department_ids: Optional[List[int]] = None  # None or empty = all departments
    academic_year: str = "2026-2027"
    semester: str = "1st"
    memo: Optional[str] = "Master Schedule officially released and deployed to academic departments."
    deployed_by: Optional[str] = "Office of the Principal"
    notify_faculty: bool = True


class ScheduleDeploymentRead(BaseModel):
    id: int
    academic_year: str
    semester: str
    deployed_by: str
    memo: Optional[str] = None
    target_departments_json: str
    target_department_ids: List[int] = []
    status: str
    slots_count: int
    created_at: datetime


class ScheduleDeployResponse(BaseModel):
    success: bool
    message: str
    deployment: ScheduleDeploymentRead
    department_summaries: List[DepartmentDeploySummary]



