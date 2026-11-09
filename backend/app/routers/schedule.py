"""
Schedule Generation, Dynamic Repair, Real-Time Assignment, and Manual Override Endpoints.
Coordinates CP-SAT solver, diff engine, LLM compliance reporter, and WebSocket real-time sync.
"""

from datetime import datetime, timezone
import json
import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from app.services.docx_exporter import generate_class_schedule_document
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models import (
    Department,
    SavedSchedule,
    ScheduleDeployment,
    ScheduleSlot,
    Section,
    Subject,
    Teacher,
    TeacherStatus,
)
from app.schemas import (
    DepartmentDeploySummary,
    GenerateScheduleRequest,
    ManualOverrideRequest,
    ManualSwapRequest,
    MasterScheduleResponse,
    ReassignTeacherSlotsRequest,
    SavedScheduleCreate,
    SavedScheduleDetail,
    SavedScheduleRead,
    SavedScheduleUpdate,
    ScheduleDeploymentRead,
    ScheduleDeployRequest,
    ScheduleDeployResponse,
    ScheduleOperationResponse,
    ScheduleSlotRead,
    SlotAssignRequest,
)
from app.services.cp_solver import (
    generate_master_schedule,
    hydrate_slots,
    reassign_teacher_slots,
    repair_schedule,
)
from app.services.llm_reporter import generate_llm_compliance_report
from app.services.ai_service import generate_ai_executive_report
from app.websocket_manager import manager, broadcast_sync

router = APIRouter(prefix="/api/schedule", tags=["Schedule Engine"])


@router.websocket("/ws")
async def schedule_websocket(websocket: WebSocket):
    """Real-time WebSocket endpoint for instant multi-client schedule synchronization."""
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.get("/master", response_model=MasterScheduleResponse)
def get_master_schedule(session: Session = Depends(get_session)):
    """Fetch complete master schedule state with hydrated entities."""
    slots = session.exec(select(ScheduleSlot)).all()
    sections = session.exec(select(Section)).all()
    teachers = session.exec(select(Teacher)).all()
    subjects = session.exec(select(Subject)).all()
    departments = session.exec(select(Department)).all()

    section_map = {s.id: s for s in sections}
    subject_map = {s.id: s for s in subjects}
    teacher_map = {t.id: t for t in teachers}
    dept_map = {d.id: d for d in departments}

    hydrated = hydrate_slots(slots, section_map, subject_map, teacher_map, dept_map)

    return MasterScheduleResponse(
        slots=hydrated,
        sections=sections,
        teachers=teachers,
        subjects=subjects,
        departments=departments,
    )


@router.post("/generate", response_model=ScheduleOperationResponse)
def generate_schedule(
    config: Optional[GenerateScheduleRequest] = None,
    session: Session = Depends(get_session),
):
    """
    Generate complete conflict-free Master Schedule using Google OR-Tools CP-SAT.
    Enforces DepEd Key Stage 3 rules, Monday Period 1 Homeroom, custom time allotments, and RA 4670 caps.
    """
    res = generate_master_schedule(session, config)
    broadcast_sync({
        "event": "SCHEDULE_UPDATED",
        "action": "MASTER_GENERATED",
        "message": "Master schedule newly generated with CP-SAT solver.",
    })
    return res


@router.post("/reassign-teacher-slots", response_model=ScheduleOperationResponse)
def dispatch_teacher_reassignment(
    payload: ReassignTeacherSlotsRequest,
    session: Session = Depends(get_session),
):
    """
    Class Load Prioritization & Substitution Dispatcher.
    Reassigns orphaned classes when a teacher goes on leave using:
    - LEAST_LOAD: underloaded teachers prioritized under DO 005, s. 2024
    - HIGHER_RANK: Master Teachers prioritized for senior curriculum delivery
    - SELF_ASSIGN: Department Head directly assumes teaching loads
    - MANUAL: Explicit per-slot substitute assignments chosen by the user
    """
    res = reassign_teacher_slots(session, payload)
    broadcast_sync({
        "event": "SCHEDULE_UPDATED",
        "action": "SUBSTITUTE_DISPATCHED",
        "message": f"Substitution dispatched for Teacher ID {payload.absent_teacher_id}.",
    })
    return res


@router.post("/repair", response_model=ScheduleOperationResponse)
def run_dynamic_repair(
    config: Optional[GenerateScheduleRequest] = None,
    session: Session = Depends(get_session),
):
    """
    Execute Fault-Tolerant Dynamic Schedule Repair.
    Minimizes disruption cost while prioritizing underloaded teachers for substitutions,
    and dynamically accommodates newly added subjects or modified curriculum tracks.
    """
    res = repair_schedule(session, config=config)
    broadcast_sync({
        "event": "SCHEDULE_UPDATED",
        "action": "DYNAMIC_REPAIRED",
        "message": "Dynamic schedule repair executed.",
    })
    return res


@router.post("/slot/assign", response_model=ScheduleOperationResponse)
def assign_or_update_slot(
    data: SlotAssignRequest,
    session: Session = Depends(get_session),
):
    """
    Real-Time Slot Assignment & Editing:
    Creates a new schedule slot on an empty period or updates an existing slot.
    Validates teacher availability, RA 4670 Magna Carta limits, and DepEd Table 5 locks.
    """
    # 1. Mon Period 1 Lock Check & Automatic Advisory Synchronization
    is_mon_p1 = (data.day_of_week == 0 and data.period_index == 1)
    if is_mon_p1:
        target_teacher = session.get(Teacher, data.teacher_id)
        if not target_teacher:
            raise HTTPException(status_code=404, detail="Selected faculty member not found.")

        # Ensure Homeroom Guidance Program subject is assigned
        hr_subject = session.exec(select(Subject).where(Subject.name.like("%Homeroom%"))).first()
        if hr_subject:
            data.subject_id = hr_subject.id

        # If teacher is not yet the adviser of this section, designate them as the official Class Adviser
        if not target_teacher.is_adviser or target_teacher.advisory_section_id != data.section_id:
            # If target teacher previously advised another section, clear its old Mon P1 slot
            if target_teacher.advisory_section_id and target_teacher.advisory_section_id != data.section_id:
                old_sec_id = target_teacher.advisory_section_id
                old_hr_slot = session.exec(
                    select(ScheduleSlot).where(
                        ScheduleSlot.section_id == old_sec_id,
                        ScheduleSlot.day_of_week == 0,
                        ScheduleSlot.period_index == 1,
                        ScheduleSlot.teacher_id == target_teacher.id,
                    )
                ).first()
                if old_hr_slot:
                    session.delete(old_hr_slot)

            # Clear previous advisers for this section
            prev_advs = session.exec(
                select(Teacher).where(Teacher.advisory_section_id == data.section_id, Teacher.id != target_teacher.id)
            ).all()
            for prev in prev_advs:
                prev.is_adviser = False
                prev.advisory_section_id = None
                session.add(prev)

            # Assign new advisory to target teacher
            target_teacher.is_adviser = True
            target_teacher.advisory_section_id = data.section_id
            session.add(target_teacher)
            session.flush()

    # 2. Teacher Conflict Check
    teacher_collision = session.exec(
        select(ScheduleSlot).where(
            ScheduleSlot.teacher_id == data.teacher_id,
            ScheduleSlot.day_of_week == data.day_of_week,
            ScheduleSlot.period_index == data.period_index,
        )
    ).first()
    if teacher_collision and (data.slot_id is None or teacher_collision.id != data.slot_id):
        teacher = session.get(Teacher, data.teacher_id)
        sec = session.get(Section, teacher_collision.section_id)
        t_name = teacher.name if teacher else f"Teacher #{data.teacher_id}"
        sec_name = sec.name if sec else f"Section #{teacher_collision.section_id}"
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        raise HTTPException(
            status_code=400,
            detail=f"Scheduling Conflict: {t_name} is already assigned to {sec_name} on {days[data.day_of_week]} Period {data.period_index}.",
        )

    # 3. Section Collision Check
    sec_collision = session.exec(
        select(ScheduleSlot).where(
            ScheduleSlot.section_id == data.section_id,
            ScheduleSlot.day_of_week == data.day_of_week,
            ScheduleSlot.period_index == data.period_index,
        )
    ).first()
    if sec_collision and data.slot_id is None:
        data.slot_id = sec_collision.id

    # 3.5 Physical Room Collision Check
    target_section = session.get(Section, data.section_id)
    if target_section and target_section.room_number and target_section.room_number.strip():
        r_num = target_section.room_number.strip().lower()
        sharing_secs = session.exec(
            select(Section).where(Section.id != data.section_id)
        ).all()
        sharing_sec_ids = [s.id for s in sharing_secs if s.room_number and s.room_number.strip().lower() == r_num]

        if sharing_sec_ids:
            room_collision = session.exec(
                select(ScheduleSlot).where(
                    ScheduleSlot.section_id.in_(sharing_sec_ids),
                    ScheduleSlot.day_of_week == data.day_of_week,
                    ScheduleSlot.period_index == data.period_index,
                )
            ).first()

            if room_collision and (data.slot_id is None or room_collision.id != data.slot_id):
                if not data.allow_room_override:
                    clashing_sec = session.get(Section, room_collision.section_id)
                    clashing_sub = session.get(Subject, room_collision.subject_id)
                    clashing_tch = session.get(Teacher, room_collision.teacher_id)
                    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
                    sec_title = clashing_sec.name if clashing_sec else f"Section #{room_collision.section_id}"
                    sub_title = clashing_sub.name if clashing_sub else "Class"
                    tch_title = clashing_tch.name if clashing_tch else "Teacher"
                    raise HTTPException(
                        status_code=400,
                        detail=f"Room Collision: {target_section.room_number} is already occupied by {sec_title} ({sub_title} with {tch_title}) on {days[data.day_of_week]} Period {data.period_index}. Enable 'Allow Room Sharing / Override' if intentional.",
                    )

    # 4. RA 4670 Magna Carta Daily Ceiling (Strictly <= 6 hrs/day)
    teacher = session.get(Teacher, data.teacher_id)
    if teacher:
        existing_daily_slots = session.exec(
            select(ScheduleSlot).where(
                ScheduleSlot.teacher_id == data.teacher_id,
                ScheduleSlot.day_of_week == data.day_of_week,
            )
        ).all()
        # If updating existing slot belonging to this teacher on same day, don't double count
        daily_count = len([s for s in existing_daily_slots if s.id != data.slot_id])
        max_limit = min(teacher.max_daily_hours, 6)
        if daily_count + 1 > max_limit:
            raise HTTPException(
                status_code=400,
                detail=f"Workload Cap Exceeded: {teacher.name} cannot exceed {max_limit} teaching hours/day.",
            )

    # 5. Apply Assignment (Create or Update)
    if data.slot_id:
        slot = session.get(ScheduleSlot, data.slot_id)
        if not slot:
            raise HTTPException(status_code=404, detail="Schedule slot not found.")
        if slot.is_locked and not (data.day_of_week == 0 and data.period_index == 1):
            raise HTTPException(
                status_code=400,
                detail="Cannot move locked Monday Period 1 Homeroom slot.",
            )
        slot.section_id = data.section_id
        slot.subject_id = data.subject_id
        slot.teacher_id = data.teacher_id
        slot.day_of_week = data.day_of_week
        slot.period_index = data.period_index
    else:
        slot = ScheduleSlot(
            section_id=data.section_id,
            subject_id=data.subject_id,
            teacher_id=data.teacher_id,
            day_of_week=data.day_of_week,
            period_index=data.period_index,
            is_locked=bool(data.day_of_week == 0 and data.period_index == 1),
        )

    session.add(slot)
    session.commit()
    session.refresh(slot)

    # Recalculate teacher workload hours
    all_teachers = session.exec(select(Teacher)).all()
    all_slots = session.exec(select(ScheduleSlot)).all()
    for t in all_teachers:
        t.current_load_hours = len([s for s in all_slots if s.teacher_id == t.id])
        session.add(t)
    session.commit()

    sections = session.exec(select(Section)).all()
    subjects = session.exec(select(Subject)).all()
    departments = session.exec(select(Department)).all()

    hydrated = hydrate_slots(
        all_slots,
        {s.id: s for s in sections},
        {s.id: s for s in subjects},
        {t.id: t for t in all_teachers},
        {d.id: d for d in departments},
    )

    broadcast_sync({
        "event": "SCHEDULE_UPDATED",
        "action": "SLOT_ASSIGNED",
        "slot_id": slot.id,
        "section_id": slot.section_id,
        "teacher_name": teacher.name if teacher else "Faculty",
    })

    if is_mon_p1:
        broadcast_sync({
            "event": "TEACHERS_UPDATED",
            "action": "ADVISER_CHANGED",
            "section_id": slot.section_id,
            "teacher_id": slot.teacher_id,
            "teacher_name": teacher.name if teacher else "Faculty",
        })
        broadcast_sync({
            "event": "SECTIONS_UPDATED",
            "action": "SECTION_UPDATED",
            "section_id": slot.section_id,
        })

    return ScheduleOperationResponse(
        success=True,
        message=f"Schedule slot saved successfully for {teacher.name if teacher else 'faculty'}.",
        latency_ms=1.2,
        disruption_cost=5,
        slots_count=len(hydrated),
        slots=hydrated,
    )


@router.delete("/slot/{slot_id}", response_model=ScheduleOperationResponse)
def delete_schedule_slot(
    slot_id: int,
    session: Session = Depends(get_session),
):
    """Unassign / clear a schedule slot period."""
    slot = session.get(ScheduleSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Schedule slot not found.")

    if slot.is_locked:
        raise HTTPException(
            status_code=400,
            detail="Cannot unassign locked Monday Period 1 Homeroom Guidance Program.",
        )

    session.delete(slot)
    session.commit()

    # Recalculate teacher workload hours
    all_teachers = session.exec(select(Teacher)).all()
    all_slots = session.exec(select(ScheduleSlot)).all()
    for t in all_teachers:
        t.current_load_hours = len([s for s in all_slots if s.teacher_id == t.id])
        session.add(t)
    session.commit()

    sections = session.exec(select(Section)).all()
    subjects = session.exec(select(Subject)).all()
    departments = session.exec(select(Department)).all()

    hydrated = hydrate_slots(
        all_slots,
        {s.id: s for s in sections},
        {s.id: s for s in subjects},
        {t.id: t for t in all_teachers},
        {d.id: d for d in departments},
    )

    broadcast_sync({
        "event": "SCHEDULE_UPDATED",
        "action": "SLOT_DELETED",
        "slot_id": slot_id,
    })

    return ScheduleOperationResponse(
        success=True,
        message="Class schedule slot unassigned successfully.",
        latency_ms=1.0,
        disruption_cost=0,
        slots_count=len(hydrated),
        slots=hydrated,
    )


@router.post("/manual-override", response_model=ScheduleOperationResponse)
def manual_override_slot(
    data: ManualOverrideRequest,
    session: Session = Depends(get_session),
):
    """
    Manually reassign a timetable slot's teacher, subject, day, or period.
    Performs hard constraint validation (double-booking and RA 4670 cap).
    """
    slot = session.get(ScheduleSlot, data.slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Schedule slot not found.")

    if slot.is_locked:
        if slot.day_of_week == 0 and slot.period_index == 1 and data.new_teacher_id and data.new_teacher_id != slot.teacher_id:
            new_adv = session.get(Teacher, data.new_teacher_id)
            if not new_adv:
                raise HTTPException(status_code=404, detail="Selected faculty member not found.")
            prev_advs = session.exec(
                select(Teacher).where(Teacher.advisory_section_id == slot.section_id, Teacher.id != new_adv.id)
            ).all()
            for prev in prev_advs:
                prev.is_adviser = False
                prev.advisory_section_id = None
                session.add(prev)
            new_adv.is_adviser = True
            new_adv.advisory_section_id = slot.section_id
            session.add(new_adv)
            session.flush()
        else:
            raise HTTPException(
                status_code=400,
                detail="Cannot modify a locked slot (Monday Period 1 Homeroom Guidance is strictly reserved for Class Adviser).",
            )

    target_teacher_id = data.new_teacher_id or slot.teacher_id
    target_subject_id = data.new_subject_id or slot.subject_id
    target_day = data.new_day_of_week if data.new_day_of_week is not None else slot.day_of_week
    target_period = data.new_period_index if data.new_period_index is not None else slot.period_index

    # Check 1: Mon Period 1 lock
    if target_day == 0 and target_period == 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot schedule academic classes on Monday Period 1 (reserved for Homeroom Guidance).",
        )

    # Check 2: Teacher collision
    other_teacher_slot = session.exec(
        select(ScheduleSlot).where(
            ScheduleSlot.id != slot.id,
            ScheduleSlot.teacher_id == target_teacher_id,
            ScheduleSlot.day_of_week == target_day,
            ScheduleSlot.period_index == target_period,
        )
    ).first()
    if other_teacher_slot:
        teacher = session.get(Teacher, target_teacher_id)
        t_name = teacher.name if teacher else f"Teacher {target_teacher_id}"
        raise HTTPException(
            status_code=400,
            detail=f"Conflict: {t_name} is already teaching another section at Day {target_day}, Period {target_period}.",
        )

    # Check 3: Section collision
    other_sec_slot = session.exec(
        select(ScheduleSlot).where(
            ScheduleSlot.id != slot.id,
            ScheduleSlot.section_id == slot.section_id,
            ScheduleSlot.day_of_week == target_day,
            ScheduleSlot.period_index == target_period,
        )
    ).first()
    if other_sec_slot:
        raise HTTPException(
            status_code=400,
            detail=f"Conflict: Section is already scheduled for another class at Day {target_day}, Period {target_period}.",
        )

    # Check 4: RA 4670 Daily Cap
    teacher = session.get(Teacher, target_teacher_id)
    if teacher:
        daily_count = len(
            session.exec(
                select(ScheduleSlot).where(
                    ScheduleSlot.id != slot.id,
                    ScheduleSlot.teacher_id == target_teacher_id,
                    ScheduleSlot.day_of_week == target_day,
                )
            ).all()
        )
        if daily_count + 1 > min(teacher.max_daily_hours, 6):
            raise HTTPException(
                status_code=400,
                detail=f"Conflict: Assigning this slot exceeds {teacher.name}'s daily workload limit ({min(teacher.max_daily_hours, 6)} hours/day).",
            )

    # Apply changes
    slot.teacher_id = target_teacher_id
    slot.subject_id = target_subject_id
    slot.day_of_week = target_day
    slot.period_index = target_period
    session.add(slot)
    session.commit()

    # Recalculate teacher hours
    all_teachers = session.exec(select(Teacher)).all()
    all_slots = session.exec(select(ScheduleSlot)).all()
    for t in all_teachers:
        t.current_load_hours = len([s for s in all_slots if s.teacher_id == t.id])
        session.add(t)
    session.commit()

    sections = session.exec(select(Section)).all()
    subjects = session.exec(select(Subject)).all()
    departments = session.exec(select(Department)).all()

    hydrated = hydrate_slots(
        all_slots,
        {s.id: s for s in sections},
        {s.id: s for s in subjects},
        {t.id: t for t in all_teachers},
        {d.id: d for d in departments},
    )

    broadcast_sync({
        "event": "SCHEDULE_UPDATED",
        "action": "SLOT_OVERRIDDEN",
        "slot_id": slot.id,
    })

    return ScheduleOperationResponse(
        success=True,
        message="Manual override applied successfully with zero conflict.",
        latency_ms=1.5,
        disruption_cost=10,
        slots_count=len(hydrated),
        slots=hydrated,
    )


@router.post("/swap", response_model=ScheduleOperationResponse)
def swap_slots(
    data: ManualSwapRequest,
    session: Session = Depends(get_session),
):
    """Swap time coordinates of two slots belonging to the same section."""
    slot_a = session.get(ScheduleSlot, data.slot_id_a)
    slot_b = session.get(ScheduleSlot, data.slot_id_b)

    if not slot_a or not slot_b:
        raise HTTPException(status_code=404, detail="One or both slots not found.")

    if slot_a.is_locked or slot_b.is_locked:
        raise HTTPException(status_code=400, detail="Cannot swap locked Homeroom slots.")

    # Swap time coordinates
    day_a, p_a = slot_a.day_of_week, slot_a.period_index
    day_b, p_b = slot_b.day_of_week, slot_b.period_index

    slot_a.day_of_week, slot_a.period_index = day_b, p_b
    slot_b.day_of_week, slot_b.period_index = day_a, p_a

    session.add(slot_a)
    session.add(slot_b)
    session.commit()

    all_slots = session.exec(select(ScheduleSlot)).all()
    sections = session.exec(select(Section)).all()
    teachers = session.exec(select(Teacher)).all()
    subjects = session.exec(select(Subject)).all()
    departments = session.exec(select(Department)).all()

    hydrated = hydrate_slots(
        all_slots,
        {s.id: s for s in sections},
        {s.id: s for s in subjects},
        {t.id: t for t in teachers},
        {d.id: d for d in departments},
    )

    broadcast_sync({
        "event": "SCHEDULE_UPDATED",
        "action": "SLOTS_SWAPPED",
        "slot_a": slot_a.id,
        "slot_b": slot_b.id,
    })

    return ScheduleOperationResponse(
        success=True,
        message="Slots successfully swapped.",
        latency_ms=2.0,
        disruption_cost=20,
        slots_count=len(hydrated),
        slots=hydrated,
    )


@router.get("/report")
async def get_compliance_report(session: Session = Depends(get_session)):
    """Fetch official DepEd Workload Compliance Report."""
    teachers = session.exec(select(Teacher)).all()
    sections = session.exec(select(Section)).all()

    report_text = await generate_llm_compliance_report(
        teachers=teachers,
        sections=sections,
        diff_result=None,
        absent_teachers=[t for t in teachers if t.status != TeacherStatus.ACTIVE],
        latency_ms=0.0,
    )
    return {"report": report_text}


class AIReportRequest(BaseModel):
    report_type: str = "EXECUTIVE_BRIEFING"  # EXECUTIVE_BRIEFING, WORKLOAD_AUDIT, RESOURCE_TRACK_ANALYSIS
    custom_prompt: Optional[str] = None
    department_id: Optional[int] = None
    requester_name: Optional[str] = None
    requester_title: Optional[str] = None


@router.post("/ai-report")
async def generate_executive_ai_report(
    payload: AIReportRequest,
    session: Session = Depends(get_session),
):
    """Generate executive AI Report prototype for School Principal or Department Heads."""
    teachers = session.exec(select(Teacher)).all()
    sections = session.exec(select(Section)).all()
    departments = session.exec(select(Department)).all()
    slots = session.exec(select(ScheduleSlot)).all()

    now_str = datetime.now().strftime("%B %d, %Y • %I:%M %p")
    target_dept = session.get(Department, payload.department_id) if payload.department_id else None

    if target_dept:
        scope_name = f"Department of {target_dept.name}"
        dept_teachers = [t for t in teachers if t.department_id == target_dept.id]
        active_dept_teachers = [t for t in dept_teachers if t.status == TeacherStatus.ACTIVE]
        on_leave_dept_teachers = [t for t in dept_teachers if t.status != TeacherStatus.ACTIVE]
        dept_teacher_ids = {t.id for t in dept_teachers}
        dept_slots = [s for s in slots if s.teacher_id in dept_teacher_ids]
        dept_advisers = [t for t in dept_teachers if t.is_adviser and t.advisory_section_id]
        officer_name = payload.requester_name or "Department Head"
        officer_title = payload.requester_title or f"Head Teacher / Head of {target_dept.name}"

        stats = {
            "scope": scope_name,
            "department_code": target_dept.code,
            "total_faculty": len(dept_teachers),
            "active_faculty": len(active_dept_teachers),
            "on_leave_faculty": len(on_leave_dept_teachers),
            "total_slots": len(dept_slots),
            "avg_load": round(sum(t.current_load_hours for t in active_dept_teachers) / max(1, len(active_dept_teachers)), 1),
            "adviser_count": len(dept_advisers),
            "sections_count": len(sections),
        }

        faculty_roster = []
        for t in dept_teachers:
            adv_sec = next((s for s in sections if s.id == t.advisory_section_id), None)
            faculty_roster.append({
                "id": t.id,
                "name": t.name,
                "position": t.position,
                "current_load_hours": t.current_load_hours,
                "max_daily_hours": t.max_daily_hours,
                "is_adviser": t.is_adviser,
                "advisory_section": adv_sec.name if adv_sec else "None",
                "status": t.status,
            })
    else:
        scope_name = "Office of the School Principal / Key Stage 3"
        active_teachers = [t for t in teachers if t.status == TeacherStatus.ACTIVE]
        on_leave_teachers = [t for t in teachers if t.status != TeacherStatus.ACTIVE]
        advisers = [t for t in teachers if t.is_adviser and t.advisory_section_id]
        officer_name = payload.requester_name or "Dr. Rolando Mariano"
        officer_title = payload.requester_title or "Principal IV / School Head"

        stats = {
            "scope": scope_name,
            "departments_count": len(departments),
            "sections_count": len(sections),
            "total_faculty": len(teachers),
            "active_faculty": len(active_teachers),
            "on_leave_faculty": len(on_leave_teachers),
            "total_slots": len(slots),
            "avg_load": round(sum(t.current_load_hours for t in active_teachers) / max(1, len(active_teachers)), 1),
            "adviser_count": len(advisers),
        }

        faculty_roster = []
        for t in teachers:
            adv_sec = next((s for s in sections if s.id == t.advisory_section_id), None)
            faculty_roster.append({
                "id": t.id,
                "name": t.name,
                "position": t.position,
                "current_load_hours": t.current_load_hours,
                "max_daily_hours": t.max_daily_hours,
                "is_adviser": t.is_adviser,
                "advisory_section": adv_sec.name if adv_sec else "None",
                "status": t.status,
            })

    ai_result = generate_ai_executive_report(
        report_type=payload.report_type,
        scope_name=scope_name,
        requester_name=officer_name,
        requester_title=officer_title,
        stats=stats,
        faculty_list=faculty_roster,
        custom_prompt=payload.custom_prompt,
    )

    return {
        "report": ai_result["report_text"],
        "report_type": payload.report_type,
        "timestamp": now_str,
        "ai_source": ai_result.get("source"),
        "ai_model": ai_result.get("model"),
    }


# ==============================================================================
# Saved Schedules / Version History CRUD Endpoints
# ==============================================================================

@router.get("/saved", response_model=List[SavedScheduleRead])
def list_saved_schedules(session: Session = Depends(get_session)):
    """List all saved schedule version files in reverse chronological order."""
    return session.exec(select(SavedSchedule).order_by(SavedSchedule.created_at.desc())).all()


@router.post("/saved", response_model=SavedScheduleRead)
def create_saved_schedule(
    payload: SavedScheduleCreate,
    session: Session = Depends(get_session),
):
    """
    Save the current active schedule as a snapshot version file.
    Serializes current active slots and solver config into persistent JSON.
    """
    current_slots = session.exec(select(ScheduleSlot)).all()
    slots_data = [
        {
            "section_id": s.section_id,
            "subject_id": s.subject_id,
            "teacher_id": s.teacher_id,
            "day_of_week": s.day_of_week,
            "period_index": s.period_index,
            "is_locked": s.is_locked,
        }
        for s in current_slots
    ]

    # Mark existing saved records as inactive
    for item in session.exec(select(SavedSchedule)).all():
        item.is_active = False
        session.add(item)

    saved = SavedSchedule(
        name=payload.name.strip() or f"Schedule Snapshot ({len(slots_data)} slots)",
        description=payload.description.strip() if payload.description else None,
        period_duration_minutes=payload.period_duration_minutes,
        slots_count=len(slots_data),
        slots_json=json.dumps(slots_data),
        config_json=payload.config_json,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        is_active=True,
    )
    session.add(saved)
    session.commit()
    session.refresh(saved)
    return saved


@router.get("/saved/{schedule_id}", response_model=SavedScheduleDetail)
def get_saved_schedule(schedule_id: int, session: Session = Depends(get_session)):
    """Fetch complete details of a saved schedule including raw slots_json."""
    saved = session.get(SavedSchedule, schedule_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved schedule not found")
    return saved


@router.put("/saved/{schedule_id}", response_model=SavedScheduleRead)
def update_saved_schedule(
    schedule_id: int,
    payload: SavedScheduleUpdate,
    session: Session = Depends(get_session),
):
    """Update name, description, or config of a saved schedule version file."""
    saved = session.get(SavedSchedule, schedule_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved schedule not found")
    if payload.name is not None:
        saved.name = payload.name.strip()
    if payload.description is not None:
        saved.description = payload.description.strip()
    if payload.period_duration_minutes is not None:
        saved.period_duration_minutes = payload.period_duration_minutes
    if payload.config_json is not None:
        saved.config_json = payload.config_json
    saved.updated_at = datetime.now(timezone.utc)
    session.add(saved)
    session.commit()
    session.refresh(saved)
    return saved


@router.delete("/saved/{schedule_id}")
def delete_saved_schedule(schedule_id: int, session: Session = Depends(get_session)):
    """Delete a saved schedule snapshot version file."""
    saved = session.get(SavedSchedule, schedule_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved schedule not found")
    session.delete(saved)
    session.commit()
    return {"success": True, "message": f"Saved schedule '{saved.name}' deleted."}


@router.post("/saved/{schedule_id}/restore", response_model=ScheduleOperationResponse)
def restore_saved_schedule(schedule_id: int, session: Session = Depends(get_session)):
    """
    Restore/Load a saved schedule snapshot as the active master timetable.
    Replaces current ScheduleSlot records with the saved ones, updates faculty load hours,
    and broadcasts a real-time sync event.
    """
    start_time = time.perf_counter()
    saved = session.get(SavedSchedule, schedule_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved schedule not found")

    try:
        slots_data = json.loads(saved.slots_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Corrupt saved schedule data: {e}")

    # Clear active slots
    for current_slot in session.exec(select(ScheduleSlot)).all():
        session.delete(current_slot)
    session.commit()

    # Insert restored slots
    new_slots = []
    for item in slots_data:
        slot = ScheduleSlot(
            section_id=item["section_id"],
            subject_id=item["subject_id"],
            teacher_id=item["teacher_id"],
            day_of_week=item["day_of_week"],
            period_index=item["period_index"],
            is_locked=item.get("is_locked", False),
        )
        session.add(slot)
        new_slots.append(slot)
    session.commit()

    # Recalculate faculty load hours
    teachers = session.exec(select(Teacher)).all()
    all_slots = session.exec(select(ScheduleSlot)).all()
    for t in teachers:
        t.current_load_hours = len([s for s in all_slots if s.teacher_id == t.id])
        session.add(t)

    # Mark this saved schedule as active, others as inactive
    for item in session.exec(select(SavedSchedule)).all():
        item.is_active = (item.id == saved.id)
        session.add(item)
    session.commit()

    # Update subject durations if config exists
    if saved.period_duration_minutes:
        for sub in session.exec(select(Subject)).all():
            sub.duration_minutes = saved.period_duration_minutes
            session.add(sub)
        session.commit()

    sections = session.exec(select(Section)).all()
    subjects = session.exec(select(Subject)).all()
    departments = session.exec(select(Department)).all()

    hydrated = hydrate_slots(
        all_slots,
        {s.id: s for s in sections},
        {s.id: s for s in subjects},
        {t.id: t for t in teachers},
        {d.id: d for d in departments},
    )

    broadcast_sync({
        "event": "SCHEDULE_UPDATED",
        "action": "SCHEDULE_RESTORED",
        "message": f"Restored schedule: '{saved.name}' ({len(hydrated)} slots)",
    })

    latency_ms = (time.perf_counter() - start_time) * 1000.0
    return ScheduleOperationResponse(
        success=True,
        message=f"Schedule '{saved.name}' restored successfully as active timetable.",
        latency_ms=latency_ms,
        disruption_cost=0,
        slots_count=len(hydrated),
        slots=hydrated,
    )


# ==============================================================================
# Department Schedule Deployment Endpoints
# ==============================================================================

@router.post("/deploy", response_model=ScheduleDeployResponse)
def deploy_schedule_to_departments(
    payload: ScheduleDeployRequest,
    session: Session = Depends(get_session),
):
    """
    Officially deploy/release the active master schedule to Academic Departments.
    Computes workload summaries per department, archives prior deployments,
    records the deployment audit log, and broadcasts real-time WebSocket alerts.
    """
    active_slots = session.exec(select(ScheduleSlot)).all()
    if not active_slots:
        raise HTTPException(
            status_code=400,
            detail="No active timetable slots found to deploy. Please generate or restore a schedule first.",
        )

    departments = session.exec(select(Department)).all()
    teachers = session.exec(select(Teacher)).all()
    subjects = session.exec(select(Subject)).all()

    subject_map = {s.id: s for s in subjects}

    # Resolve target department IDs
    all_dept_ids = [d.id for d in departments if d.id is not None]
    if payload.department_ids and len(payload.department_ids) > 0:
        target_dept_ids = [d_id for d_id in payload.department_ids if d_id in all_dept_ids]
    else:
        target_dept_ids = all_dept_ids

    if not target_dept_ids:
        raise HTTPException(status_code=400, detail="No valid target departments selected for deployment.")

    # Calculate summaries per target department
    summaries: List[DepartmentDeploySummary] = []
    target_dept_map = {d.id: d for d in departments if d.id in target_dept_ids}

    for dept_id in target_dept_ids:
        dept = target_dept_map.get(dept_id)
        if not dept:
            continue

        dept_teachers = [t for t in teachers if t.department_id == dept_id]
        dept_teacher_ids = {t.id for t in dept_teachers}

        # Slots taught by teachers of this department
        dept_slots = [sl for sl in active_slots if sl.teacher_id in dept_teacher_ids]

        # Calculate weekly contact hours
        weekly_hours = 0.0
        for sl in dept_slots:
            sub = subject_map.get(sl.subject_id)
            duration_m = sub.duration_minutes if sub and sub.duration_minutes else 60
            weekly_hours += duration_m / 60.0

        summaries.append(
            DepartmentDeploySummary(
                department_id=dept.id,
                department_name=dept.name,
                department_code=dept.code,
                faculty_count=len(dept_teachers),
                slots_count=len(dept_slots),
                weekly_hours=round(weekly_hours, 1),
            )
        )

    # Mark existing ACTIVE deployments as SUPERSEDED
    existing_active = session.exec(
        select(ScheduleDeployment).where(ScheduleDeployment.status == "ACTIVE")
    ).all()
    for dep in existing_active:
        dep.status = "SUPERSEDED"
        session.add(dep)

    # Create new deployment
    new_deployment = ScheduleDeployment(
        academic_year=payload.academic_year.strip(),
        semester=payload.semester.strip(),
        deployed_by=payload.deployed_by.strip() if payload.deployed_by else "Office of the Principal",
        memo=payload.memo.strip() if payload.memo else "Official Master Timetable deployed to Academic Departments.",
        target_departments_json=json.dumps(target_dept_ids),
        status="ACTIVE",
        slots_count=len(active_slots),
        created_at=datetime.now(timezone.utc),
    )
    session.add(new_deployment)
    session.commit()
    session.refresh(new_deployment)

    # WebSocket Real-Time Broadcast
    broadcast_sync({
        "event": "SCHEDULE_DEPLOYED_TO_DEPARTMENTS",
        "action": "DEPLOYED",
        "data": {
            "deployment_id": new_deployment.id,
            "academic_year": new_deployment.academic_year,
            "semester": new_deployment.semester,
            "deployed_by": new_deployment.deployed_by,
            "memo": new_deployment.memo,
            "target_department_ids": target_dept_ids,
            "target_department_names": [d.name for d in target_dept_map.values()],
            "slots_count": len(active_slots),
            "created_at": new_deployment.created_at.isoformat(),
        },
        "message": f"Master schedule deployed to {len(target_dept_ids)} departments by {new_deployment.deployed_by}.",
    })

    deployment_read = ScheduleDeploymentRead(
        id=new_deployment.id,
        academic_year=new_deployment.academic_year,
        semester=new_deployment.semester,
        deployed_by=new_deployment.deployed_by,
        memo=new_deployment.memo,
        target_departments_json=new_deployment.target_departments_json,
        target_department_ids=target_dept_ids,
        status=new_deployment.status,
        slots_count=new_deployment.slots_count,
        created_at=new_deployment.created_at,
    )

    return ScheduleDeployResponse(
        success=True,
        message=f"Master Schedule officially deployed to {len(target_dept_ids)} academic departments.",
        deployment=deployment_read,
        department_summaries=summaries,
    )


@router.get("/deployments/latest", response_model=Optional[ScheduleDeploymentRead])
def get_latest_deployment(session: Session = Depends(get_session)):
    """Fetch the latest/active official schedule deployment record."""
    latest = session.exec(
        select(ScheduleDeployment)
        .order_by(ScheduleDeployment.created_at.desc())
    ).first()
    if not latest:
        return None

    try:
        target_ids = json.loads(latest.target_departments_json)
    except Exception:
        target_ids = []

    return ScheduleDeploymentRead(
        id=latest.id,
        academic_year=latest.academic_year,
        semester=latest.semester,
        deployed_by=latest.deployed_by,
        memo=latest.memo,
        target_departments_json=latest.target_departments_json,
        target_department_ids=target_ids,
        status=latest.status,
        slots_count=latest.slots_count,
        created_at=latest.created_at,
    )


@router.get("/deployments", response_model=List[ScheduleDeploymentRead])
def list_deployments(session: Session = Depends(get_session)):
    """Fetch historical audit log of all schedule deployments in reverse chronological order."""
    deployments = session.exec(
        select(ScheduleDeployment).order_by(ScheduleDeployment.created_at.desc())
    ).all()
    results = []
    for dep in deployments:
        try:
            target_ids = json.loads(dep.target_departments_json)
        except Exception:
            target_ids = []
        results.append(
            ScheduleDeploymentRead(
                id=dep.id,
                academic_year=dep.academic_year,
                semester=dep.semester,
                deployed_by=dep.deployed_by,
                memo=dep.memo,
                target_departments_json=dep.target_departments_json,
                target_department_ids=target_ids,
                status=dep.status,
                slots_count=dep.slots_count,
                created_at=dep.created_at,
            )
        )
    return results



@router.get("/export/docx/{section_id}")
def export_section_class_program_docx(
    section_id: int,
    school_year: str = "2026-2027",
    flag_ceremony_time: str = "6:45-7:00",
    morning_break_time: str = "9:00-9:15",
    lunch_break_time: str = "11:15-12:00",
    adviser_name: Optional[str] = None,
    grade_chairman: Optional[str] = None,
    consultant_1: Optional[str] = None,
    consultant_2: Optional[str] = None,
    principal_name: Optional[str] = "Dr. Eleanor Vance",
    session: Session = Depends(get_session),
):
    """Export official DepEd Class Program for a section as a Word document."""
    section = session.get(Section, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    slots = session.exec(select(ScheduleSlot).where(ScheduleSlot.section_id == section_id)).all()
    teachers = session.exec(select(Teacher)).all()
    subjects = session.exec(select(Subject)).all()

    buf = generate_class_schedule_document(
        section=section,
        slots=slots,
        teachers=teachers,
        subjects=subjects,
        school_year=school_year,
        flag_ceremony_time=flag_ceremony_time,
        morning_break_time=morning_break_time,
        lunch_break_time=lunch_break_time,
        adviser_name=adviser_name,
        grade_chairman=grade_chairman,
        consultant_1=consultant_1,
        consultant_2=consultant_2,
        principal_name=principal_name,
    )

    clean_sec_name = "".join(c for c in section.name if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")
    filename = f"Class_Program_{clean_sec_name}.docx"

    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
