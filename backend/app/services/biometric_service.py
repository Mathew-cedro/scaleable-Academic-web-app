"""
Biometric Scan Attendance (DTR) Ingestion & Dynamic Substitution Engine.
Bridges physical biometric attendance scans to automated timetable fault-tolerance.
Detects teacher absences at morning cutoff and recommends substitutes per DO 005, s. 2024 & RA 4670.
"""

import io
import csv
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
from sqlmodel import Session, select
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from app.models import (
    BiometricAttendanceLog,
    Department,
    ScheduleSlot,
    Section,
    Subject,
    Teacher,
    TeacherStatus,
)
from app.schemas import (
    BiometricProcessResponse,
    BiometricLogRead,
    SubstituteRecommendation,
)
from app.websocket_manager import broadcast_sync


def generate_dtr_template_bytes() -> bytes:
    """Generate sample biometric DTR scan attendance spreadsheet (.xlsx)."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Biometric DTR Logs"

    headers = [
        "Teacher Name",
        "Department Code",
        "Date",
        "Time In",
        "Time Out",
        "Biometric Terminal ID",
        "Remarks",
    ]

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="3D055E", end_color="3D055E", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center")

    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align

    # Realistic sample rows
    today_str = datetime.now().strftime("%Y-%m-%d")
    sample_data = [
        ["Dr. Aris Thorne", "SCI", today_str, "07:12 AM", "04:30 PM", "BIO-GATE-01", "Present (Normal Scan)"],
        ["Mr. David Chen", "SCI", today_str, "07:20 AM", "04:30 PM", "BIO-GATE-01", "Present (Normal Scan)"],
        ["Ms. Camille Santos", "SCI", today_str, "", "", "BIO-GATE-01", "Absent / No Scan Recorded"],
        ["Mrs. Elena Rostova", "MATH", today_str, "07:10 AM", "04:45 PM", "BIO-GATE-02", "Present (Normal Scan)"],
        ["Mr. Gabriel Torres", "MATH", today_str, "08:15 AM", "05:00 PM", "BIO-GATE-02", "Late (Scanned after cutoff)"],
        ["Mr. Jonathan Hayes", "ENG", today_str, "", "", "BIO-GATE-01", "Medical Leave (FAS-2026)"],
        ["G. Danilo Ramos", "FIL", today_str, "07:05 AM", "04:15 PM", "BIO-GATE-02", "Present (Normal Scan)"],
    ]

    for row in sample_data:
        ws.append(row)

    col_widths = [24, 16, 14, 14, 14, 22, 28]
    for idx, width in enumerate(col_widths, start=1):
        col_letter = openpyxl.utils.get_column_letter(idx)
        ws.column_dimensions[col_letter].width = width

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def parse_dtr_rows(file_bytes: bytes, filename: str) -> List[Tuple[int, Dict[str, str]]]:
    """Parse DTR entries from Excel or CSV."""
    rows = []
    if filename.lower().endswith(".csv"):
        text = file_bytes.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        for row_num, row in enumerate(reader, start=2):
            normalized = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            rows.append((row_num, normalized))
    else:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        ws = wb.active
        all_rows = list(ws.iter_rows(values_only=True))
        if not all_rows:
            return []
        headers = [str(h).strip().lower() if h else f"col_{i}" for i, h in enumerate(all_rows[0])]
        for row_num, values in enumerate(all_rows[1:], start=2):
            if not any(values):
                continue
            row_dict = {}
            for h, v in zip(headers, values):
                row_dict[h] = str(v).strip() if v is not None else ""
            rows.append((row_num, row_dict))
    return rows


def process_biometric_log(
    session: Session,
    file_bytes: bytes,
    filename: str,
    cutoff_time_str: str = "07:45",
    target_day_of_week: Optional[int] = None,
) -> BiometricProcessResponse:
    """
    Ingest biometric scans, detect teacher absences, flag affected timetable slots,
    and formulate underloaded substitute assignments per DO 005, s. 2024.
    """
    rows = parse_dtr_rows(file_bytes, filename)
    all_teachers = session.exec(select(Teacher)).all()
    teacher_by_name = {t.name.lower(): t for t in all_teachers}
    all_depts = session.exec(select(Department)).all()
    dept_map = {d.id: d for d in all_depts}
    all_sections = session.exec(select(Section)).all()
    section_map = {s.id: s for s in all_sections}
    all_subjects = session.exec(select(Subject)).all()
    subject_map = {sub.id: sub for sub in all_subjects}

    # Determine default day of week from system clock if not supplied
    if target_day_of_week is None:
        target_day_of_week = min(datetime.now().weekday(), 4)  # 0 to 4 (Mon to Fri)

    today_str = datetime.now().strftime("%Y-%m-%d")
    scanned_teacher_ids = set()
    attendance_records: List[BiometricAttendanceLog] = []

    present_count = 0
    late_count = 0
    absent_count = 0

    absent_teachers_list: List[Dict[str, Any]] = []

    for row_num, r in rows:
        t_name = (r.get("teacher name") or r.get("teacher") or r.get("name") or "").strip()
        dept_code = (r.get("department code") or r.get("department") or "").strip().upper()
        date_str = r.get("date") or today_str
        time_in_raw = (r.get("time in") or r.get("time_in") or "").strip()
        time_out_raw = (r.get("time out") or r.get("time_out") or "").strip()
        remarks = (r.get("remarks") or r.get("status") or "").strip().lower()

        teacher = teacher_by_name.get(t_name.lower())
        teacher_id = teacher.id if teacher else None

        # Determine attendance status
        is_absent = (not time_in_raw) or ("absent" in remarks) or ("leave" in remarks)
        if is_absent:
            status = "ABSENT"
            absent_count += 1
            if teacher:
                absent_teachers_list.append({
                    "id": teacher.id,
                    "name": teacher.name,
                    "department": dept_map.get(teacher.department_id).name if teacher.department_id in dept_map else "",
                    "position": teacher.position,
                })
        else:
            # Check for tardiness
            status = "PRESENT"
            present_count += 1
            if "late" in remarks or (time_in_raw and "08:" in time_in_raw):
                status = "LATE"
                late_count += 1

        if teacher_id:
            scanned_teacher_ids.add(teacher_id)

        log_record = BiometricAttendanceLog(
            date=date_str,
            teacher_id=teacher_id,
            teacher_name=t_name,
            department_code=dept_code,
            time_in=time_in_raw or None,
            time_out=time_out_raw or None,
            status=status,
            is_covered=False,
            notes=remarks or f"Biometric Import ({filename})",
        )
        session.add(log_record)
        attendance_records.append(log_record)

    session.flush()

    # Find schedule slots for today taught by absent teachers
    absent_teacher_ids = {a["id"] for a in absent_teachers_list}
    affected_slots = session.exec(
        select(ScheduleSlot).where(
            ScheduleSlot.day_of_week == target_day_of_week,
            ScheduleSlot.teacher_id.in_(absent_teacher_ids)
        )
    ).all()

    # Build active slot map for today to find teachers who are FREE during each period
    all_today_slots = session.exec(
        select(ScheduleSlot).where(ScheduleSlot.day_of_week == target_day_of_week)
    ).all()

    busy_teachers_by_period: Dict[int, set] = {}
    teacher_daily_load: Dict[int, int] = {}
    for slot in all_today_slots:
        busy_teachers_by_period.setdefault(slot.period_index, set()).add(slot.teacher_id)
        teacher_daily_load[slot.teacher_id] = teacher_daily_load.get(slot.teacher_id, 0) + 1

    recommendations: List[SubstituteRecommendation] = []

    for slot in affected_slots:
        sec = section_map.get(slot.section_id)
        sub = subject_map.get(slot.subject_id)
        orig_teacher = next((t for t in all_teachers if t.id == slot.teacher_id), None)
        orig_name = orig_teacher.name if orig_teacher else "Unknown Teacher"
        sec_name = sec.name if sec else f"Section #{slot.section_id}"
        sub_name = sub.name if sub else f"Subject #{slot.subject_id}"
        room_num = sec.room_number if sec else "Room"

        # Candidate pool: active teachers, not on leave, not absent, free this period
        candidates = [
            t for t in all_teachers
            if t.id not in absent_teacher_ids
            and t.id not in busy_teachers_by_period.get(slot.period_index, set())
            and teacher_daily_load.get(t.id, 0) < min(t.max_daily_hours, 6)
            and t.status == TeacherStatus.ACTIVE
        ]

        if not candidates:
            # No free candidate without exceeding daily load
            continue

        # Sort candidates:
        # 1. Matching department prioritized
        # 2. Lowest current weekly load (DepEd DO 005, s. 2024 compliance)
        # 3. Lowest daily load today
        target_dept_id = orig_teacher.department_id if orig_teacher else None

        def candidate_rank(t: Teacher):
            dept_match = 0 if (target_dept_id and t.department_id == target_dept_id) else 1
            return (dept_match, t.current_load_hours, teacher_daily_load.get(t.id, 0))

        candidates.sort(key=candidate_rank)
        chosen = candidates[0]

        # Tentatively increment load
        busy_teachers_by_period.setdefault(slot.period_index, set()).add(chosen.id)
        teacher_daily_load[chosen.id] = teacher_daily_load.get(chosen.id, 0) + 1

        chosen_dept = dept_map.get(chosen.department_id)
        dept_name = chosen_dept.name if chosen_dept else "General"

        recommendations.append(
            SubstituteRecommendation(
                slot_id=slot.id,
                day_of_week=slot.day_of_week,
                period_index=slot.period_index,
                section_name=sec_name,
                subject_name=sub_name,
                room_number=room_num,
                original_teacher_id=slot.teacher_id,
                original_teacher_name=orig_name,
                suggested_substitute_id=chosen.id,
                suggested_substitute_name=chosen.name,
                substitute_department=dept_name,
                substitute_current_weekly_hours=chosen.current_load_hours,
                substitute_current_daily_hours=teacher_daily_load[chosen.id],
                reason=f"DepEd DO 005 underloaded match ({chosen.current_load_hours} hrs/wk; <= 6 hrs daily)",
            )
        )

    session.commit()

    return BiometricProcessResponse(
        success=True,
        message=f"Biometric DTR scanned: {len(rows)} entries, {absent_count} absent faculty, {len(affected_slots)} uncovered classes.",
        date=today_str,
        total_scanned=len(rows),
        present_count=present_count,
        late_count=late_count,
        absent_count=absent_count,
        uncovered_slots_count=len(affected_slots),
        absent_teachers=absent_teachers_list,
        recommendations=recommendations,
        attendance_records=[BiometricLogRead.model_validate(a) for a in attendance_records[:50]],
    )


def apply_biometric_substitutions(
    session: Session,
    recommendations: List[SubstituteRecommendation],
) -> Dict[str, Any]:
    """
    Apply automated substitute assignments to database and notify connected clients.
    """
    applied_count = 0
    all_teachers = session.exec(select(Teacher)).all()
    teacher_map = {t.id: t for t in all_teachers}

    absent_teacher_ids = set()

    for rec in recommendations:
        slot = session.get(ScheduleSlot, rec.slot_id)
        if not slot:
            continue
        slot.original_teacher_id = slot.teacher_id
        slot.teacher_id = rec.suggested_substitute_id
        slot.is_substituted = True
        slot.substitution_reason = f"Biometric DTR absent replacement for {rec.original_teacher_name} (DO 005 s. 2024)"
        session.add(slot)

        absent_teacher_ids.add(rec.original_teacher_id)
        applied_count += 1

    # Mark absent teachers as ON_LEAVE
    for t_id in absent_teacher_ids:
        t = teacher_map.get(t_id)
        if t and t.status == TeacherStatus.ACTIVE:
            t.status = TeacherStatus.ON_LEAVE
            session.add(t)

    session.commit()

    broadcast_sync("BIOMETRIC_SUBSTITUTIONS_APPLIED")

    return {
        "success": True,
        "message": f"Successfully applied {applied_count} automated substitution duties.",
        "applied_count": applied_count,
    }
