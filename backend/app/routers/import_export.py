"""
Spreadsheet Import, Biometric DTR Ingestion, New Hire Intelligence, and Teacher Pocket Portal Router.
Directly addresses proposal defense requirements for zero-friction teacher UX, Excel onboarding, and biometric sync.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlmodel import Session, select

from app.database import get_session
from app.models import (
    Department,
    ScheduleSlot,
    Section,
    Subject,
    Teacher,
    TeacherStatus,
)
from app.schemas import (
    BiometricApplySubstitutionsRequest,
    BiometricProcessResponse,
    ExcelScheduleCommitResponse,
    ExcelSchedulePreviewResponse,
    NewHireAuditRequest,
    NewHireAuditResponse,
    TeacherPocketSlot,
    TeacherPocketViewResponse,
)
from app.services.biometric_service import (
    apply_biometric_substitutions,
    generate_dtr_template_bytes,
    process_biometric_log,
)
from app.services.excel_importer import (
    commit_schedule_import,
    generate_schedule_template_bytes,
    preview_schedule_import,
)
from app.services.new_hire_service import audit_new_hire

router = APIRouter(prefix="/api", tags=["Spreadsheet & Biometric Sync"])

PERIOD_TIMES = {
    1: "07:30 - 08:30",
    2: "08:30 - 09:30",
    3: "09:45 - 10:45",
    4: "10:45 - 11:45",
    5: "12:30 - 01:30",
    6: "01:30 - 02:30",
    7: "02:45 - 03:45",
}

DAYS_LABEL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


# =========================================================================
# 1. Excel Master Schedule Import Endpoints
# =========================================================================

@router.get("/import/template/schedule")
def download_schedule_template():
    """Download an official DepEd master schedule spreadsheet template (.xlsx)."""
    file_bytes = generate_schedule_template_bytes()
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=DepEd_Master_Schedule_Template.xlsx"},
    )


@router.post("/import/schedule/preview", response_model=ExcelSchedulePreviewResponse)
async def preview_schedule_file(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """
    Dry-run validation of uploaded Excel or CSV master schedule.
    Checks collisions and RA 4670 daily limits without writing to database.
    """
    content = await file.read()
    return preview_schedule_import(session, content, file.filename)


@router.post("/import/schedule/commit", response_model=ExcelScheduleCommitResponse)
async def commit_schedule_file(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """
    Upload and commit validated master schedule from Excel or CSV.
    Replaces existing schedule and auto-updates teacher workload counts.
    """
    content = await file.read()
    try:
        return commit_schedule_import(session, content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# =========================================================================
# 2. Biometric DTR Scan Attendance Endpoints
# =========================================================================

@router.get("/biometrics/template/dtr")
def download_biometric_template():
    """Download sample biometric daily time record (DTR) attendance template (.xlsx)."""
    file_bytes = generate_dtr_template_bytes()
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Biometric_DTR_Attendance_Sample.xlsx"},
    )


@router.post("/biometrics/process", response_model=BiometricProcessResponse)
async def process_biometric_attendance(
    file: UploadFile = File(...),
    cutoff_time: str = Query("07:45", description="Morning attendance scan cutoff time (HH:MM)"),
    day_of_week: Optional[int] = Query(None, description="Day of week (0=Mon...4=Fri); defaults to today"),
    session: Session = Depends(get_session),
):
    """
    Ingest daily biometric punch logs, detect absent teachers, and formulate
    instant underloaded substitute recommendations complying with DO 005, s. 2024 and RA 4670.
    """
    content = await file.read()
    return process_biometric_log(session, content, file.filename, cutoff_time, day_of_week)


@router.post("/biometrics/apply-substitutions")
def apply_substitutions(
    req: BiometricApplySubstitutionsRequest,
    session: Session = Depends(get_session),
):
    """
    One-click apply automated substitute assignments to the master timetable.
    """
    return apply_biometric_substitutions(session, req.recommendations)


# =========================================================================
# 3. New Hire & Faculty Onboarding Intelligence
# =========================================================================

@router.post("/teachers/audit-new-hire", response_model=NewHireAuditResponse)
def audit_new_teacher(
    req: NewHireAuditRequest,
    session: Session = Depends(get_session),
):
    """
    Verify prospective teacher schedule against active master timetable.
    Checks section/room collisions, RA 4670 limits, and identifies workload relief opportunities.
    """
    return audit_new_hire(session, req)


# =========================================================================
# 4. Teacher-First Minimal-Effort Pocket Portal
# =========================================================================

@router.get("/teacher-pocket/{teacher_id}", response_model=TeacherPocketViewResponse)
def get_teacher_pocket_schedule(
    teacher_id: int,
    day_override: Optional[int] = Query(None, description="Override day of week (0=Mon...4=Fri)"),
    session: Session = Depends(get_session),
):
    """
    Zero-effort personal schedule feed for high school teachers.
    Returns today's classes, room numbers, substitution duties, and RA 4670 workload meters.
    """
    teacher = session.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    department = session.get(Department, teacher.department_id)
    dept_name = department.name if department else "General"
    dept_code = department.code if department else "GEN"

    advisory_section_name = None
    if teacher.advisory_section_id:
        adv_sec = session.get(Section, teacher.advisory_section_id)
        if adv_sec:
            advisory_section_name = adv_sec.name

    # Determine day of week
    today_dow = day_override if day_override is not None else min(datetime.now().weekday(), 4)
    day_name = DAYS_LABEL[today_dow]

    # Fetch all slots for this teacher
    slots = session.exec(select(ScheduleSlot).where(ScheduleSlot.teacher_id == teacher_id)).all()
    all_sections = {s.id: s for s in session.exec(select(Section)).all()}
    all_subjects = {sub.id: sub for sub in session.exec(select(Subject)).all()}
    all_teachers = {t.id: t for t in session.exec(select(Teacher)).all()}

    # Determine current period from clock
    now = datetime.now()
    now_hour = now.hour
    now_min = now.minute
    current_period = 0
    if (now_hour == 7 and now_min >= 30) or (now_hour == 8 and now_min < 30):
        current_period = 1
    elif (now_hour == 8 and now_min >= 30) or (now_hour == 9 and now_min < 30):
        current_period = 2
    elif (now_hour == 9 and now_min >= 45) or (now_hour == 10 and now_min < 45):
        current_period = 3
    elif (now_hour == 10 and now_min >= 45) or (now_hour == 11 and now_min < 45):
        current_period = 4
    elif (now_hour == 12 and now_min >= 30) or (now_hour == 13 and now_min < 30):
        current_period = 5
    elif (now_hour == 13 and now_min >= 30) or (now_hour == 14 and now_min < 30):
        current_period = 6
    elif (now_hour == 14 and now_min >= 45) or (now_hour == 15 and now_min < 45):
        current_period = 7

    today_slots: List[TeacherPocketSlot] = []
    all_week_map: Dict[int, List[TeacherPocketSlot]] = {d: [] for d in range(5)}
    substitute_notices = []

    for s in slots:
        sec = all_sections.get(s.section_id)
        sub = all_subjects.get(s.subject_id)
        sec_name = sec.name if sec else f"Section #{s.section_id}"
        grade = sec.grade_level if sec else 8
        sub_name = sub.name if sub else f"Subject #{s.subject_id}"
        room = sec.room_number if sec else "Room 101"

        orig_t_name = None
        if s.original_teacher_id:
            orig_t = all_teachers.get(s.original_teacher_id)
            orig_t_name = orig_t.name if orig_t else "Colleague"

        pocket_slot = TeacherPocketSlot(
            slot_id=s.id,
            day_of_week=s.day_of_week,
            period_index=s.period_index,
            time_range=PERIOD_TIMES.get(s.period_index, f"Period {s.period_index}"),
            section_name=sec_name,
            grade_level=grade,
            subject_name=sub_name,
            room_number=room,
            is_locked=s.is_locked,
            is_substituted=s.is_substituted,
            original_teacher_name=orig_t_name,
            substitution_reason=s.substitution_reason,
            is_current_period=(s.day_of_week == today_dow and s.period_index == current_period),
        )

        all_week_map[s.day_of_week].append(pocket_slot)

        if s.day_of_week == today_dow:
            today_slots.append(pocket_slot)
            if s.is_substituted:
                substitute_notices.append({
                    "slot_id": s.id,
                    "period_index": s.period_index,
                    "time_range": PERIOD_TIMES.get(s.period_index, ""),
                    "section_name": sec_name,
                    "subject_name": sub_name,
                    "room_number": room,
                    "covering_for": orig_t_name,
                    "reason": s.substitution_reason or "Medical / Official Leave",
                })

    # Sort today slots by period
    today_slots.sort(key=lambda x: x.period_index)
    for d in range(5):
        all_week_map[d].sort(key=lambda x: x.period_index)

    return TeacherPocketViewResponse(
        teacher_id=teacher.id,
        teacher_name=teacher.name,
        position=teacher.position,
        department_name=dept_name,
        department_code=dept_code,
        status=teacher.status,
        is_adviser=teacher.is_adviser,
        advisory_section_name=advisory_section_name,
        day_name=day_name,
        day_of_week=today_dow,
        daily_load_hours=len(today_slots),
        max_daily_hours=min(teacher.max_daily_hours, 6),
        weekly_load_hours=len(slots),
        max_weekly_hours=min(teacher.max_weekly_hours, 30),
        has_substitute_duty_today=len(substitute_notices) > 0,
        substitute_notices=substitute_notices,
        today_schedule=today_slots,
        all_week_schedule=all_week_map,
    )
