"""
Excel / Spreadsheet Import & Template Generation Service for Sections.
Supports .xlsx, .xls, and .csv files with DepEd Key Stage 3 (Grades 7 to 10) validation,
smart column auto-detection, and fuzzy faculty adviser matching.
"""

import io
import re
from typing import Any, Dict, List, Optional, Tuple
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
import pandas as pd
from sqlmodel import Session, select

from app.models import ScheduleSlot, Section, Subject, Teacher, TeacherStatus

HONORIFICS = {
    "mr", "mrs", "ms", "miss", "dr", "coach", "bro", "brother",
    "mme", "madame", "g", "gng", "bb", "teacher", "prof", "master"
}

def normalize_person_name(name: str) -> str:
    """Strip honorifics, punctuation, and normalize whitespace for name comparison."""
    if not name:
        return ""
    # Remove dots and commas
    cleaned = re.sub(r"[.,\-_\(\)]", " ", name.lower()).strip()
    tokens = [t for t in cleaned.split() if t not in HONORIFICS]
    return " ".join(tokens)

def match_adviser_name(adviser_str: str, teachers: List[Teacher]) -> Optional[Teacher]:
    """
    Fuzzy / token-based matching of an adviser string to an existing Teacher record.
    Handles 'First Last', 'Last, First', and titles like 'Mrs. Janet Mendoza'.
    """
    if not adviser_str or not adviser_str.strip():
        return None
    raw_norm = normalize_person_name(adviser_str)
    if not raw_norm:
        return None

    raw_tokens = set(raw_norm.split())

    # 1. Exact normalized match
    for t in teachers:
        t_norm = normalize_person_name(t.name)
        if raw_norm == t_norm:
            return t

    # 2. Token subset match (e.g. 'janet mendoza' matches 'mrs janet mendoza')
    best_match = None
    best_overlap = 0
    for t in teachers:
        t_tokens = set(normalize_person_name(t.name).split())
        overlap = len(raw_tokens.intersection(t_tokens))
        if overlap >= 2 and overlap > best_overlap:
            best_overlap = overlap
            best_match = t
        elif overlap == 1 and len(raw_tokens) == 1 and len(t_tokens) >= 1:
            # Single word match only if unique across all teachers
            pass

    if best_match:
        return best_match

    # 3. Substring match
    for t in teachers:
        t_norm = normalize_person_name(t.name)
        if raw_norm in t_norm or t_norm in raw_norm:
            return t

    return None

def extract_grade_level(name: str, grade_val: Any = None) -> int:
    """Extract or parse grade level (7, 8, 9, 10). Fallbacks to 7 if unresolvable."""
    if grade_val is not None and str(grade_val).strip():
        s = str(grade_val).strip().lower()
        m = re.search(r"\b(7|8|9|10)\b", s)
        if m:
            return int(m.group(1))

    # Try extracting from section name
    if name:
        m = re.search(r"(?:grade|gr|g)\s*[-_]?\s*(7|8|9|10)\b", name.lower())
        if m:
            return int(m.group(1))
        m2 = re.search(r"\b(7|8|9|10)\s*[-_]", name.lower())
        if m2:
            return int(m2.group(1))

    return 7

def normalize_program_track(track_val: Any, name: str) -> str:
    """Normalize program track (BEC, STE, SPS, SPA, SPJ). Default to BEC."""
    text = (str(track_val or "") + " " + str(name or "")).upper()
    if "STE" in text or "SCIENCE" in text or "STEM" in text or "RESEARCH" in text:
        return "STE"
    if "SPS" in text or "SPORT" in text or "ATHLET" in text:
        return "SPS"
    if "SPA" in text or "ARTS" in text or "THEATER" in text or "DANCE" in text:
        return "SPA"
    if "SPJ" in text or "JOURNAL" in text or "PRESS" in text:
        return "SPJ"
    return "BEC"

def generate_sections_excel_template() -> io.BytesIO:
    """
    Generates a beautifully styled official DepEd Section Roster Excel (.xlsx) template
    with sample rows, data validation hints, and field guidelines.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Section Roster"

    # Styling Palettes (DepEd Classic Plum & Violet theme)
    header_fill = PatternFill(start_color="2E0249", end_color="2E0249", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    instruct_fill = PatternFill(start_color="F9E2F4", end_color="F9E2F4", fill_type="solid")
    instruct_font = Font(name="Calibri", size=9, italic=True, color="703372")
    data_font = Font(name="Calibri", size=10, color="1E293B")
    data_alt_fill = PatternFill(start_color="FAF5FA", end_color="FAF5FA", fill_type="solid")

    thin_border_side = Side(border_style="thin", color="CBD5E1")
    grid_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

    # Title Banner (Rows 1-2)
    ws.merge_cells("A1:E1")
    ws["A1"] = "DEPARTMENT OF EDUCATION - JUNIOR HIGH SCHOOL (KEY STAGE 3)"
    ws["A1"].font = Font(name="Calibri", size=12, bold=True, color="2E0249")
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:E2")
    ws["A2"] = "OFFICIAL SECTION ROSTER & TIMETABLE IMPORT TEMPLATE"
    ws["A2"].font = Font(name="Calibri", size=10, bold=True, color="A91079")
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    # Column Headers (Row 4)
    headers = [
        ("Section Name", 30),
        ("Grade Level", 14),
        ("Program Track", 18),
        ("Room Number", 18),
        ("Class Adviser (Optional)", 30),
    ]

    for col_idx, (hdr_text, col_width) in enumerate(headers, start=1):
        cell = ws.cell(row=4, column=col_idx, value=hdr_text)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = grid_border
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = col_width

    ws.row_dimensions[4].height = 28

    # Sample Data (Rows 5-14)
    sample_rows = [
        ("Grade 7 - Diamond", 7, "BEC", "Room 701", "Mrs. Janet Mendoza"),
        ("Grade 7 - STE Newton", 7, "STE", "Room 702", "Dr. Aris Thorne"),
        ("Grade 7 - SPS Agila", 7, "SPS", "Room 703", "Coach Marcus Vance"),
        ("Grade 8 - Ruby", 8, "BEC", "Room 801", "Mr. David Chen"),
        ("Grade 8 - STE Darwin", 8, "STE", "Room 802", "Ms. Camille Santos"),
        ("Grade 8 - SPA Luna", 8, "SPA", "Room 803", "Bb. Katrina Mercado"),
        ("Grade 9 - Sapphire", 9, "BEC", "Room 901", "Mr. Arthur Panganiban"),
        ("Grade 9 - SPJ Herald", 9, "SPJ", "Room 902", "Ms. Bianca Reyes"),
        ("Grade 10 - Emerald", 10, "BEC", "Room 1001", "Dr. Victorio Ramos"),
        ("Grade 10 - STE Einstein", 10, "STE", "Room 1002", "Mrs. Liza De Jesus"),
    ]

    for r_idx, row_data in enumerate(sample_rows, start=5):
        ws.row_dimensions[r_idx].height = 20
        fill_to_use = data_alt_fill if r_idx % 2 == 0 else PatternFill(fill_type=None)
        for c_idx, val in enumerate(row_data, start=1):
            c = ws.cell(row=r_idx, column=c_idx, value=val)
            c.font = data_font
            c.border = grid_border
            if fill_to_use.fill_type:
                c.fill = fill_to_use
            # Alignments
            if c_idx in (2, 3):
                c.alignment = Alignment(horizontal="center", vertical="center")
            elif c_idx == 4:
                c.alignment = Alignment(horizontal="center", vertical="center")
            else:
                c.alignment = Alignment(horizontal="left", vertical="center")

    # Guidelines at bottom
    start_info_row = 16
    ws.merge_cells(f"A{start_info_row}:E{start_info_row}")
    info_title = ws.cell(row=start_info_row, column=1, value="IMPORT GUIDELINES & ACCEPTED FORMATS")
    info_title.font = Font(name="Calibri", size=10, bold=True, color="2E0249")

    guidelines = [
        "1. Section Name: Required. Unique name for each section (e.g. 'Grade 7 - Diamond').",
        "2. Grade Level: Numeric 7, 8, 9, or 10. If blank, will be extracted automatically from Section Name.",
        "3. Program Track: BEC (Regular), STE (Science), SPS (Sports), SPA (Arts), or SPJ (Journalism). Defaults to BEC.",
        "4. Room Number: The designated classroom (e.g., 'Room 701'). If left blank, will be auto-generated.",
        "5. Class Adviser: Optional faculty member name. Automatically matches active teachers and locks Monday P1 Homeroom.",
    ]

    for idx, text in enumerate(guidelines, start=start_info_row + 1):
        ws.merge_cells(f"A{idx}:E{idx}")
        cell = ws.cell(row=idx, column=1, value=text)
        cell.font = instruct_font
        cell.fill = instruct_fill

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer

def detect_header_row_index(file_bytes: bytes, filename: str) -> int:
    """Detect 0-based header row index by scanning first 10 rows for known keywords."""
    header_keywords = {"section", "grade", "track", "program", "room", "adviser", "teacher", "name", "level", "class"}
    fn_lower = filename.lower()
    best_row_idx = 0
    max_score = 0

    try:
        if fn_lower.endswith(".csv"):
            import csv
            stream = io.StringIO(file_bytes.decode("utf-8-sig", errors="ignore"))
            reader = csv.reader(stream)
            for r_idx, row in enumerate(reader):
                if r_idx > 10:
                    break
                score = sum(1 for val in row if val and any(k in str(val).lower() for k in header_keywords))
                if score > max_score:
                    max_score = score
                    best_row_idx = r_idx
        else:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            ws = wb.active
            for r_idx, row in enumerate(ws.iter_rows(values_only=True)):
                if r_idx > 10:
                    break
                score = sum(1 for val in row if val and any(k in str(val).lower() for k in header_keywords))
                if score > max_score:
                    max_score = score
                    best_row_idx = r_idx
    except Exception:
        best_row_idx = 0

    return best_row_idx if max_score >= 1 else 0

def parse_and_preview_spreadsheet(
    file_bytes: bytes,
    filename: str,
    session: Session,
) -> Dict[str, Any]:
    """
    Parses an uploaded .xlsx, .xls, or .csv file and returns structured preview items
    with column detection, validation badges, existing section matching, and adviser resolution.
    """
    fn_lower = filename.lower()
    header_idx = detect_header_row_index(file_bytes, filename)

    try:
        if fn_lower.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes), header=header_idx, dtype=str)
        else:
            df = pd.read_excel(io.BytesIO(file_bytes), header=header_idx, dtype=str)
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to parse spreadsheet file: {str(e)}. Please check file format.",
            "rows": [],
            "stats": {"total": 0, "valid": 0, "new": 0, "updating": 0, "advisers_matched": 0},
        }

    # Clean DataFrame column names
    df = df.dropna(how="all")
    raw_columns = [str(c).strip() for c in df.columns if not str(c).startswith("Unnamed")]

    # Auto-detect column mappings
    col_map = {
        "name": None,
        "grade_level": None,
        "program_type": None,
        "room_number": None,
        "adviser": None,
    }

    for c in df.columns:
        cl = str(c).lower().strip()
        if not col_map["name"] and any(k in cl for k in ["section name", "section", "class name", "class", "name"]):
            col_map["name"] = c
        elif not col_map["grade_level"] and any(k in cl for k in ["grade level", "grade", "year level", "level", "gr"]):
            col_map["grade_level"] = c
        elif not col_map["program_type"] and any(k in cl for k in ["program type", "track", "program", "curriculum", "strand"]):
            col_map["program_type"] = c
        elif not col_map["room_number"] and any(k in cl for k in ["room number", "room", "classroom", "bldg"]):
            col_map["room_number"] = c
        elif not col_map["adviser"] and any(k in cl for k in ["adviser", "teacher", "homeroom"]):
            col_map["adviser"] = c

    # Fallback if first column wasn't picked as name
    if not col_map["name"] and len(raw_columns) > 0:
        col_map["name"] = raw_columns[0]
        cl = c.lower()
        if not col_map["name"] and any(k in cl for k in ["section name", "section", "class", "name"]):
            col_map["name"] = c
        elif not col_map["grade_level"] and any(k in cl for k in ["grade level", "grade", "year level", "level", "gr"]):
            col_map["grade_level"] = c
        elif not col_map["program_type"] and any(k in cl for k in ["program type", "track", "program", "curriculum", "strand"]):
            col_map["program_type"] = c
        elif not col_map["room_number"] and any(k in cl for k in ["room number", "room", "classroom", "bldg"]):
            col_map["room_number"] = c
        elif not col_map["adviser"] and any(k in cl for k in ["adviser", "teacher", "homeroom"]):
            col_map["adviser"] = c

    # Fallback if first column wasn't picked as name
    if not col_map["name"] and len(raw_columns) > 0:
        col_map["name"] = raw_columns[0]

    # Fetch DB lookups
    all_sections = session.exec(select(Section)).all()
    existing_sec_by_name = {s.name.lower().strip(): s for s in all_sections}
    existing_sec_by_id = {s.id: s for s in all_sections}

    all_teachers = session.exec(select(Teacher)).all()
    active_teachers = [t for t in all_teachers if t.status == TeacherStatus.ACTIVE]

    preview_rows = []
    stats = {
        "total": 0,
        "valid": 0,
        "new": 0,
        "updating": 0,
        "advisers_matched": 0,
    }

    seen_in_batch = set()

    for idx, row in df.iterrows():
        raw_name = str(row.get(col_map["name"], "") or "").strip()
        # Skip completely empty rows
        if not raw_name or raw_name.lower() in ("nan", "none", "null"):
            continue

        # Skip footer instructions or guidelines if present in sheet
        name_lower = raw_name.lower()
        if any(name_lower.startswith(prefix) for prefix in ("import guideline", "guideline", "instruction", "note:", "tip:", "reminder:")):
            continue
        if re.match(r"^\d+\.\s+", raw_name):
            continue

        raw_grade = row.get(col_map["grade_level"]) if col_map["grade_level"] else None
        raw_track = row.get(col_map["program_type"]) if col_map["program_type"] else None
        raw_room = str(row.get(col_map["room_number"], "") or "").strip()
        raw_adviser = str(row.get(col_map["adviser"], "") or "").strip()

        # Grade level extraction
        grade_level = extract_grade_level(raw_name, raw_grade)
        # Program track
        program_type = normalize_program_track(raw_track, raw_name)
        # Room
        if not raw_room or raw_room.lower() in ("nan", "none", ""):
            room_number = f"Room {grade_level}0{len(preview_rows) + 1}"
        else:
            room_number = raw_room

        # Adviser Matching
        matched_teacher = match_adviser_name(raw_adviser, active_teachers)
        adviser_id = matched_teacher.id if matched_teacher else None
        adviser_name = matched_teacher.name if matched_teacher else (raw_adviser if raw_adviser and raw_adviser.lower() != "nan" else None)
        adviser_matched = matched_teacher is not None

        # Check existing section by name
        norm_key = raw_name.lower().strip()
        existing_sec = existing_sec_by_name.get(norm_key)

        is_duplicate_in_file = norm_key in seen_in_batch
        seen_in_batch.add(norm_key)

        status_flag = "NEW"
        status_message = "Ready to create"
        if existing_sec:
            status_flag = "UPDATING"
            status_message = f"Will update existing section (ID: {existing_sec.id})"
        elif is_duplicate_in_file:
            status_flag = "DUPLICATE_IN_FILE"
            status_message = "Duplicate section name found in spreadsheet"

        stats["total"] += 1
        if status_flag in ("NEW", "UPDATING"):
            stats["valid"] += 1
        if status_flag == "NEW":
            stats["new"] += 1
        elif status_flag == "UPDATING":
            stats["updating"] += 1
        if adviser_matched:
            stats["advisers_matched"] += 1

        preview_rows.append({
            "row_index": idx + 1,
            "section_id": existing_sec.id if existing_sec else None,
            "name": raw_name,
            "grade_level": grade_level,
            "program_type": program_type,
            "room_number": room_number,
            "raw_adviser": raw_adviser if raw_adviser and raw_adviser.lower() != "nan" else None,
            "adviser_id": adviser_id,
            "adviser_name": adviser_name,
            "adviser_matched": adviser_matched,
            "status": status_flag,
            "status_message": status_message,
        })

    return {
        "success": True,
        "filename": filename,
        "detected_columns": col_map,
        "rows": preview_rows,
        "stats": stats,
    }


def import_sections_from_items(
    items: List[Dict[str, Any]],
    update_existing: bool,
    session: Session,
) -> Dict[str, Any]:
    """
    Persists validated section items to the database.
    Handles creation, updating existing sections, adviser linkage,
    and automatic synchronization of Monday Period 1 Homeroom Guidance locks.
    """
    created_sections = []
    updated_sections = []
    skipped_count = 0

    all_sections = session.exec(select(Section)).all()
    existing_by_name = {s.name.lower().strip(): s for s in all_sections}

    homeroom_subject = session.exec(
        select(Subject).where(Subject.id == 9)
    ).first()
    if not homeroom_subject:
        homeroom_subject = session.exec(
            select(Subject).where(Subject.name.contains("Homeroom"))
        ).first()

    for item in items:
        name = str(item.get("name", "")).strip()
        if not name:
            skipped_count += 1
            continue

        grade_level = int(item.get("grade_level", 7) or 7)
        program_type = str(item.get("program_type", "BEC") or "BEC").strip()
        room_number = str(item.get("room_number", f"Room {grade_level}01") or f"Room {grade_level}01").strip()
        adviser_id = item.get("adviser_id")
        if adviser_id is not None:
            try:
                adviser_id = int(adviser_id)
            except (ValueError, TypeError):
                adviser_id = None

        norm_key = name.lower()
        existing = existing_by_name.get(norm_key)

        if existing:
            if not update_existing:
                skipped_count += 1
                continue

            # Update existing section
            existing.grade_level = grade_level
            existing.program_type = program_type
            existing.room_number = room_number
            session.add(existing)
            target_sec = existing
            updated_sections.append(existing)
        else:
            # Create new section
            new_sec = Section(
                name=name,
                grade_level=grade_level,
                program_type=program_type,
                room_number=room_number,
            )
            session.add(new_sec)
            session.flush()
            session.refresh(new_sec)
            existing_by_name[norm_key] = new_sec
            target_sec = new_sec
            created_sections.append(new_sec)

        # Handle Adviser Linkage & Homeroom Synchronization
        if adviser_id and adviser_id > 0:
            adviser = session.get(Teacher, adviser_id)
            if adviser:
                # 1. If adviser was already advising a DIFFERENT section, reassign old section's Homeroom slot
                old_sec_id = adviser.advisory_section_id
                if old_sec_id and old_sec_id != target_sec.id:
                    old_hr_slot = session.exec(
                        select(ScheduleSlot).where(
                            ScheduleSlot.section_id == old_sec_id,
                            ScheduleSlot.day_of_week == 0,
                            ScheduleSlot.period_index == 1,
                            ScheduleSlot.teacher_id == adviser.id,
                        )
                    ).first()
                    if old_hr_slot:
                        sub_t = session.exec(
                            select(Teacher).where(
                                Teacher.status == TeacherStatus.ACTIVE,
                                Teacher.advisory_section_id == None,
                                Teacher.id != adviser.id,
                            )
                        ).first()
                        if sub_t:
                            old_hr_slot.teacher_id = sub_t.id
                            session.add(old_hr_slot)

                # 2. Remove previous adviser of this section if different
                prev_advisers = session.exec(
                    select(Teacher).where(Teacher.advisory_section_id == target_sec.id, Teacher.id != adviser.id)
                ).all()
                for prev in prev_advisers:
                    prev.advisory_section_id = None
                    session.add(prev)

                adviser.is_adviser = True
                adviser.advisory_section_id = target_sec.id
                session.add(adviser)

                # Synchronize Monday Period 1 Homeroom Guidance slot
                hr_slot = session.exec(
                    select(ScheduleSlot).where(
                        ScheduleSlot.section_id == target_sec.id,
                        ScheduleSlot.day_of_week == 0,
                        ScheduleSlot.period_index == 1,
                    )
                ).first()

                if hr_slot:
                    if hr_slot.teacher_id != adviser.id:
                        hr_slot.teacher_id = adviser.id
                        session.add(hr_slot)
                elif homeroom_subject:
                    created_slot = ScheduleSlot(
                        section_id=target_sec.id,
                        subject_id=homeroom_subject.id,
                        teacher_id=adviser.id,
                        day_of_week=0,
                        period_index=1,
                        is_locked=True,
                    )
                    session.add(created_slot)

    session.commit()

    return {
        "success": True,
        "created_count": len(created_sections),
        "updated_count": len(updated_sections),
        "skipped_count": skipped_count,
        "total_processed": len(items),
    }

