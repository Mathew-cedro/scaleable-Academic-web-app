"""
New Hire Onboarding & Conflict Intelligence Service.
Verifies prospective teacher schedules against active master timetable.
Detects section/room clashes, RA 4670 limits, and identifies workload relief opportunities.
"""

from typing import Dict, List, Optional
from sqlmodel import Session, select

from app.models import Department, ScheduleSlot, Section, Subject, Teacher
from app.schemas import (
    NewHireAuditRequest,
    NewHireAuditResponse,
    SlotClashItem,
    WorkloadReliefOpportunity,
)

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


def audit_new_hire(session: Session, req: NewHireAuditRequest) -> NewHireAuditResponse:
    """
    Run conflict and compliance checks on a prospective teacher or new hire.
    """
    department = session.get(Department, req.department_id)
    dept_name = department.name if department else "Unknown Dept"

    all_slots = session.exec(select(ScheduleSlot)).all()
    all_sections = session.exec(select(Section)).all()
    section_map = {s.id: s for s in all_sections}
    all_subjects = session.exec(select(Subject)).all()
    subject_map = {sub.id: sub for sub in all_subjects}
    all_teachers = session.exec(select(Teacher)).all()
    teacher_map = {t.id: t for t in all_teachers}

    clashes: List[SlotClashItem] = []
    daily_loads: Dict[int, int] = {day: 0 for day in range(5)}

    # 1. Evaluate proposed slots
    for proposed in req.proposed_slots:
        day = proposed.day_of_week
        period = proposed.period_index
        day_label = DAYS[day] if 0 <= day < 5 else f"Day {day}"

        daily_loads[day] = daily_loads.get(day, 0) + 1

        # Check section collision (is this section already occupied during this period?)
        existing_sec_slot = next(
            (s for s in all_slots if s.section_id == proposed.section_id and s.day_of_week == day and s.period_index == period),
            None
        )
        if existing_sec_slot:
            sec_name = section_map.get(proposed.section_id).name if proposed.section_id in section_map else f"Section #{proposed.section_id}"
            curr_teacher = teacher_map.get(existing_sec_slot.teacher_id)
            curr_t_name = curr_teacher.name if curr_teacher else "Another Teacher"
            curr_sub = subject_map.get(existing_sec_slot.subject_id)
            curr_sub_name = curr_sub.name if curr_sub else "Subject"

            clashes.append(
                SlotClashItem(
                    slot_type="SECTION_CLASH",
                    day_of_week=day,
                    period_index=period,
                    description=f"{sec_name} already scheduled for '{curr_sub_name}' with {curr_t_name} on {day_label} Period {period}.",
                    severity="CRITICAL",
                )
            )

        # Check room collision
        target_room = proposed.room_number or (section_map.get(proposed.section_id).room_number if proposed.section_id in section_map else None)
        if target_room:
            for slot in all_slots:
                if slot.day_of_week == day and slot.period_index == period and slot.section_id != proposed.section_id:
                    sec = section_map.get(slot.section_id)
                    if sec and sec.room_number.strip().lower() == target_room.strip().lower():
                        t_name = teacher_map.get(slot.teacher_id).name if slot.teacher_id in teacher_map else "Faculty"
                        clashes.append(
                            SlotClashItem(
                                slot_type="ROOM_CLASH",
                                day_of_week=day,
                                period_index=period,
                                description=f"{target_room} is occupied by {sec.name} ({t_name}) on {day_label} Period {period}.",
                                severity="CRITICAL",
                            )
                        )
                        break

    # 2. Check RA 4670 daily limit
    for day, load in daily_loads.items():
        if load > min(req.max_daily_hours, 6):
            day_label = DAYS[day] if 0 <= day < 5 else f"Day {day}"
            clashes.append(
                SlotClashItem(
                    slot_type="TEACHER_OVERLOAD",
                    day_of_week=day,
                    period_index=0,
                    description=f"RA 4670 Cap Exceeded: Proposed teaching load for {day_label} is {load} hours (maximum allowable is 6 hours/day).",
                    severity="CRITICAL",
                )
            )

    total_hours = sum(daily_loads.values())
    if total_hours > req.max_weekly_hours:
        clashes.append(
            SlotClashItem(
                slot_type="TEACHER_OVERLOAD",
                day_of_week=0,
                period_index=0,
                description=f"Weekly load of {total_hours} hours exceeds policy maximum of {req.max_weekly_hours} hours/week.",
                severity="WARNING",
            )
        )

    # 3. Find Workload Relief Opportunities in the department
    relief_opportunities: List[WorkloadReliefOpportunity] = []
    
    # Calculate actual slot count per teacher
    teacher_slot_counts: Dict[int, int] = {}
    for s in all_slots:
        teacher_slot_counts[s.teacher_id] = teacher_slot_counts.get(s.teacher_id, 0) + 1

    dept_teachers = [t for t in all_teachers if t.department_id == req.department_id]
    sorted_teachers = sorted(
        dept_teachers,
        key=lambda t: max(teacher_slot_counts.get(t.id, 0), t.current_load_hours),
        reverse=True
    )

    for over_t in sorted_teachers:
        effective_load = max(teacher_slot_counts.get(over_t.id, 0), over_t.current_load_hours)
        if effective_load <= 0:
            continue
        t_slots = [s for s in all_slots if s.teacher_id == over_t.id and not s.is_locked]
        for s in t_slots[:2]:
            sec = section_map.get(s.section_id)
            sub = subject_map.get(s.subject_id)
            sec_name = sec.name if sec else f"Section #{s.section_id}"
            sub_name = sub.name if sub else f"Subject #{s.subject_id}"
            room_name = sec.room_number if sec else "Room"

            relief_opportunities.append(
                WorkloadReliefOpportunity(
                    overloaded_teacher_id=over_t.id,
                    overloaded_teacher_name=over_t.name,
                    current_weekly_load=effective_load,
                    slot_id=s.id,
                    day_of_week=s.day_of_week,
                    period_index=s.period_index,
                    section_name=sec_name,
                    subject_name=sub_name,
                    room_number=room_name,
                    reason=f"Relieves {over_t.name} (assigned {effective_load} teaching hours).",
                )
            )
            if len(relief_opportunities) >= 6:
                break
        if len(relief_opportunities) >= 6:
            break

    critical_clashes = [c for c in clashes if c.severity == "CRITICAL"]
    can_commit = len(critical_clashes) == 0

    if critical_clashes:
        feasibility = "CONFLICT"
        summary = f"Cannot onboard with requested schedule: {len(critical_clashes)} critical collision(s) detected."
    elif clashes:
        feasibility = "WARNING"
        summary = f"Schedule is feasible with {len(clashes)} non-critical warning(s)."
    else:
        feasibility = "FEASIBLE"
        summary = f"Schedule is completely conflict-free and compliant with RA 4670 ({total_hours} hrs/week)."

    return NewHireAuditResponse(
        feasibility=feasibility,
        can_commit=can_commit,
        summary=summary,
        clashes=clashes,
        relief_opportunities=relief_opportunities,
        proposed_daily_loads=daily_loads,
        proposed_total_hours=total_hours,
        is_ra4670_compliant=all(c.slot_type != "TEACHER_OVERLOAD" for c in clashes),
    )
