"""
Department and Faculty Management Endpoints.
CRUD operations for 8 departments, teacher profiles, workload caps, and leave statuses.
Enforces RA 4670 Magna Carta limits (<= 6 hours/day actual teaching).
"""

import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.database import get_session
from app.models import Department, ScheduleSlot, Section, Subject, Teacher, TeacherStatus
from app.schemas import (
    BatchSectionCreateRequest,
    DepartmentRead,
    SectionCreate,
    SectionRead,
    SectionUpdate,
    SubjectCreate,
    SubjectRead,
    SubjectUpdate,
    TeacherCreate,
    TeacherRead,
    TeacherUpdate,
)
from app.services.excel_importer import (
    generate_section_schedule_template,
    parse_and_preview_section_schedule_excel,
    persist_section_schedule_excel,
    generate_sections_excel_template,
    import_sections_from_items,
    parse_and_preview_spreadsheet,
)
from app.websocket_manager import broadcast_sync

router = APIRouter(prefix="/api", tags=["Departments & Faculty"])


@router.get("/departments", response_model=List[DepartmentRead])
def get_departments(session: Session = Depends(get_session)):
    """List all 8 DepEd Core Academic Departments."""
    return session.exec(select(Department)).all()


@router.get("/teachers", response_model=List[TeacherRead])
def get_teachers(
    department_id: Optional[int] = Query(None, description="Filter by department"),
    status: Optional[TeacherStatus] = Query(None, description="Filter by status"),
    session: Session = Depends(get_session),
):
    """List faculty members with optional department/status filtering."""
    query = select(Teacher)
    if department_id is not None:
        query = query.where(Teacher.department_id == department_id)
    if status is not None:
        query = query.where(Teacher.status == status)
    return session.exec(query).all()


@router.post("/teachers", response_model=TeacherRead, status_code=status.HTTP_201_CREATED)
def create_teacher(
    data: TeacherCreate,
    session: Session = Depends(get_session),
):
    """
    Add a new teacher to faculty roster.
    Enforces RA 4670 (max_daily_hours <= 6).
    """
    dept = session.get(Department, data.department_id)
    if not dept:
        raise HTTPException(status_code=400, detail="Specified academic department does not exist.")

    if data.max_daily_hours > 6:
        raise HTTPException(
            status_code=400,
            detail="Workload Cap: Actual classroom teaching cannot exceed 6 hours per day under Magna Carta guidelines.",
        )

    teacher = Teacher.model_validate(data)
    if teacher.advisory_section_id:
        teacher.is_adviser = True

    session.add(teacher)
    session.commit()
    session.refresh(teacher)

    broadcast_sync({
        "event": "TEACHERS_UPDATED",
        "action": "TEACHER_CREATED",
        "teacher_id": teacher.id,
        "teacher_name": teacher.name,
    })

    return teacher


@router.put("/teachers/{teacher_id}", response_model=TeacherRead)
def update_teacher(
    teacher_id: int,
    data: TeacherUpdate,
    session: Session = Depends(get_session),
):
    """
    Update faculty member details.
    Allows editing name, position, advisory assignment, load caps, and status.
    Enforces RA 4670 (max_daily_hours <= 6).
    Synchronizes advisory Homeroom Guidance slots (DepEd DO 009) and recalculates workload.
    """
    teacher = session.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")

    if data.max_daily_hours is not None and data.max_daily_hours > 6:
        raise HTTPException(
            status_code=400,
            detail="Workload Cap: Actual classroom teaching cannot exceed 6 hours per day under Magna Carta guidelines.",
        )

    if data.department_id is not None:
        dept = session.get(Department, data.department_id)
        if not dept:
            raise HTTPException(status_code=400, detail="Specified department does not exist.")

    # Snapshot previous state
    old_dept_id = teacher.department_id
    old_advisory_id = teacher.advisory_section_id
    old_status = teacher.status

    affected_teacher_ids: set[int] = set()
    schedule_changed = False

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(teacher, field, value)

    # 1. Normalize Advisory Flag
    if teacher.advisory_section_id:
        teacher.is_adviser = True
    elif "advisory_section_id" in update_dict and update_dict["advisory_section_id"] is None:
        teacher.is_adviser = False
        teacher.advisory_section_id = None
    elif "is_adviser" in update_dict and not update_dict["is_adviser"]:
        teacher.is_adviser = False
        teacher.advisory_section_id = None

    new_advisory_id = teacher.advisory_section_id

    # Homeroom Guidance Program subject lookup
    hr_subject = session.exec(select(Subject).where(Subject.name.like("%Homeroom%"))).first()

    # 2. Advisory ScheduleSlot Synchronization (Monday Period 1 HRGP)
    if new_advisory_id != old_advisory_id:
        schedule_changed = True

        # Case A: Assigned a new advisory section
        if new_advisory_id is not None:
            # 1-to-1 Uniqueness: strip previous adviser of new section
            other_advisers = session.exec(
                select(Teacher).where(Teacher.advisory_section_id == new_advisory_id, Teacher.id != teacher.id)
            ).all()
            for other in other_advisers:
                other.advisory_section_id = None
                other.is_adviser = False
                session.add(other)
                affected_teacher_ids.add(other.id)

            # Update Monday Period 1 Homeroom slot for this section
            new_hr_slot = session.exec(
                select(ScheduleSlot).where(
                    ScheduleSlot.section_id == new_advisory_id,
                    ScheduleSlot.day_of_week == 0,
                    ScheduleSlot.period_index == 1,
                )
            ).first()
            if new_hr_slot:
                if new_hr_slot.teacher_id != teacher.id:
                    affected_teacher_ids.add(new_hr_slot.teacher_id)
                    new_hr_slot.teacher_id = teacher.id
                    session.add(new_hr_slot)
            elif hr_subject:
                created_slot = ScheduleSlot(
                    section_id=new_advisory_id,
                    subject_id=hr_subject.id,
                    teacher_id=teacher.id,
                    day_of_week=0,
                    period_index=1,
                    is_locked=True,
                )
                session.add(created_slot)

        # Case B: Replaced or removed old advisory section
        if old_advisory_id is not None and old_advisory_id != new_advisory_id:
            old_hr_slot = session.exec(
                select(ScheduleSlot).where(
                    ScheduleSlot.section_id == old_advisory_id,
                    ScheduleSlot.day_of_week == 0,
                    ScheduleSlot.period_index == 1,
                    ScheduleSlot.teacher_id == teacher.id,
                )
            ).first()
            if old_hr_slot:
                # Find if old section already has another adviser
                new_adv = session.exec(
                    select(Teacher).where(Teacher.advisory_section_id == old_advisory_id, Teacher.id != teacher.id)
                ).first()
                if new_adv:
                    old_hr_slot.teacher_id = new_adv.id
                    affected_teacher_ids.add(new_adv.id)
                else:
                    # Pick an active faculty member free on Monday Period 1
                    active_candidates = session.exec(
                        select(Teacher).where(Teacher.status == "Active", Teacher.id != teacher.id)
                    ).all()
                    busy_tids = {
                        s.teacher_id for s in session.exec(
                            select(ScheduleSlot).where(ScheduleSlot.day_of_week == 0, ScheduleSlot.period_index == 1)
                        ).all()
                    }
                    free_cand = next((t for t in active_candidates if t.id not in busy_tids), None)
                    if free_cand:
                        old_hr_slot.teacher_id = free_cand.id
                        affected_teacher_ids.add(free_cand.id)
                session.add(old_hr_slot)

    # 3. Department Transfer: Reassign subject slots belonging to old department
    if teacher.department_id != old_dept_id:
        schedule_changed = True
        old_dept_slots = session.exec(
            select(ScheduleSlot)
            .join(Subject, ScheduleSlot.subject_id == Subject.id)
            .where(
                ScheduleSlot.teacher_id == teacher.id,
                Subject.department_id == old_dept_id,
                ScheduleSlot.is_locked == False,
            )
        ).all()

        if old_dept_slots:
            eligible_peers = session.exec(
                select(Teacher).where(
                    Teacher.department_id == old_dept_id,
                    Teacher.status == "Active",
                    Teacher.id != teacher.id,
                )
            ).all()

            for slot in old_dept_slots:
                cand = next(
                    (
                        p for p in sorted(eligible_peers, key=lambda x: x.current_load_hours)
                        if not session.exec(
                            select(ScheduleSlot).where(
                                ScheduleSlot.teacher_id == p.id,
                                ScheduleSlot.day_of_week == slot.day_of_week,
                                ScheduleSlot.period_index == slot.period_index,
                            )
                        ).first()
                    ),
                    None,
                )
                if not cand and eligible_peers:
                    cand = min(eligible_peers, key=lambda x: x.current_load_hours)
                if cand:
                    slot.teacher_id = cand.id
                    affected_teacher_ids.add(cand.id)
                    session.add(slot)

    session.add(teacher)
    session.flush()

    # 4. Synchronize current_load_hours for this teacher and all affected faculty
    all_affected = affected_teacher_ids | {teacher.id}
    for tid in all_affected:
        t_record = session.get(Teacher, tid)
        if t_record:
            actual_load = len(session.exec(select(ScheduleSlot).where(ScheduleSlot.teacher_id == tid)).all())
            t_record.current_load_hours = actual_load
            session.add(t_record)

    session.commit()
    session.refresh(teacher)

    broadcast_sync({
        "event": "TEACHERS_UPDATED",
        "action": "TEACHER_UPDATED",
        "teacher_id": teacher.id,
        "teacher_name": teacher.name,
    })

    if schedule_changed:
        broadcast_sync({
            "event": "SCHEDULE_UPDATED",
            "action": "SLOTS_SYNCHRONIZED",
            "message": f"Schedule slots synchronized with profile updates for '{teacher.name}'.",
        })

    return teacher


@router.delete("/teachers/{teacher_id}")
def delete_teacher(
    teacher_id: int,
    session: Session = Depends(get_session),
):
    """
    Remove a faculty member from the system.
    Cleans up any active timetable slots assigned to this teacher to maintain relational integrity.
    """
    teacher = session.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")

    teacher_name = teacher.name

    # Unassign or delete slots assigned to this teacher
    slots = session.exec(select(ScheduleSlot).where(ScheduleSlot.teacher_id == teacher_id)).all()
    removed_slots_count = len(slots)
    for slot in slots:
        session.delete(slot)

    session.delete(teacher)
    session.commit()

    broadcast_sync({
        "event": "TEACHERS_UPDATED",
        "action": "TEACHER_DELETED",
        "teacher_id": teacher_id,
        "teacher_name": teacher_name,
    })

    if removed_slots_count > 0:
        broadcast_sync({
            "event": "SCHEDULE_UPDATED",
            "action": "SLOTS_REMOVED",
            "message": f"{removed_slots_count} slots removed following deletion of faculty member '{teacher_name}'.",
        })

    return {
        "success": True,
        "message": f"Faculty member '{teacher_name}' removed successfully.",
        "removed_slots_count": removed_slots_count,
    }


@router.get("/sections", response_model=List[SectionRead])
def get_sections(session: Session = Depends(get_session)):
    """List all Junior High School sections (Key Stage 3)."""
    return session.exec(select(Section)).all()


@router.post("/sections", response_model=SectionRead, status_code=status.HTTP_201_CREATED)
def create_section(data: SectionCreate, session: Session = Depends(get_session)):
    """
    Create a new student cohort / section.
    Allows all academic departments & administrators to configure classes across Grades 7-10.
    """
    existing = session.exec(select(Section).where(Section.name == data.name.strip())).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A section named '{data.name.strip()}' already exists.",
        )

    sec = Section(
        name=data.name.strip(),
        grade_level=data.grade_level,
        program_type=data.program_type,
        room_number=data.room_number.strip(),
    )
    session.add(sec)
    session.commit()
    session.refresh(sec)

    # If an adviser is selected, link the faculty member
    if data.adviser_id:
        adviser = session.get(Teacher, data.adviser_id)
        if adviser:
            adviser.is_adviser = True
            adviser.advisory_section_id = sec.id
            session.add(adviser)
            session.commit()

    broadcast_sync({
        "event": "SECTIONS_UPDATED",
        "action": "SECTION_CREATED",
        "section_id": sec.id,
        "section_name": sec.name,
    })

    return sec


@router.post("/sections/batch", response_model=List[SectionRead], status_code=status.HTTP_201_CREATED)
def create_sections_batch(data: BatchSectionCreateRequest, session: Session = Depends(get_session)):
    """
    Batch create student cohorts / sections across Grades 7-10.
    Handles duplicate name resolution automatically and broadcasts update.
    """
    created_sections = []
    for item in data.sections:
        clean_name = item.name.strip()
        existing = session.exec(select(Section).where(Section.name == clean_name)).first()
        if existing:
            count = 2
            cand = f"{clean_name} ({count})"
            while session.exec(select(Section).where(Section.name == cand)).first():
                count += 1
                cand = f"{clean_name} ({count})"
            clean_name = cand

        sec = Section(
            name=clean_name,
            grade_level=item.grade_level,
            program_type=item.program_type or "BEC",
            room_number=item.room_number.strip() if item.room_number else f"Room {item.grade_level}0{len(created_sections)+1}",
        )
        session.add(sec)
        session.commit()
        session.refresh(sec)

        if item.adviser_id:
            adviser = session.get(Teacher, item.adviser_id)
            if adviser:
                adviser.is_adviser = True
                adviser.advisory_section_id = sec.id
                session.add(adviser)
                session.commit()

        created_sections.append(sec)

    broadcast_sync({
        "event": "SECTIONS_UPDATED",
        "action": "SECTIONS_BATCH_CREATED",
        "count": len(created_sections),
    })

    return created_sections


@router.get("/sections/template-excel")
def download_sections_excel_template():
    """
    Download a formatted DepEd Junior High School Section Roster Excel (.xlsx) template
    with guidelines, proper headers, and sample records across Grades 7 to 10.
    """
    buffer = generate_sections_excel_template()
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="DepEd_Section_Roster_Template.xlsx"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/sections/preview-excel")
async def preview_sections_excel(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """
    Parse an uploaded .xlsx, .xls, or .csv spreadsheet and return structured preview items
    with smart column detection, grade level validation, and fuzzy faculty adviser matching.
    """
    contents = await file.read()
    filename = file.filename or "sections.xlsx"
    result = parse_and_preview_spreadsheet(contents, filename, session)
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to parse spreadsheet."),
        )
    return result


@router.post("/sections/import-excel")
def import_sections_excel(
    data: Dict[str, Any],
    session: Session = Depends(get_session),
):
    """
    Batch persist verified section items from Excel preview.
    Creates new sections or updates existing sections, links advisers, and synchronizes Monday P1 Homeroom slots.
    """
    items = data.get("sections", [])
    update_existing = bool(data.get("update_existing", True))

    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No section records provided to import.",
        )

    res = import_sections_from_items(items, update_existing, session)

    broadcast_sync({
        "event": "SECTIONS_UPDATED",
        "action": "SECTIONS_EXCEL_IMPORTED",
        "created": res["created_count"],
        "updated": res["updated_count"],
    })

    return res


@router.get("/sections/{section_id}/schedule-template-excel")
def download_section_schedule_excel_template(
    section_id: int,
    session: Session = Depends(get_session),
):
    """
    Download a formatted DepEd Section Schedule / Timetable Excel (.xlsx) template
    pre-filled with the section's bell schedule and Monday-Friday periods.
    """
    sec = session.get(Section, section_id)
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")
    buffer = generate_section_schedule_template(sec, session)
    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", sec.name)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="Schedule_{safe_name}.xlsx"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/sections/{section_id}/preview-schedule-excel")
async def preview_section_schedule_excel(
    section_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """
    Parse an uploaded section schedule spreadsheet (.xlsx, .xls, .csv),
    audit slots against teacher double-booking, RA 4670, and DepEd DO 009,
    and return an interactive preview payload.
    """
    contents = await file.read()
    filename = file.filename or "schedule.xlsx"
    result = parse_and_preview_section_schedule_excel(contents, filename, section_id, session)
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to parse section schedule spreadsheet."),
        )
    return result


@router.post("/sections/{section_id}/import-schedule-excel")
def import_section_schedule_excel(
    section_id: int,
    data: Dict[str, Any],
    session: Session = Depends(get_session),
):
    """
    Persist verified schedule slots from Excel preview into database for section_id.
    Atomically clears previous section slots, inserts new slots, recalculates teacher
    loads, and broadcasts WebSocket sync event.
    """
    slots_data = data.get("slots", [])
    if not slots_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No schedule slots provided to import.",
        )
    result = persist_section_schedule_excel(section_id, slots_data, session)
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to persist schedule."),
        )

    broadcast_sync({
        "event": "SCHEDULE_UPDATED",
        "action": "SECTION_SCHEDULE_EXCEL_IMPORTED",
        "section_id": section_id,
        "slots_count": result.get("slots_imported", 0),
    })

    return result


@router.put("/sections/{section_id}", response_model=SectionRead)
def update_section(
    section_id: int,
    data: SectionUpdate,
    session: Session = Depends(get_session),
):
    """
    Update an existing section's details, program track, room number, or adviser.
    Synchronizes Monday Period 1 Homeroom Guidance Program slot in ScheduleSlot.
    """
    sec = session.get(Section, section_id)
    if not sec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section with ID {section_id} not found.",
        )

    schedule_changed = False
    affected_teacher_ids: set[int] = set()

    if data.name is not None and data.name.strip():
        # Check duplicate name if changed
        if data.name.strip() != sec.name:
            dup = session.exec(select(Section).where(Section.name == data.name.strip())).first()
            if dup:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Another section named '{data.name.strip()}' already exists.",
                )
        sec.name = data.name.strip()

    if data.grade_level is not None:
        sec.grade_level = data.grade_level

    if data.program_type is not None:
        sec.program_type = data.program_type

    if data.room_number is not None and data.room_number.strip():
        sec.room_number = data.room_number.strip()

    session.add(sec)

    # Handle adviser reassignment
    update_dict = data.model_dump(exclude_unset=True)
    if "adviser_id" in update_dict:
        adviser_id = update_dict["adviser_id"]
        schedule_changed = True
        hr_subject = session.exec(select(Subject).where(Subject.name.like("%Homeroom%"))).first()

        # Clear previous adviser if any
        prev_advisers = session.exec(
            select(Teacher).where(Teacher.advisory_section_id == section_id)
        ).all()
        for prev in prev_advisers:
            prev.advisory_section_id = None
            prev.is_adviser = False
            session.add(prev)
            affected_teacher_ids.add(prev.id)

        if adviser_id is not None and adviser_id > 0:
            new_adviser = session.get(Teacher, adviser_id)
            if new_adviser:
                new_adviser.is_adviser = True
                new_adviser.advisory_section_id = sec.id
                session.add(new_adviser)
                affected_teacher_ids.add(new_adviser.id)

                # Synchronize Monday Period 1 Homeroom Guidance slot
                hr_slot = session.exec(
                    select(ScheduleSlot).where(
                        ScheduleSlot.section_id == sec.id,
                        ScheduleSlot.day_of_week == 0,
                        ScheduleSlot.period_index == 1,
                    )
                ).first()
                if hr_slot:
                    if hr_slot.teacher_id != new_adviser.id:
                        affected_teacher_ids.add(hr_slot.teacher_id)
                        hr_slot.teacher_id = new_adviser.id
                        session.add(hr_slot)
                elif hr_subject:
                    created_slot = ScheduleSlot(
                        section_id=sec.id,
                        subject_id=hr_subject.id,
                        teacher_id=new_adviser.id,
                        day_of_week=0,
                        period_index=1,
                        is_locked=True,
                    )
                    session.add(created_slot)
        else:
            # Advisory cleared: assign Monday Period 1 HRGP to an active faculty member
            hr_slot = session.exec(
                select(ScheduleSlot).where(
                    ScheduleSlot.section_id == sec.id,
                    ScheduleSlot.day_of_week == 0,
                    ScheduleSlot.period_index == 1,
                )
            ).first()
            if hr_slot:
                active_cands = session.exec(select(Teacher).where(Teacher.status == "Active")).all()
                busy_tids = {
                    s.teacher_id for s in session.exec(
                        select(ScheduleSlot).where(ScheduleSlot.day_of_week == 0, ScheduleSlot.period_index == 1)
                    ).all()
                }
                free_cand = next((t for t in active_cands if t.id not in busy_tids), None)
                if free_cand:
                    hr_slot.teacher_id = free_cand.id
                    affected_teacher_ids.add(free_cand.id)
                    session.add(hr_slot)

    session.flush()

    for tid in affected_teacher_ids:
        t_record = session.get(Teacher, tid)
        if t_record:
            actual_load = len(session.exec(select(ScheduleSlot).where(ScheduleSlot.teacher_id == tid)).all())
            t_record.current_load_hours = actual_load
            session.add(t_record)

    session.commit()
    session.refresh(sec)

    broadcast_sync({
        "event": "SECTIONS_UPDATED",
        "action": "SECTION_UPDATED",
        "section_id": sec.id,
        "section_name": sec.name,
    })

    if "adviser_id" in update_dict:
        broadcast_sync({
            "event": "TEACHERS_UPDATED",
            "action": "ADVISER_CHANGED",
            "section_id": sec.id,
            "adviser_id": update_dict.get("adviser_id"),
        })

    if schedule_changed:
        broadcast_sync({
            "event": "SCHEDULE_UPDATED",
            "action": "SLOTS_SYNCHRONIZED",
            "message": f"Homeroom guidance schedule slot synchronized for section '{sec.name}'.",
        })

    return sec


@router.delete("/sections/{section_id}")
def delete_section(section_id: int, session: Session = Depends(get_session)):
    """
    Remove a section and safely cascade-delete its scheduled timetable slots.
    """
    sec = session.get(Section, section_id)
    if not sec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section with ID {section_id} not found.",
        )

    sec_name = sec.name

    # 1. Remove scheduled slots belonging to this section
    slots = session.exec(select(ScheduleSlot).where(ScheduleSlot.section_id == section_id)).all()
    removed_slots_count = len(slots)
    affected_teacher_ids = {s.teacher_id for s in slots if s.teacher_id}
    for slot in slots:
        session.delete(slot)

    # 2. Clear advisory linkage
    advisers = session.exec(select(Teacher).where(Teacher.advisory_section_id == section_id)).all()
    for adv in advisers:
        adv.advisory_section_id = None
        adv.is_adviser = False
        session.add(adv)
        affected_teacher_ids.add(adv.id)

    # 3. Delete section entity
    session.delete(sec)
    session.flush()

    # 4. Recalculate loads for affected teachers
    for tid in affected_teacher_ids:
        t_record = session.get(Teacher, tid)
        if t_record:
            actual_load = len(session.exec(select(ScheduleSlot).where(ScheduleSlot.teacher_id == tid)).all())
            t_record.current_load_hours = actual_load
            session.add(t_record)

    session.commit()

    broadcast_sync({
        "event": "SECTIONS_UPDATED",
        "action": "SECTION_DELETED",
        "section_id": section_id,
        "section_name": sec_name,
    })

    if removed_slots_count > 0:
        broadcast_sync({
            "event": "SCHEDULE_UPDATED",
            "action": "SLOTS_REMOVED",
            "message": f"{removed_slots_count} slots removed following deletion of section '{sec_name}'.",
        })

    return {
        "success": True,
        "message": f"Section '{sec_name}' deleted successfully.",
        "removed_slots_count": removed_slots_count,
    }


@router.get("/subjects", response_model=List[SubjectRead])
def get_subjects(session: Session = Depends(get_session)):
    """List all DepEd curriculum subjects."""
    return session.exec(select(Subject)).all()


@router.post("/subjects", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
def create_subject(data: SubjectCreate, session: Session = Depends(get_session)):
    """Create a new curriculum subject."""
    dept = session.get(Department, data.department_id)
    if not dept:
        raise HTTPException(status_code=400, detail="Invalid department ID")

    subject = Subject(
        name=data.name.strip(),
        department_id=data.department_id,
        grade_level=data.grade_level,
        required_weekly_loads=data.required_weekly_loads,
        duration_minutes=data.duration_minutes,
        preferred_placement=data.preferred_placement,
    )
    session.add(subject)
    session.commit()
    session.refresh(subject)

    broadcast_sync({
        "event": "SUBJECTS_UPDATED",
        "action": "SUBJECT_CREATED",
        "subject_id": subject.id,
        "subject_name": subject.name,
    })
    return subject


@router.put("/subjects/{subject_id}", response_model=SubjectRead)
def update_subject(subject_id: int, data: SubjectUpdate, session: Session = Depends(get_session)):
    """Update a curriculum subject."""
    subject = session.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if data.name is not None:
        subject.name = data.name.strip()
    if data.department_id is not None:
        dept = session.get(Department, data.department_id)
        if not dept:
            raise HTTPException(status_code=400, detail="Invalid department ID")
        subject.department_id = data.department_id
    if data.grade_level is not None:
        subject.grade_level = data.grade_level
    if data.required_weekly_loads is not None:
        subject.required_weekly_loads = data.required_weekly_loads
    if data.duration_minutes is not None:
        subject.duration_minutes = data.duration_minutes
    if data.preferred_placement is not None:
        subject.preferred_placement = data.preferred_placement

    session.add(subject)
    session.commit()
    session.refresh(subject)

    broadcast_sync({
        "event": "SUBJECTS_UPDATED",
        "action": "SUBJECT_UPDATED",
        "subject_id": subject.id,
        "subject_name": subject.name,
    })
    return subject


@router.delete("/subjects/{subject_id}")
def delete_subject(subject_id: int, session: Session = Depends(get_session)):
    """Delete a curriculum subject and its schedule slots."""
    subject = session.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    sub_name = subject.name

    # Remove associated slots
    slots = session.exec(select(ScheduleSlot).where(ScheduleSlot.subject_id == subject_id)).all()
    removed_count = len(slots)
    for s in slots:
        session.delete(s)

    session.delete(subject)
    session.commit()

    broadcast_sync({
        "event": "SUBJECTS_UPDATED",
        "action": "SUBJECT_DELETED",
        "subject_id": subject_id,
        "subject_name": sub_name,
    })

    return {
        "success": True,
        "message": f"Subject '{sub_name}' deleted successfully.",
        "removed_slots_count": removed_count,
    }
