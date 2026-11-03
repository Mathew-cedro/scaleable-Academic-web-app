"""
Excel & Spreadsheet Schedule Importer Service.
Parses master timetables and load allocations from Excel (.xlsx) and CSV files.
Enforces DepEd RA 4670 (daily limit <= 6 hrs) and collision verification.
"""

import io
import csv
from typing import Dict, List, Optional, Tuple, Any
from sqlmodel import Session, select
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from app.models import Department, Section, Subject, Teacher, ScheduleSlot, TeacherStatus
from app.schemas import (
    ExcelSchedulePreviewResponse,
    ExcelScheduleRowPreview,
    ExcelScheduleCommitResponse,
)
from app.websocket_manager import broadcast_sync


def generate_schedule_template_bytes() -> bytes:
    """Generate an official DepEd master schedule spreadsheet template (.xlsx)."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Master Schedule Upload"

    headers = [
        "Teacher Name",
        "Department Code",
        "Position",
        "Section Name",
        "Grade Level",
        "Program Type",
        "Room Number",
        "Subject Name",
        "Day of Week",
        "Period Index",
    ]

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="570A57", end_color="570A57", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="CCCCCC"),
        right=Side(style="thin", color="CCCCCC"),
        top=Side(style="thin", color="CCCCCC"),
        bottom=Side(style="thin", color="CCCCCC"),
    )

    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align

    # Sample rows for demonstration
    sample_data = [
        ["Dr. Aris Thorne", "SCI", "Master Teacher I", "Grade 8 - STE Darwin", 8, "STE", "Room 201", "Science", "Monday", 2],
        ["Dr. Aris Thorne", "SCI", "Master Teacher I", "Grade 8 - STE Darwin", 8, "STE", "Room 201", "Science", "Tuesday", 2],
        ["Dr. Aris Thorne", "SCI", "Master Teacher I", "Grade 8 - STE Darwin", 8, "STE", "Room 201", "Science", "Wednesday", 2],
        ["Dr. Aris Thorne", "SCI", "Master Teacher I", "Grade 8 - STE Darwin", 8, "STE", "Room 201", "Science", "Thursday", 2],
        ["Mrs. Elena Rostova", "MATH", "Master Teacher II", "Grade 8 - STE Darwin", 8, "STE", "Room 201", "Mathematics", "Monday", 3],
        ["Mrs. Elena Rostova", "MATH", "Master Teacher II", "Grade 8 - STE Darwin", 8, "STE", "Room 201", "Mathematics", "Tuesday", 3],
        ["Mr. Jonathan Hayes", "ENG", "Teacher III", "Grade 8 - BEC Rizal", 8, "BEC", "Room 101", "English", "Monday", 4],
        ["G. Danilo Ramos", "FIL", "Master Teacher I", "Grade 8 - BEC Rizal", 8, "BEC", "Room 101", "Filipino", "Monday", 5],
    ]

    for row in sample_data:
        ws.append(row)

    # Set column widths
    col_widths = [22, 16, 20, 24, 12, 14, 14, 18, 14, 12]
    for idx, width in enumerate(col_widths, start=1):
        col_letter = openpyxl.utils.get_column_letter(idx)
        ws.column_dimensions[col_letter].width = width

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


DAY_NAME_MAP = {
    "mon": 0, "monday": 0, "0": 0, 0: 0,
    "tue": 1, "tues": 1, "tuesday": 1, "1": 1, 1: 1,
    "wed": 2, "wednesday": 2, "2": 2, 2: 2,
    "thu": 3, "thur": 3, "thurs": 3, "thursday": 3, "3": 3, 3: 3,
    "fri": 4, "friday": 4, "4": 4, 4: 4,
}


def parse_schedule_rows(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """Extract rows from either Excel (.xlsx) or CSV format."""
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


def preview_schedule_import(session: Session, file_bytes: bytes, filename: str) -> ExcelSchedulePreviewResponse:
    """Analyze and validate spreadsheet before database commit."""
    raw_rows = parse_schedule_rows(file_bytes, filename)
    
    preview_items: List[ExcelScheduleRowPreview] = []
    errors: List[str] = []
    warnings: List[str] = []

    teacher_day_counts: Dict[Tuple[str, int], int] = {}
    teacher_time_slots: Dict[Tuple[str, int, int], int] = {}
    section_time_slots: Dict[Tuple[str, int, int], int] = {}

    unique_teachers = set()
    unique_sections = set()
    unique_depts = set()

    for row_num, r in raw_rows:
        t_name = r.get("teacher name") or r.get("teacher") or r.get("faculty") or ""
        dept_code = (r.get("department code") or r.get("department") or r.get("dept") or "").upper()
        position = r.get("position") or "Teacher I"
        sec_name = r.get("section name") or r.get("section") or ""
        grade_raw = r.get("grade level") or r.get("grade") or "8"
        prog_type = (r.get("program type") or r.get("program") or "BEC").upper()
        room_num = r.get("room number") or r.get("room") or "Room 101"
        sub_name = r.get("subject name") or r.get("subject") or ""
        day_raw = str(r.get("day of week") or r.get("day") or "0").strip().lower()
        period_raw = str(r.get("period index") or r.get("period") or "1").strip()

        row_errors = []
        if not t_name:
            row_errors.append("Teacher Name is required")
        if not sec_name:
            row_errors.append("Section Name is required")
        if not sub_name:
            row_errors.append("Subject Name is required")

        try:
            grade_level = int(float(grade_raw))
        except ValueError:
            grade_level = 8
            row_errors.append(f"Invalid grade level '{grade_raw}'")

        day_of_week = DAY_NAME_MAP.get(day_raw, None)
        if day_of_week is None:
            row_errors.append(f"Invalid day '{day_raw}' (use Mon-Fri or 0-4)")
            day_of_week = 0

        try:
            period_index = int(float(period_raw))
            if period_index < 1 or period_index > 7:
                row_errors.append(f"Period index {period_index} must be between 1 and 7")
        except ValueError:
            period_index = 1
            row_errors.append(f"Invalid period index '{period_raw}'")

        # Check collisions
        if t_name and day_of_week is not None:
            t_key = (t_name, day_of_week, period_index)
            if t_key in teacher_time_slots:
                row_errors.append(f"Teacher '{t_name}' double-booked on Day {day_of_week} Period {period_index} (row {teacher_time_slots[t_key]})")
            else:
                teacher_time_slots[t_key] = row_num

            # RA 4670 daily limit check
            td_key = (t_name, day_of_week)
            teacher_day_counts[td_key] = teacher_day_counts.get(td_key, 0) + 1
            if teacher_day_counts[td_key] > 6:
                row_errors.append(f"RA 4670 Violation: Teacher '{t_name}' exceeds 6 hours on Day {day_of_week} (load={teacher_day_counts[td_key]})")

        if sec_name and day_of_week is not None:
            s_key = (sec_name, day_of_week, period_index)
            if s_key in section_time_slots:
                row_errors.append(f"Section '{sec_name}' already has a class on Day {day_of_week} Period {period_index} (row {section_time_slots[s_key]})")
            else:
                section_time_slots[s_key] = row_num

        if t_name:
            unique_teachers.add(t_name)
        if sec_name:
            unique_sections.add(sec_name)
        if dept_code:
            unique_depts.add(dept_code)

        is_valid = len(row_errors) == 0
        if not is_valid:
            errors.extend([f"Row {row_num}: {err}" for err in row_errors])

        preview_items.append(
            ExcelScheduleRowPreview(
                row_num=row_num,
                teacher_name=t_name,
                department_code=dept_code,
                position=position,
                section_name=sec_name,
                grade_level=grade_level,
                program_type=prog_type,
                room_number=room_num,
                subject_name=sub_name,
                day_of_week=day_of_week,
                period_index=period_index,
                is_valid=is_valid,
                errors=row_errors,
            )
        )

    valid_count = sum(1 for p in preview_items if p.is_valid)
    error_count = len(preview_items) - valid_count

    return ExcelSchedulePreviewResponse(
        filename=filename,
        total_rows=len(preview_items),
        valid_rows_count=valid_count,
        error_rows_count=error_count,
        unique_teachers_count=len(unique_teachers),
        unique_sections_count=len(unique_sections),
        unique_departments_count=len(unique_depts),
        preview_items=preview_items[:100],  # Return first 100 for fast UI rendering
        errors=errors[:50],
        warnings=warnings,
    )


def commit_schedule_import(session: Session, file_bytes: bytes, filename: str) -> ExcelScheduleCommitResponse:
    """Commit validated schedule rows into the database."""
    preview = preview_schedule_import(session, file_bytes, filename)
    if preview.error_rows_count > 0:
        raise ValueError(f"Cannot commit schedule with {preview.error_rows_count} errors. Please fix validation errors first.")

    raw_rows = parse_schedule_rows(file_bytes, filename)

    # Cache existing departments
    departments = session.exec(select(Department)).all()
    dept_by_code = {d.code.upper(): d for d in departments}

    # Fallback department if code not found
    fallback_dept = departments[0] if departments else Department(name="General Academics", code="GEN")
    if not departments:
        session.add(fallback_dept)
        session.flush()
        dept_by_code["GEN"] = fallback_dept

    # Cache existing teachers, sections, subjects
    teachers_by_name = {t.name.lower(): t for t in session.exec(select(Teacher)).all()}
    sections_by_name = {s.name.lower(): s for s in session.exec(select(Section)).all()}
    subjects_by_key = {(s.name.lower(), s.grade_level): s for s in session.exec(select(Subject)).all()}

    # Wipe existing schedule slots to replace with imported master schedule
    existing_slots = session.exec(select(ScheduleSlot)).all()
    for s in existing_slots:
        session.delete(s)
    session.flush()

    teacher_load_counts: Dict[int, int] = {}
    created_slots_count = 0

    for row_num, r in raw_rows:
        t_name = (r.get("teacher name") or r.get("teacher") or "").strip()
        dept_code = (r.get("department code") or r.get("department") or "").strip().upper()
        position = (r.get("position") or "Teacher I").strip()
        sec_name = (r.get("section name") or r.get("section") or "").strip()
        grade_raw = r.get("grade level") or r.get("grade") or "8"
        prog_type = (r.get("program type") or r.get("program") or "BEC").strip().upper()
        room_num = (r.get("room number") or r.get("room") or "Room 101").strip()
        sub_name = (r.get("subject name") or r.get("subject") or "").strip()
        day_raw = str(r.get("day of week") or r.get("day") or "0").strip().lower()
        period_raw = str(r.get("period index") or r.get("period") or "1").strip()

        grade_level = int(float(grade_raw))
        day_of_week = DAY_NAME_MAP.get(day_raw, 0)
        period_index = int(float(period_raw))

        # Ensure Department
        dept = dept_by_code.get(dept_code) or fallback_dept

        # Ensure Teacher
        t_key = t_name.lower()
        if t_key not in teachers_by_name:
            teacher = Teacher(
                name=t_name,
                department_id=dept.id,
                position=position,
                max_daily_hours=6,
                max_weekly_hours=30,
                current_load_hours=0,
                status=TeacherStatus.ACTIVE,
            )
            session.add(teacher)
            session.flush()
            teachers_by_name[t_key] = teacher
        else:
            teacher = teachers_by_name[t_key]

        # Ensure Section
        sec_key = sec_name.lower()
        if sec_key not in sections_by_name:
            sec = Section(
                name=sec_name,
                grade_level=grade_level,
                program_type=prog_type,
                room_number=room_num,
            )
            session.add(sec)
            session.flush()
            sections_by_name[sec_key] = sec
        else:
            sec = sections_by_name[sec_key]

        # Ensure Subject
        sub_key = (sub_name.lower(), grade_level)
        if sub_key not in subjects_by_key:
            subj = Subject(
                name=sub_name,
                department_id=dept.id,
                grade_level=grade_level,
                required_weekly_loads=4,
                duration_minutes=60,
            )
            session.add(subj)
            session.flush()
            subjects_by_key[sub_key] = subj
        else:
            subj = subjects_by_key[sub_key]

        # Create Slot
        is_p1_lock = (day_of_week == 0 and period_index == 1)
        slot = ScheduleSlot(
            section_id=sec.id,
            subject_id=subj.id,
            teacher_id=teacher.id,
            day_of_week=day_of_week,
            period_index=period_index,
            is_locked=is_p1_lock,
            is_substituted=False,
        )
        session.add(slot)
        created_slots_count += 1
        teacher_load_counts[teacher.id] = teacher_load_counts.get(teacher.id, 0) + 1

    # Update teacher current weekly load hours
    for t in teachers_by_name.values():
        t.current_load_hours = teacher_load_counts.get(t.id, 0)
        session.add(t)

    session.commit()

    broadcast_sync("SCHEDULE_IMPORTED")

    return ExcelScheduleCommitResponse(
        success=True,
        message=f"Successfully imported {created_slots_count} schedule slots from '{filename}'.",
        slots_imported=created_slots_count,
        teachers_count=len(teachers_by_name),
        sections_count=len(sections_by_name),
        subjects_count=len(subjects_by_key),
    )
