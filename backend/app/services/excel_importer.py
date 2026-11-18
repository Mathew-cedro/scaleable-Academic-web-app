"""
Excel / Spreadsheet Import & Template Generation Service.
Supports:
1. Section Schedule (Weekly Timetable) Import & Template Generation (DepEd Key Stage 3).
   Supports both Timetable Grid Matrix and Tabular Slot List formats, fuzzy faculty/subject
   matching, statutory clash detection (RA 4670 & DO 009, s. 2026), and live DB persistence.
2. Section Roster Bulk Import & Template Generation (Legacy / Batch Section Setup).
"""

import io
import re
from typing import Any, Dict, List, Optional, Tuple
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
import pandas as pd
from sqlmodel import Session, select

from app.models import Department, ScheduleSlot, Section, Subject, Teacher, TeacherStatus

HONORIFICS = {
    "mr", "mrs", "ms", "miss", "dr", "coach", "bro", "brother",
    "mme", "madame", "g", "gng", "bb", "teacher", "prof", "master"
}

DAYS_MAP = {
    "monday": 0, "mon": 0, "lunes": 0, "m": 0,
    "tuesday": 1, "tue": 1, "tues": 1, "martes": 1, "t": 1,
    "wednesday": 2, "wed": 2, "miyerkules": 2, "w": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3, "huwebes": 3, "th": 3,
    "friday": 4, "fri": 4, "biyernes": 4, "f": 4,
}

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

DEFAULT_PERIOD_TIMES = {
    1: "7:00 AM – 8:00 AM",
    2: "8:00 AM – 9:00 AM",
    3: "9:20 AM – 10:20 AM",
    4: "10:20 AM – 11:20 AM",
    5: "12:00 PM – 1:00 PM",
    6: "1:00 PM – 2:00 PM",
    7: "2:00 PM – 3:00 PM",
    8: "3:00 PM – 4:00 PM",
    9: "4:00 PM – 5:00 PM",
}


def normalize_person_name(name: str) -> str:
    """Strip honorifics, punctuation, and normalize whitespace for name comparison."""
    if not name:
        return ""
    cleaned = re.sub(r"[.,\-_\(\)]", " ", name.lower()).strip()
    tokens = [t for t in cleaned.split() if t not in HONORIFICS]
    return " ".join(tokens)


def match_adviser_name(adviser_str: str, teachers: List[Teacher]) -> Optional[Teacher]:
    """
    Fuzzy / token-based matching of a teacher string to an existing Teacher record.
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

    if best_match:
        return best_match

    # 3. Substring match
    for t in teachers:
        t_norm = normalize_person_name(t.name)
        if raw_norm in t_norm or t_norm in raw_norm:
            return t

    return None


def match_subject_name(subject_str: str, subjects: List[Subject]) -> Optional[Subject]:
    """
    Fuzzy and alias matching of subject name string to canonical DepEd Subject.
    Handles abbreviations (Math, Sci, AP, TLE, MAPEH, EsP, Homeroom Guidance).
    """
    if not subject_str or not subject_str.strip():
        return None
    s_raw = subject_str.lower().strip()

    # 1. Exact name match
    for sub in subjects:
        if s_raw == sub.name.lower().strip():
            return sub

    # 2. Canonical aliases dictionary
    alias_map = {
        "math": "Mathematics",
        "mathematics": "Mathematics",
        "sci": "Science",
        "science": "Science",
        "eng": "English",
        "english": "English",
        "fil": "Filipino",
        "filipino": "Filipino",
        "ap": "Araling Panlipunan (AP)",
        "araling panlipunan": "Araling Panlipunan (AP)",
        "aral pan": "Araling Panlipunan (AP)",
        "social studies": "Araling Panlipunan (AP)",
        "tle": "Technology & Livelihood Education (TLE)",
        "epp": "Technology & Livelihood Education (TLE)",
        "technology": "Technology & Livelihood Education (TLE)",
        "livelihood": "Technology & Livelihood Education (TLE)",
        "mapeh": "Music, Arts, PE, Health (MAPEH)",
        "music": "Music, Arts, PE, Health (MAPEH)",
        "pe": "Music, Arts, PE, Health (MAPEH)",
        "arts": "Music, Arts, PE, Health (MAPEH)",
        "health": "Music, Arts, PE, Health (MAPEH)",
        "esp": "Values Education (EsP)",
        "values": "Values Education (EsP)",
        "values ed": "Values Education (EsP)",
        "values education": "Values Education (EsP)",
        "edukasyon sa pagpapakatao": "Values Education (EsP)",
        "homeroom": "Homeroom Guidance Program",
        "guidance": "Homeroom Guidance Program",
        "homeroom guidance": "Homeroom Guidance Program",
        "hrg": "Homeroom Guidance Program",
        "hrgp": "Homeroom Guidance Program",
        "hgp": "Homeroom Guidance Program",
        "research": "Research 1",
        "research 1": "Research 1",
        "journalism": "Journalism Basics",
        "sports": "Sports and Education",
    }

    for alias, canonical in alias_map.items():
        if alias == s_raw or (len(alias) >= 3 and alias in s_raw):
            matched = next((sub for sub in subjects if sub.name.lower() == canonical.lower()), None)
            if matched:
                return matched

    # 3. Substring containment
    for sub in subjects:
        sub_name_low = sub.name.lower()
        if s_raw in sub_name_low or sub_name_low in s_raw:
            return sub

    return None


def parse_schedule_cell(cell_val: Any) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts (subject_raw, teacher_raw) from a single grid matrix cell.
    Supports:
      - Multi-line: 'Mathematics\nMr. David Chen'
      - Hyphen/slash/bar: 'Science - Dr. Aris Thorne', 'MAPEH / Dr. Ramos'
      - Parentheses: 'English (Ms. Camille Santos)'
      - Parentheses room/grade stripping: 'Math (Room 101)' -> ('Math', None)
      - Single subject: 'Filipino'
    """
    text = str(cell_val or "").strip()
    if not text or text.lower() in ("nan", "none", "null", "recess", "lunch", "break", "vacant", "-"):
        return None, None

    # Check for break keywords
    t_lower = text.lower()
    if any(k in t_lower for k in ("health break", "recess", "noon break", "lunch break")):
        return None, None

    # Helper to clean room/building annotations from teacher names
    def clean_teacher(t_str: Optional[str]) -> Optional[str]:
        if not t_str:
            return None
        t_cleaned = re.sub(r"\s*\((?:room|rm\.?|bldg|building|grade|gr\.?|sec|section)[^\)]*\)", "", t_str, flags=re.IGNORECASE).strip()
        t_cleaned = re.sub(r"^(?:room|rm\.?|bldg|building|grade|gr\.?|sec|section)\b[^\n,]*", "", t_cleaned, flags=re.IGNORECASE).strip()
        return t_cleaned if t_cleaned else None

    # 1. Multi-line
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if len(lines) >= 2:
        return lines[0], clean_teacher(lines[1])

    # 2. Delimiter separated
    for sep in [" - ", " -- ", " / ", " | "]:
        if sep in text:
            parts = text.split(sep, 1)
            return parts[0].strip(), clean_teacher(parts[1].strip())

    # 3. Parentheses
    m = re.match(r"^(.*?)\s*\((.*?)\)$", text)
    if m:
        sub_part = m.group(1).strip()
        inside = m.group(2).strip()
        if re.match(r"^(?:room|rm\.?|grade|gr\.?|bldg|building|sec|section)\b", inside, re.IGNORECASE):
            return sub_part, None
        return sub_part, clean_teacher(inside)

    return text, None


# =============================================================================
# SECTION SCHEDULE: EXCEL TEMPLATE GENERATOR
# =============================================================================
def generate_section_schedule_template(section: Section, session: Session, max_periods: int = 9) -> io.BytesIO:
    """
    Generates a high-quality, pre-styled official DepEd Class Program / Section Schedule (.xlsx)
    template tailored to the specific section's grade level and program track, extended to 9 periods.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Sched - {section.name}"[:31]

    # Color Palette: Velvet Plum & Professional Slate
    title_font = Font(name="Calibri", size=11, bold=True, color="2E0249")
    sub_title_font = Font(name="Calibri", size=10, bold=True, color="A91079")
    meta_font = Font(name="Calibri", size=9, italic=True, color="475569")

    header_fill = PatternFill(start_color="2E0249", end_color="2E0249", fill_type="solid")
    header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")

    break_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    break_font = Font(name="Calibri", size=9, bold=True, italic=True, color="64748B")

    data_font = Font(name="Calibri", size=9, color="0F172A")
    locked_fill = PatternFill(start_color="FAF5FA", end_color="FAF5FA", fill_type="solid")
    alt_fill = PatternFill(start_color="FDFDFD", end_color="FDFDFD", fill_type="solid")

    thin_border_side = Side(border_style="thin", color="CBD5E1")
    grid_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

    # 1. School & Section Header Banners (Rows 1-3)
    ws.merge_cells("A1:G1")
    ws["A1"] = "DEPARTMENT OF EDUCATION • REGION V (BICOL) • DIVISION OF ALBAY"
    ws["A1"].font = title_font
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:G2")
    ws["A2"] = f"SECTION CLASS PROGRAM & WEEKLY TIMETABLE: {section.name.upper()}"
    ws["A2"].font = sub_title_font
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    # Find Adviser
    adviser = session.exec(select(Teacher).where(Teacher.advisory_section_id == section.id)).first()
    adv_name = adviser.name if adviser else "Unassigned"

    ws.merge_cells("A3:G3")
    ws["A3"] = f"Grade Level: {section.grade_level}  |  Program Track: {section.program_type}  |  Classroom: {section.room_number}  |  Class Adviser: {adv_name}"
    ws["A3"].font = meta_font
    ws["A3"].alignment = Alignment(horizontal="center", vertical="center")

    # 2. Table Column Headers (Row 5)
    headers = [
        ("Period", 12),
        ("Bell Schedule", 20),
        ("Monday", 26),
        ("Tuesday", 26),
        ("Wednesday", 26),
        ("Thursday", 26),
        ("Friday", 26),
    ]

    header_row_idx = 5
    ws.row_dimensions[header_row_idx].height = 26
    for col_idx, (hdr_text, col_width) in enumerate(headers, start=1):
        cell = ws.cell(row=header_row_idx, column=col_idx, value=hdr_text)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = grid_border
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = col_width

    # 3. Schedule Rows (Extended up to 9 periods with standard DepEd breaks)
    if max_periods is None or max_periods < 7:
        max_periods = 9
    max_periods = min(9, max(7, max_periods))

    # Load existing schedule slots for this section to pre-fill template
    existing_slots = session.exec(select(ScheduleSlot).where(ScheduleSlot.section_id == section.id)).all()
    slot_map = {(s.day_of_week, s.period_index): s for s in existing_slots}
    subj_map = {s.id: s.name for s in session.exec(select(Subject)).all()}
    teacher_map = {t.id: t.name for t in session.exec(select(Teacher)).all()}

    row_cursor = 6

    for p in range(1, max_periods + 1):
        # Health Break / Recess (after Period 2)
        if p == 3:
            ws.merge_cells(f"A{row_cursor}:G{row_cursor}")
            break_cell = ws.cell(row=row_cursor, column=1, value="9:00 AM – 9:20 AM  •  RECESS / HEALTH BREAK (Non-Teaching Statutory Block)")
            break_cell.fill = break_fill
            break_cell.font = break_font
            break_cell.alignment = Alignment(horizontal="center", vertical="center")
            ws.row_dimensions[row_cursor].height = 20
            row_cursor += 1

        # Lunch Break (after Period 4)
        if p == 5:
            ws.merge_cells(f"A{row_cursor}:G{row_cursor}")
            lunch_cell = ws.cell(row=row_cursor, column=1, value="11:20 AM – 12:00 PM  •  LUNCH BREAK / MID-DAY RECESS")
            lunch_cell.fill = break_fill
            lunch_cell.font = break_font
            lunch_cell.alignment = Alignment(horizontal="center", vertical="center")
            ws.row_dimensions[row_cursor].height = 20
            row_cursor += 1

        ws.row_dimensions[row_cursor].height = 36
        ws.cell(row=row_cursor, column=1, value=f"Period {p}").alignment = Alignment(horizontal="center", vertical="center")
        ws.cell(row=row_cursor, column=2, value=DEFAULT_PERIOD_TIMES.get(p, f"Period {p}")).alignment = Alignment(horizontal="center", vertical="center")

        for col_idx in range(3, 8):
            day_idx = col_idx - 3  # 0=Monday .. 4=Friday
            slot = slot_map.get((day_idx, p))

            if slot and slot.subject_id in subj_map and slot.teacher_id in teacher_map:
                cell_val = f"{subj_map[slot.subject_id]}\n{teacher_map[slot.teacher_id]}"
                is_locked_cell = (day_idx == 0 and p == 1) or slot.is_locked
            elif day_idx == 0 and p == 1:
                cell_val = f"Homeroom Guidance Program\n{adv_name}"
                is_locked_cell = True
            else:
                cell_val = ""
                is_locked_cell = False

            c = ws.cell(row=row_cursor, column=col_idx, value=cell_val)
            c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c.font = data_font
            c.border = grid_border
            if is_locked_cell:
                c.fill = locked_fill

        for c_idx in (1, 2):
            ws.cell(row=row_cursor, column=c_idx).border = grid_border
            ws.cell(row=row_cursor, column=c_idx).font = data_font

        row_cursor += 1

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


# =============================================================================
# SECTION SCHEDULE: PARSER & CONFLICT AUDITOR
# =============================================================================
def parse_and_preview_section_schedule_excel(
    file_bytes: bytes,
    filename: str,
    section_id: int,
    session: Session,
    sheet_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Parses an uploaded .xlsx, .xls, or .csv schedule file for a target Section.
    Supports multi-sheet workbooks, timetable grid matrices, and tabular slot lists.
    Audits every slot against existing section schedules, statutory caps (RA 4670),
    and adviser Homeroom locks. Returns an interactive preview payload with in-modal clash resolution options.
    """
    section = session.get(Section, section_id)
    if not section:
        return {"success": False, "error": f"Section ID {section_id} not found."}

    all_subjects = session.exec(select(Subject)).all()
    all_teachers = session.exec(select(Teacher)).all()
    active_teachers = [t for t in all_teachers if t.status == TeacherStatus.ACTIVE]
    dept_map = {d.id: d for d in session.exec(select(Department)).all()}
    teachers_by_dept: Dict[int, List[Teacher]] = {}
    for t in active_teachers:
        teachers_by_dept.setdefault(t.department_id, []).append(t)

    # Class Adviser for this section
    adviser = session.exec(select(Teacher).where(Teacher.advisory_section_id == section.id)).first()

    # Pre-map other section slots to detect teacher double-booking
    other_slots = session.exec(select(ScheduleSlot).where(ScheduleSlot.section_id != section.id)).all()
    teacher_busy_map: Dict[Tuple[int, int, int], int] = {}
    teacher_daily_loads: Dict[Tuple[int, int], int] = {}
    sec_names_map = {s.id: s.name for s in session.exec(select(Section)).all()}

    for sl in other_slots:
        teacher_busy_map[(sl.teacher_id, sl.day_of_week, sl.period_index)] = sl.section_id
        t_key = (sl.teacher_id, sl.day_of_week)
        teacher_daily_loads[t_key] = teacher_daily_loads.get(t_key, 0) + 1

    # Load spreadsheet into pandas
    fn_lower = filename.lower()
    available_sheets: List[str] = []
    chosen_sheet: Optional[str] = None
    try:
        if fn_lower.endswith(".csv"):
            df_raw = pd.read_csv(io.BytesIO(file_bytes), header=None, dtype=str)
        else:
            xl_file = pd.ExcelFile(io.BytesIO(file_bytes))
            available_sheets = xl_file.sheet_names
            if sheet_name and sheet_name in available_sheets:
                chosen_sheet = sheet_name
            elif available_sheets:
                # Try to fuzzy-match sheet name to current section name
                clean_sec_name = re.sub(r"^(grade\s*\d+\s*[-–]\s*)", "", section.name, flags=re.IGNORECASE).strip().lower()
                matched_sheet = next(
                    (s for s in available_sheets if clean_sec_name in s.lower() or s.lower() in section.name.lower()),
                    None
                )
                chosen_sheet = matched_sheet or available_sheets[0]
            df_raw = xl_file.parse(sheet_name=chosen_sheet, header=None, dtype=str)
    except Exception as e:
        return {"success": False, "error": f"Failed to read spreadsheet: {str(e)}"}

    if df_raw.empty:
        return {"success": False, "error": "The uploaded spreadsheet is empty."}

    # Find the header row
    header_row_idx = 0
    layout_type = "GRID_MATRIX"  # Default
    col_mapping = {}

    DAY_DETECTION_KEYWORDS = [
        "monday", "mon", "lunes",
        "tuesday", "tue", "martes",
        "wednesday", "wed", "miyerkules", "mierkules",
        "thursday", "thu", "thur", "thurs", "huwebes",
        "friday", "fri", "biyernes",
    ]

    for r_idx in range(min(15, len(df_raw))):
        row_vals = [str(v or "").lower().strip() for v in df_raw.iloc[r_idx]]

        # Check for Grid Matrix (Columns contain Monday, Tuesday, Mon, Tue, etc.)
        matched_days = [
            c_idx for c_idx, v in enumerate(row_vals)
            if any(re.search(rf"\b{re.escape(d)}\b", v) or v == d for d in DAY_DETECTION_KEYWORDS)
        ]
        if len(matched_days) >= 3:
            header_row_idx = r_idx
            layout_type = "GRID_MATRIX"
            # Map day columns
            for c_idx, val in enumerate(row_vals):
                for d_name, d_idx in DAYS_MAP.items():
                    if (re.search(rf"\b{re.escape(d_name)}\b", val) or d_name == val) and d_idx not in col_mapping.values():
                        col_mapping[c_idx] = d_idx
                        break
            break

        # Check for Tabular List (Columns contain Day, Period, Subject)
        has_day = any("day" in v for v in row_vals)
        has_period = any("period" in v or "time" in v for v in row_vals)
        has_subject = any("subject" in v or "learning" in v for v in row_vals)
        if has_day and (has_period or has_subject):
            header_row_idx = r_idx
            layout_type = "TABULAR_LIST"
            break

    # Parse rows based on detected layout
    parsed_slots = []
    seen_coords = set()

    if layout_type == "GRID_MATRIX":
        # Data rows start after header_row_idx
        period_counter = 1
        for r_idx in range(header_row_idx + 1, len(df_raw)):
            row = df_raw.iloc[r_idx]
            first_val = str(row[0] or "").strip()
            second_val = str(row[1] or "").strip() if len(row) > 1 else ""
            combined_first = f"{first_val} {second_val}".lower()

            # Skip break rows or guidelines
            if any(k in combined_first for k in ("break", "recess", "lunch", "guideline", "instruction", "rule", "note:")):
                continue

            # Detect Period number from row header
            p_match = re.search(r"\b([1-9])\b", combined_first)
            if p_match:
                period_num = int(p_match.group(1))
            else:
                period_num = period_counter

            if period_num > 9:
                continue

            period_counter = period_num + 1

            for col_idx, day_idx in col_mapping.items():
                if col_idx >= len(row):
                    continue
                cell_val = row[col_idx]
                sub_raw, tch_raw = parse_schedule_cell(cell_val)
                if not sub_raw:
                    continue

                coord = (day_idx, period_num)
                if coord in seen_coords:
                    continue
                seen_coords.add(coord)

                parsed_slots.append({
                    "day_of_week": day_idx,
                    "period_index": period_num,
                    "raw_subject": sub_raw,
                    "raw_teacher": tch_raw,
                })
    else:
        # TABULAR LIST PARSER
        df = df_raw.iloc[header_row_idx + 1:].copy()
        header_vals = [str(v or "").lower().strip() for v in df_raw.iloc[header_row_idx]]

        day_col = next((i for i, v in enumerate(header_vals) if "day" in v), 0)
        period_col = next((i for i, v in enumerate(header_vals) if "period" in v or "time" in v), 1)
        sub_col = next((i for i, v in enumerate(header_vals) if "subject" in v or "learning" in v), 2)
        tch_col = next((i for i, v in enumerate(header_vals) if "teacher" in v or "faculty" in v or "instructor" in v), 3)

        for _, row in df.iterrows():
            raw_day = str(row[day_col] or "").lower().strip()
            raw_p = str(row[period_col] or "").strip()
            raw_sub = str(row[sub_col] or "").strip()
            raw_tch = str(row[tch_col] or "").strip() if tch_col < len(row) else ""

            if not raw_sub or raw_sub.lower() in ("nan", "none", "null"):
                continue

            # Parse Day
            day_idx = None
            for d_name, d_val in DAYS_MAP.items():
                if d_name in raw_day:
                    day_idx = d_val
                    break
            if day_idx is None:
                m_day = re.search(r"\b([0-4])\b", raw_day)
                if m_day:
                    day_idx = int(m_day.group(1))
                else:
                    continue

            # Parse Period
            m_p = re.search(r"\b([1-9])\b", raw_p)
            period_num = int(m_p.group(1)) if m_p else 1

            coord = (day_idx, period_num)
            if coord in seen_coords:
                continue
            seen_coords.add(coord)

            parsed_slots.append({
                "day_of_week": day_idx,
                "period_index": period_num,
                "raw_subject": raw_sub,
                "raw_teacher": raw_tch if raw_tch else None,
            })

    # Validate each slot against subjects, teachers, and statutory invariants
    preview_items = []
    stats = {
        "total_slots": len(parsed_slots),
        "valid_count": 0,
        "conflict_count": 0,
        "warning_count": 0,
    }

    # Track in-batch daily loads to check RA 4670 limit (<= 6.0 hrs/day)
    batch_teacher_daily: Dict[Tuple[int, int], int] = dict(teacher_daily_loads)

    for item in parsed_slots:
        day_idx = item["day_of_week"]
        period_idx = item["period_index"]
        raw_sub = item["raw_subject"]
        raw_tch = item["raw_teacher"]

        # Match subject
        matched_sub = match_subject_name(raw_sub, all_subjects)

        # Match teacher
        matched_teacher = None
        if raw_tch:
            matched_teacher = match_adviser_name(raw_tch, all_teachers)

        # Automatic Teacher Assignment if omitted:
        if not matched_teacher and matched_sub:
            if day_idx == 0 and period_idx == 1 and ("homeroom" in matched_sub.name.lower() or "guidance" in matched_sub.name.lower()):
                # Monday P1 auto-assigned to Adviser
                matched_teacher = adviser
            else:
                # Pick eligible department faculty with lowest load
                eligible = teachers_by_dept.get(matched_sub.department_id, [])
                if eligible:
                    # Sort by current load
                    eligible_sorted = sorted(eligible, key=lambda t: t.current_load_hours)
                    matched_teacher = eligible_sorted[0]

        # Determine Status and Diagnostic message
        status_code = "VALID"
        conflict_msg = ""
        is_locked = False

        if not matched_sub:
            status_code = "UNMATCHED_SUBJECT"
            conflict_msg = f"Subject '{raw_sub}' could not be matched with DepEd curriculum."
            stats["conflict_count"] += 1
        elif not matched_teacher:
            status_code = "UNMATCHED_TEACHER"
            conflict_msg = f"Faculty member '{raw_tch or 'Unassigned'}' not found in active roster."
            stats["warning_count"] += 1
        else:
            # Check Teacher Collision in other sections
            busy_sec_id = teacher_busy_map.get((matched_teacher.id, day_idx, period_idx))
            if busy_sec_id:
                clashing_sec_name = sec_names_map.get(busy_sec_id, f"Section #{busy_sec_id}")
                status_code = "CONFLICT"
                conflict_msg = f"Double-Booking Conflict: {matched_teacher.name} is already assigned to {clashing_sec_name} on {DAY_NAMES[day_idx]} Period {period_idx}."
                stats["conflict_count"] += 1
            elif day_idx == 0 and period_idx == 1:
                # Monday Period 1 Homeroom Lock
                is_locked = True
                if adviser and matched_teacher.id != adviser.id:
                    status_code = "WARNING"
                    conflict_msg = f"Monday Period 1 is typically assigned to Class Adviser ({adviser.name}). Assigned to {matched_teacher.name}."
                    stats["warning_count"] += 1
                else:
                    status_code = "VALID"
                    conflict_msg = "Statutory Homeroom Guidance Lock (DepEd Order No. 009, s. 2026)."
                    stats["valid_count"] += 1
            else:
                # Check RA 4670 daily limit
                cur_load = batch_teacher_daily.get((matched_teacher.id, day_idx), 0)
                if cur_load >= 6:
                    status_code = "WARNING"
                    conflict_msg = f"Workload Warning: {matched_teacher.name} daily load reaches {cur_load + 1} hrs (RA 4670 ceiling is 6.0 hrs/day)."
                    stats["warning_count"] += 1
                else:
                    status_code = "VALID"
                    stats["valid_count"] += 1

                batch_teacher_daily[(matched_teacher.id, day_idx)] = cur_load + 1

        # Build list of eligible teachers for this subject's department to power in-modal clash resolution
        dept_teachers_list = teachers_by_dept.get(matched_sub.department_id, []) if matched_sub else active_teachers
        eligible_candidates = [
            {
                "id": t.id,
                "name": t.name,
                "current_load": t.current_load_hours or 0,
                "is_adviser": t.is_adviser,
            }
            for t in dept_teachers_list
        ]

        preview_items.append({
            "day_of_week": day_idx,
            "day_name": DAY_NAMES[day_idx],
            "period_index": period_idx,
            "time_str": DEFAULT_PERIOD_TIMES.get(period_idx, f"Period {period_idx}"),
            "raw_subject": raw_sub,
            "subject_id": matched_sub.id if matched_sub else None,
            "subject_name": matched_sub.name if matched_sub else raw_sub,
            "department_id": matched_sub.department_id if matched_sub else None,
            "raw_teacher": raw_tch,
            "teacher_id": matched_teacher.id if matched_teacher else None,
            "teacher_name": matched_teacher.name if matched_teacher else (raw_tch or "Unassigned"),
            "eligible_teachers": eligible_candidates,
            "is_locked": is_locked,
            "status": status_code,
            "message": conflict_msg,
        })

    # Sort items by day, then period
    preview_items.sort(key=lambda x: (x["day_of_week"], x["period_index"]))

    return {
        "success": True,
        "section_id": section.id,
        "section_name": section.name,
        "layout_detected": layout_type,
        "available_sheets": available_sheets,
        "active_sheet": chosen_sheet or (available_sheets[0] if available_sheets else "Sheet1"),
        "slots": preview_items,
        "stats": stats,
        "can_import": stats["conflict_count"] == 0,
    }


# =============================================================================
# SECTION SCHEDULE: ATOMIC PERSISTENCE
# =============================================================================
def persist_section_schedule_excel(
    section_id: int,
    slots_data: List[Dict[str, Any]],
    session: Session,
) -> Dict[str, Any]:
    """
    Atomically clears existing schedule slots for section_id, inserts validated slots,
    recalculates teacher loads, and commits to database.
    """
    section = session.get(Section, section_id)
    if not section:
        return {"success": False, "error": f"Section ID {section_id} not found."}

    if not slots_data:
        return {"success": False, "error": "No schedule slots provided for import."}

    # Snapshot existing slots for section to identify affected teachers
    old_slots = session.exec(select(ScheduleSlot).where(ScheduleSlot.section_id == section_id)).all()
    affected_teacher_ids = {sl.teacher_id for sl in old_slots}

    # Delete old slots
    for sl in old_slots:
        session.delete(sl)
    session.flush()

    # Insert new slots
    inserted_slots = []
    for item in slots_data:
        sub_id = item.get("subject_id")
        tch_id = item.get("teacher_id")
        d_idx = item.get("day_of_week")
        p_idx = item.get("period_index")

        if not sub_id or not tch_id:
            continue

        is_mon_p1 = (d_idx == 0 and p_idx == 1)
        slot = ScheduleSlot(
            section_id=section_id,
            subject_id=sub_id,
            teacher_id=tch_id,
            day_of_week=d_idx,
            period_index=p_idx,
            is_locked=bool(item.get("is_locked", is_mon_p1)),
        )
        session.add(slot)
        inserted_slots.append(slot)
        affected_teacher_ids.add(tch_id)

    session.commit()

    # Recalculate teacher workloads
    all_slots = session.exec(select(ScheduleSlot)).all()
    slot_counts = {}
    for sl in all_slots:
        slot_counts[sl.teacher_id] = slot_counts.get(sl.teacher_id, 0) + 1

    for t_id in affected_teacher_ids:
        t = session.get(Teacher, t_id)
        if t:
            t.current_load_hours = slot_counts.get(t.id, 0)
            session.add(t)

    session.commit()

    return {
        "success": True,
        "section_id": section.id,
        "section_name": section.name,
        "slots_imported": len(inserted_slots),
        "imported_count": len(inserted_slots),
        "message": f"Successfully imported {len(inserted_slots)} weekly class periods for {section.name}.",
    }


# =============================================================================
# BACKWARD-COMPATIBLE SECTION ROSTER IMPORTER (LEGACY HANDLERS)
# =============================================================================
def generate_sections_excel_template() -> io.BytesIO:
    """Legacy section roster template generation."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Section Roster"
    header_fill = PatternFill(start_color="2E0249", end_color="2E0249", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    headers = [("Section Name", 30), ("Grade Level", 14), ("Program Track", 18), ("Room Number", 18), ("Class Adviser (Optional)", 30)]
    for col_idx, (hdr_text, col_width) in enumerate(headers, start=1):
        c = ws.cell(row=1, column=col_idx, value=hdr_text)
        c.fill = header_fill
        c.font = header_font
        ws.column_dimensions[get_column_letter(col_idx)].width = col_width
    ws.append(["Grade 7 - Diamond", 7, "BEC", "Room 701", "Mrs. Janet Mendoza"])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def parse_and_preview_spreadsheet(
    file_bytes: bytes,
    filename: str,
    session: Session,
) -> Dict[str, Any]:
    """
    Parses an uploaded section roster (.xlsx, .xls, .csv).
    Detects column headers (Section Name, Grade Level, Program Track, Room, Class Adviser).
    Audits every record: checks grade validity (7-10), track validity (BEC, STE, SPA, SPJ, SPS),
    matches existing database sections by name, and matches Class Adviser via fuzzy matching.
    """
    fn_lower = filename.lower()
    try:
        if fn_lower.endswith(".csv"):
            df_raw = pd.read_csv(io.BytesIO(file_bytes), header=None, dtype=str)
        else:
            df_raw = pd.read_excel(io.BytesIO(file_bytes), header=None, dtype=str)
    except Exception as e:
        return {"success": False, "error": f"Failed to read section spreadsheet: {str(e)}"}

    if df_raw.empty:
        return {"success": False, "error": "The uploaded section spreadsheet is empty."}

    # Find header row
    header_row_idx = 0
    col_map: Dict[str, int] = {}
    for r_idx in range(min(10, len(df_raw))):
        row_vals = [str(v or "").lower().strip() for v in df_raw.iloc[r_idx]]
        has_sec = any("section" in v or "name" in v or "sec" in v for v in row_vals)
        has_gr = any("grade" in v or "level" in v or "gr" in v for v in row_vals)
        if has_sec or has_gr:
            header_row_idx = r_idx
            for c_idx, val in enumerate(row_vals):
                if any(k in val for k in ("section", "sec name", "class name")) and "name" not in col_map:
                    col_map["name"] = c_idx
                elif any(k in val for k in ("grade", "level", "gr")) and "grade_level" not in col_map:
                    col_map["grade_level"] = c_idx
                elif any(k in val for k in ("program", "track", "curriculum")) and "program_type" not in col_map:
                    col_map["program_type"] = c_idx
                elif any(k in val for k in ("room", "classroom", "rm")) and "room_number" not in col_map:
                    col_map["room_number"] = c_idx
                elif any(k in val for k in ("adviser", "teacher", "faculty")) and "adviser" not in col_map:
                    col_map["adviser"] = c_idx
            break

    # Defaults if headers not fully identified
    name_col = col_map.get("name", 0)
    grade_col = col_map.get("grade_level", 1 if len(df_raw.columns) > 1 else None)
    track_col = col_map.get("program_type", 2 if len(df_raw.columns) > 2 else None)
    room_col = col_map.get("room_number", 3 if len(df_raw.columns) > 3 else None)
    adv_col = col_map.get("adviser", 4 if len(df_raw.columns) > 4 else None)

    existing_sections = session.exec(select(Section)).all()
    existing_by_name = {s.name.strip().lower(): s for s in existing_sections}
    all_teachers = session.exec(select(Teacher)).all()

    preview_rows = []
    seen_in_file = set()
    stats = {
        "total": 0,
        "valid": 0,
        "new": 0,
        "updating": 0,
        "advisers_matched": 0,
    }

    for r_idx in range(header_row_idx + 1, len(df_raw)):
        row = df_raw.iloc[r_idx]
        raw_name = str(row[name_col] or "").strip() if name_col is not None and name_col < len(row) else ""
        if not raw_name or raw_name.lower() in ("nan", "none", "null", ""):
            continue

        raw_grade = str(row[grade_col] or "").strip() if grade_col is not None and grade_col < len(row) else ""
        raw_track = str(row[track_col] or "").strip() if track_col is not None and track_col < len(row) else "BEC"
        raw_room = str(row[room_col] or "").strip() if room_col is not None and room_col < len(row) else ""
        raw_adv = str(row[adv_col] or "").strip() if adv_col is not None and adv_col < len(row) else ""

        # Parse grade level (default 7 if missing, or extract digit from 'Grade 7' or '7')
        m_gr = re.search(r"\b(7|8|9|10)\b", f"{raw_grade} {raw_name}")
        grade_num = int(m_gr.group(1)) if m_gr else 7

        # Normalize track
        track_upper = raw_track.upper().strip()
        if any(t in track_upper for t in ("STE", "SCIENCE")):
            prog_type = "STE"
        elif any(t in track_upper for t in ("SPA", "ARTS")):
            prog_type = "SPA"
        elif any(t in track_upper for t in ("SPJ", "JOURNALISM")):
            prog_type = "SPJ"
        elif any(t in track_upper for t in ("SPS", "SPORTS")):
            prog_type = "SPS"
        else:
            prog_type = "BEC"

        # Check existing section in database
        clean_name_key = raw_name.lower().strip()
        existing_sec = existing_by_name.get(clean_name_key)

        # Match adviser
        matched_adv = match_adviser_name(raw_adv, all_teachers) if raw_adv and raw_adv.lower() not in ("nan", "none", "") else None
        if matched_adv:
            stats["advisers_matched"] += 1

        is_dup = clean_name_key in seen_in_file
        seen_in_file.add(clean_name_key)

        if is_dup:
            status_code = "DUPLICATE_IN_FILE"
            msg = f"Duplicate section '{raw_name}' in spreadsheet."
        elif existing_sec:
            status_code = "UPDATING"
            msg = f"Will update existing Section ID {existing_sec.id}."
            stats["updating"] += 1
            stats["valid"] += 1
        else:
            status_code = "NEW"
            msg = f"Will create new Grade {grade_num} {prog_type} section."
            stats["new"] += 1
            stats["valid"] += 1

        stats["total"] += 1

        preview_rows.append({
            "row_index": r_idx,
            "section_id": existing_sec.id if existing_sec else None,
            "name": raw_name,
            "grade_level": grade_num,
            "program_type": prog_type,
            "room_number": raw_room if raw_room and raw_room.lower() not in ("nan", "none") else "",
            "raw_adviser": raw_adv if raw_adv and raw_adv.lower() not in ("nan", "none") else None,
            "adviser_id": matched_adv.id if matched_adv else None,
            "adviser_name": matched_adv.name if matched_adv else (raw_adv if raw_adv and raw_adv.lower() not in ("nan", "none") else None),
            "adviser_matched": matched_adv is not None,
            "status": status_code,
            "status_message": msg,
        })

    return {
        "success": True,
        "filename": filename,
        "detected_columns": {
            "name": str(df_raw.iloc[header_row_idx, name_col]) if name_col < len(df_raw.columns) else None,
            "grade_level": str(df_raw.iloc[header_row_idx, grade_col]) if grade_col is not None and grade_col < len(df_raw.columns) else None,
            "program_type": str(df_raw.iloc[header_row_idx, track_col]) if track_col is not None and track_col < len(df_raw.columns) else None,
            "room_number": str(df_raw.iloc[header_row_idx, room_col]) if room_col is not None and room_col < len(df_raw.columns) else None,
            "adviser": str(df_raw.iloc[header_row_idx, adv_col]) if adv_col is not None and adv_col < len(df_raw.columns) else None,
        },
        "rows": preview_rows,
        "stats": stats,
    }


def import_sections_from_items(
    items: List[Dict[str, Any]],
    update_existing: bool,
    session: Session,
) -> Dict[str, Any]:
    """
    Batch persist verified section items from Excel preview.
    Creates new sections or updates existing sections, links advisers, and synchronizes Monday P1 Homeroom slots.
    """
    created_count = 0
    updated_count = 0
    skipped_count = 0

    homeroom_sub = next(
        (s for s in session.exec(select(Subject)).all() if "homeroom" in s.name.lower() or "guidance" in s.name.lower()),
        None,
    )

    for item in items:
        name = str(item.get("name") or "").strip()
        if not name:
            skipped_count += 1
            continue

        grade_lvl = int(item.get("grade_level", 7))
        prog_type = str(item.get("program_type", "BEC")).upper().strip()
        room_num = str(item.get("room_number", "")).strip()
        adv_id = item.get("adviser_id")

        # Check existing section by name
        existing_sec = session.exec(select(Section).where(Section.name == name)).first()
        if not existing_sec and item.get("section_id"):
            existing_sec = session.get(Section, item["section_id"])

        if existing_sec:
            if not update_existing:
                skipped_count += 1
                continue
            existing_sec.grade_level = grade_lvl
            existing_sec.program_type = prog_type
            if room_num:
                existing_sec.room_number = room_num
            session.add(existing_sec)
            target_sec = existing_sec
            updated_count += 1
        else:
            new_sec = Section(
                name=name,
                grade_level=grade_lvl,
                program_type=prog_type,
                room_number=room_num or None,
            )
            session.add(new_sec)
            session.flush()
            target_sec = new_sec
            created_count += 1

        # Link Class Adviser
        if adv_id:
            adv_teacher = session.get(Teacher, adv_id)
            if adv_teacher:
                adv_teacher.advisory_section_id = target_sec.id
                adv_teacher.is_adviser = True
                session.add(adv_teacher)

                # Synchronize Monday Period 1 Homeroom Guidance Program slot
                if homeroom_sub:
                    hm_slot = session.exec(
                        select(ScheduleSlot).where(
                            ScheduleSlot.section_id == target_sec.id,
                            ScheduleSlot.day_of_week == 0,
                            ScheduleSlot.period_index == 1,
                        )
                    ).first()
                    if hm_slot:
                        hm_slot.teacher_id = adv_teacher.id
                        hm_slot.subject_id = homeroom_sub.id
                        hm_slot.is_locked = True
                        session.add(hm_slot)
                    else:
                        new_hm_slot = ScheduleSlot(
                            section_id=target_sec.id,
                            teacher_id=adv_teacher.id,
                            subject_id=homeroom_sub.id,
                            day_of_week=0,
                            period_index=1,
                            is_locked=True,
                        )
                        session.add(new_hm_slot)

    session.commit()

    return {
        "success": True,
        "created_count": created_count,
        "updated_count": updated_count,
        "skipped_count": skipped_count,
        "total_processed": len(items),
        "message": f"Successfully processed {len(items)} sections: {created_count} created, {updated_count} updated, {skipped_count} skipped.",
    }
