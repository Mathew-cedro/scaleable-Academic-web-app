"""
Schedule Diff Engine & Disruption Cost Evaluator.
Calculates structural disruption and tracks displaced/reassigned classes
during fault-tolerant dynamic schedule repair.
"""

from typing import Dict, List, Tuple
from app.models import ScheduleSlot, Section, Subject, Teacher
from app.schemas import DiffResult, SlotDiffItem


def compute_schedule_diff(
    original_slots: List[ScheduleSlot],
    repaired_slots: List[ScheduleSlot],
    teachers_map: Dict[int, Teacher],
    sections_map: Dict[int, Section],
    subjects_map: Dict[int, Subject],
) -> DiffResult:
    """
    Compare original schedule with repaired schedule to quantify disruption.
    - Reassigned: Same (section, subject, day, period), but teacher changed (substitute).
    - Moved: Same (section, subject, teacher), but day/period changed.
    - Displaced: Both day/period and teacher changed.
    - Untouched: Identical assignment preserved.
    """
    diff_items: List[SlotDiffItem] = []
    displaced_count = 0
    reassigned_count = 0
    unaffected_count = 0

    # Index original slots by (section_id, subject_id, occurrence)
    # or compare matching slot IDs if existing slots are updated
    orig_by_id = {s.id: s for s in original_slots if s.id is not None}
    orig_by_slot = {(s.section_id, s.day_of_week, s.period_index): s for s in original_slots}

    # Track which original slots have been matched
    matched_orig_ids = set()

    for rep in repaired_slots:
        sec = sections_map.get(rep.section_id)
        sub = subjects_map.get(rep.subject_id)
        rep_teacher = teachers_map.get(rep.teacher_id)

        sec_name = sec.name if sec else f"Section {rep.section_id}"
        sub_name = sub.name if sub else f"Subject {rep.subject_id}"
        rep_teacher_name = rep_teacher.name if rep_teacher else f"Teacher {rep.teacher_id}"

        # Check if matching slot exists at the same day & period
        orig_slot = orig_by_slot.get((rep.section_id, rep.day_of_week, rep.period_index))

        if orig_slot:
            matched_orig_ids.add(orig_slot.id)
            orig_teacher = teachers_map.get(orig_slot.teacher_id)
            orig_teacher_name = orig_teacher.name if orig_teacher else f"Teacher {orig_slot.teacher_id}"

            if orig_slot.teacher_id == rep.teacher_id and orig_slot.subject_id == rep.subject_id:
                # Slot is unchanged
                unaffected_count += 1
            elif orig_slot.subject_id == rep.subject_id and orig_slot.teacher_id != rep.teacher_id:
                # Substitute assigned for this class
                reassigned_count += 1
                diff_items.append(
                    SlotDiffItem(
                        action="REASSIGNED",
                        slot_id=rep.id or 0,
                        section_name=sec_name,
                        subject_name=sub_name,
                        day_of_week=rep.day_of_week,
                        period_index=rep.period_index,
                        original_teacher_name=orig_teacher_name,
                        new_teacher_name=rep_teacher_name,
                        reason=f"Substitute assigned: {orig_teacher_name} -> {rep_teacher_name} (Underloaded priority)",
                    )
                )
            else:
                # Subject/slot altered
                displaced_count += 1
                diff_items.append(
                    SlotDiffItem(
                        action="MODIFIED",
                        slot_id=rep.id or 0,
                        section_name=sec_name,
                        subject_name=sub_name,
                        day_of_week=rep.day_of_week,
                        period_index=rep.period_index,
                        original_teacher_name=orig_teacher_name,
                        new_teacher_name=rep_teacher_name,
                        reason=f"Slot timetable modified for {sec_name}",
                    )
                )
        else:
            # Slot moved to a new time block
            displaced_count += 1
            diff_items.append(
                SlotDiffItem(
                    action="MOVED",
                    slot_id=rep.id or 0,
                    section_name=sec_name,
                    subject_name=sub_name,
                    day_of_week=rep.day_of_week,
                    period_index=rep.period_index,
                    original_teacher_name=None,
                    new_teacher_name=rep_teacher_name,
                    reason=f"Class moved to Day {rep.day_of_week}, Period {rep.period_index}",
                )
            )

    # Disruption Cost calculation:
    # 100 points per displaced/moved slot + 10 points per teacher substitution
    disruption_cost = (displaced_count * 100) + (reassigned_count * 10)

    return DiffResult(
        disruption_cost=disruption_cost,
        displaced_count=displaced_count,
        reassigned_count=reassigned_count,
        unaffected_count=unaffected_count,
        diff_items=diff_items,
    )
