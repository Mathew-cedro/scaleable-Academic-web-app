"""
DepEd Class Program Word Document (.docx) Generator Service.
Generates official, print-ready Class Programs formatted for Microsoft Word
with configurable bell schedule break rows and official DepEd 4-tier signature blocks.
"""

import io
import os
from typing import Dict, List, Optional
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

from app.models import Section, ScheduleSlot, Teacher, Subject


def replace_text_in_paragraph(paragraph, replacements: Dict[str, str]):
    """Replaces placeholders in a paragraph while preserving basic formatting."""
    full_text = paragraph.text
    replaced = False
    for key, val in replacements.items():
        if key in full_text:
            full_text = full_text.replace(key, str(val))
            replaced = True
    if replaced:
        paragraph.text = full_text


def set_cell_margins(cell, top=80, bottom=80, left=100, right=100):
    """Set inner padding for a table cell (values in twips/dxa: 20 dxa = 1 pt)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for margin_name, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{margin_name}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


def set_cell_background(cell, fill_hex: str):
    """Set cell background shading."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)


def set_cell_borders(cell, top="single", bottom="single", left="single", right="single", color="000000", sz="4"):
    """Set custom thin borders on a table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for border_name, border_style in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{border_name}')
        node.set(qn('w:val'), border_style)
        node.set(qn('w:sz'), sz)
        node.set(qn('w:space'), '0')
        node.set(qn('w:color'), color)
        tcBorders.append(node)
    tcPr.append(tcBorders)


def generate_class_schedule_document(
    section: Section,
    slots: List[ScheduleSlot],
    teachers: List[Teacher],
    subjects: Optional[List[Subject]] = None,
    school_year: str = "2026-2027",
    flag_ceremony_time: str = "6:45-7:00",
    morning_break_time: str = "9:00-9:15",
    lunch_break_time: str = "11:15-12:00",
    adviser_name: Optional[str] = None,
    grade_chairman: Optional[str] = None,
    consultant_1: Optional[str] = None,
    consultant_2: Optional[str] = None,
    principal_name: Optional[str] = "Dr. Eleanor Vance",
    template_path: Optional[str] = None,
) -> io.BytesIO:
    """
    Builds a complete official DepEd Class Program document.
    Returns in-memory BytesIO ready for streaming response.
    """
    teacher_map = {t.id: t for t in teachers}
    subject_map = {s.id: s for s in (subjects or [])}
    adviser = next((t for t in teachers if t.advisory_section_id == section.id), None)
    if not adviser_name and adviser:
        adviser_name = adviser.name

    # Determine default signatories
    if not grade_chairman:
        grade_chairman = "Mrs. Sarah Jenkins"
    if not consultant_1:
        consultant_1 = "Mr. David Chen"
    if not consultant_2:
        consultant_2 = "Mrs. Theresa Navarro"
    if not principal_name:
        principal_name = "Dr. Eleanor Vance"

    # Map slots by (day_of_week, period_index)
    # Days: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday
    slot_matrix: Dict[int, Dict[int, ScheduleSlot]] = {d: {} for d in range(5)}
    for s in slots:
        if s.section_id == section.id:
            slot_matrix[s.day_of_week][s.period_index] = s

    p_type = (section.program_type or "BEC").upper().strip()
    is_special_track = p_type not in ("BEC", "REGULAR", "STANDARD", "GENERAL")
    max_periods = 9 if is_special_track else 7

    # If an external template is provided and exists, apply placeholder replacement logic
    if template_path and os.path.exists(template_path):
        doc = docx.Document(template_path)
        replacements = {
            "{Grade Level}": f"Grade {section.grade_level}",
            "{track}": section.program_type or "BEC",
            "{Section}": section.name,
            "{Room}": section.room_number or "Room Unassigned",
            "{Year}": school_year,
            "{Name of Adviser}": adviser_name or "Unassigned Faculty",
            "{Name of Chairman}": grade_chairman,
            "{name of teacher}": consultant_1,
            "{Name of teacher}": consultant_2,
            "{position}": "Teacher III",
            "{Principal name}": principal_name,
        }

        for paragraph in doc.paragraphs:
            replace_text_in_paragraph(paragraph, replacements)

        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for paragraph in cell.paragraphs:
                        replace_text_in_paragraph(paragraph, replacements)

        # Output to buffer
        buf = io.BytesIO()
        doc.save(buf)
        buf.seek(0)
        return buf

    # =========================================================================
    # Programmatic DepEd Document Construction (Clean, Publication Quality)
    # =========================================================================
    doc = docx.Document()

    # Configure Margins (0.6 in margins for compact table layout)
    sections_doc = doc.sections
    for sec_doc in sections_doc:
        sec_doc.top_margin = Inches(0.5)
        sec_doc.bottom_margin = Inches(0.5)
        sec_doc.left_margin = Inches(0.6)
        sec_doc.right_margin = Inches(0.6)

    # Header Paragraphs
    p_header = doc.add_paragraph()
    p_header.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_header.paragraph_format.space_before = Pt(0)
    p_header.paragraph_format.space_after = Pt(2)
    run_title = p_header.add_run("CLASS PROGRAM")
    run_title.font.name = "Calibri"
    run_title.font.size = Pt(14)
    run_title.font.bold = True

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(2)
    run_sec = p_sub.add_run(f"Grade {section.grade_level} {section.program_type} - {section.name}")
    run_sec.font.name = "Calibri"
    run_sec.font.size = Pt(11)
    run_sec.font.bold = True

    p_room = doc.add_paragraph()
    p_room.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_room.paragraph_format.space_before = Pt(0)
    p_room.paragraph_format.space_after = Pt(10)
    run_room = p_room.add_run(f"{section.room_number or 'Room Unassigned'}   •   SY {school_year}")
    run_room.font.name = "Calibri"
    run_room.font.size = Pt(10)
    run_room.font.color.rgb = RGBColor(90, 90, 90)

    # Define Row Specifications
    # Each row is: (type, time_label, period_index_or_none, label_or_none)
    row_specs = [
        ("BREAK", flag_ceremony_time, None, "Flag Ceremony"),
        ("PERIOD", "7:00-8:00", 1, None),
        ("PERIOD", "8:00-9:00", 2, None),
        ("BREAK", morning_break_time, None, "Break Time"),
        ("PERIOD", "9:15-10:15", 3, None),
        ("PERIOD", "10:15-11:15", 4, None),
        ("BREAK", lunch_break_time, None, "Lunch Break"),
        ("PERIOD", "12:00-1:00", 5, None),
        ("PERIOD", "1:00-2:00", 6, None),
        ("PERIOD", "2:00-3:00", 7, None),
    ]
    if max_periods >= 8:
        row_specs.append(("PERIOD", "3:00-4:00", 8, None))
    if max_periods >= 9:
        row_specs.append(("PERIOD", "4:00-5:00", 9, None))

    # Create Schedule Table: 1 header row + len(row_specs) data rows, 6 columns (TIME + 5 DAYS)
    table = doc.add_table(rows=1 + len(row_specs), cols=6)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    col_widths = [Inches(1.2), Inches(1.2), Inches(1.2), Inches(1.2), Inches(1.2), Inches(1.2)]
    headers = ["TIME", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]

    # Header Row
    hdr_cells = table.rows[0].cells
    for i, h_text in enumerate(headers):
        hdr_cells[i].width = col_widths[i]
        set_cell_background(hdr_cells[i], "F0F0F0")
        set_cell_borders(hdr_cells[i], sz="8")
        set_cell_margins(hdr_cells[i], top=90, bottom=90, left=60, right=60)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        run = p.add_run(h_text)
        run.font.name = "Calibri"
        run.font.size = Pt(9.5)
        run.font.bold = True

    # Populate Data Rows
    for r_idx, (r_type, r_time, r_period, r_label) in enumerate(row_specs, start=1):
        row_cells = table.rows[r_idx].cells
        
        # Time Cell
        row_cells[0].width = col_widths[0]
        set_cell_margins(row_cells[0], top=60, bottom=60, left=60, right=60)
        set_cell_borders(row_cells[0], sz="4")
        p_time = row_cells[0].paragraphs[0]
        p_time.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_time.paragraph_format.space_before = Pt(0)
        p_time.paragraph_format.space_after = Pt(0)
        r_t = p_time.add_run(r_time)
        r_t.font.name = "Calibri"
        r_t.font.size = Pt(8.5)
        r_t.font.bold = True

        if r_type == "BREAK":
            # Break Row spanning all 5 days
            for d in range(5):
                c = row_cells[d + 1]
                c.width = col_widths[d + 1]
                set_cell_background(c, "F9F9F9")
                set_cell_borders(c, sz="4")
                set_cell_margins(c, top=50, bottom=50, left=40, right=40)
                p = c.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                run_b = p.add_run(r_label or "Break")
                run_b.font.name = "Calibri"
                run_b.font.size = Pt(8.5)
                run_b.font.bold = True
                run_b.font.italic = True
                run_b.font.color.rgb = RGBColor(100, 100, 100)
        else:
            # Period Row
            for d in range(5):
                c = row_cells[d + 1]
                c.width = col_widths[d + 1]
                set_cell_borders(c, sz="4")
                set_cell_margins(c, top=60, bottom=60, left=50, right=50)
                p = c.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)

                slot = slot_matrix[d].get(r_period)
                is_monday_hrgp = (d == 0 and r_period == 1)

                if is_monday_hrgp:
                    r_sub = p.add_run("HRGP\n")
                    r_sub.font.name = "Calibri"
                    r_sub.font.size = Pt(9)
                    r_sub.font.bold = True
                    r_tch = p.add_run(adviser_name or "Adviser")
                    r_tch.font.name = "Calibri"
                    r_tch.font.size = Pt(8)
                    r_tch.font.underline = True
                elif slot:
                    sub = subject_map.get(slot.subject_id)
                    s_name = getattr(slot, "subject_name", None) or (sub.name if sub else "SUBJECT")
                    if len(s_name) > 16:
                        # Friendly abbreviations for long subject names
                        if "Technology & Livelihood" in s_name:
                            s_name = "TLE"
                        elif "Music, Arts, PE" in s_name:
                            s_name = "MAPEH"
                        elif "Araling Panlipunan" in s_name:
                            s_name = "AP"
                        elif "Values Education" in s_name:
                            s_name = "EsP"

                    r_sub = p.add_run(f"{s_name}\n")
                    r_sub.font.name = "Calibri"
                    r_sub.font.size = Pt(9)
                    r_sub.font.bold = True

                    tch = teacher_map.get(slot.teacher_id)
                    t_name = getattr(slot, "teacher_name", None) or (tch.name if tch else "Faculty")
                    r_tch = p.add_run(t_name)
                    r_tch.font.name = "Calibri"
                    r_tch.font.size = Pt(8)
                    r_tch.font.underline = True
                else:
                    r_empty = p.add_run("—")
                    r_empty.font.name = "Calibri"
                    r_empty.font.size = Pt(9)
                    r_empty.font.color.rgb = RGBColor(180, 180, 180)

    # Space after table
    p_space = doc.add_paragraph()
    p_space.paragraph_format.space_before = Pt(14)
    p_space.paragraph_format.space_after = Pt(0)

    # =========================================================================
    # DepEd 4-Tier Signatures Block
    # =========================================================================
    # Tier 1 & 2: Adviser & Grade Level Chairman
    sig_table_1 = doc.add_table(rows=2, cols=2)
    sig_table_1.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_table_1.autofit = False
    for r in sig_table_1.rows:
        r.cells[0].width = Inches(3.5)
        r.cells[1].width = Inches(3.5)
        for c in r.cells:
            set_cell_borders(c, top="none", bottom="none", left="none", right="none")

    # Cell 0,0: Adviser
    p_adv = sig_table_1.rows[0].cells[0].paragraphs[0]
    p_adv.paragraph_format.space_after = Pt(1)
    r1 = p_adv.add_run(f"{adviser_name or 'Unassigned'}\n")
    r1.font.bold = True
    r1.font.size = Pt(9.5)
    r2 = p_adv.add_run("Adviser")
    r2.font.size = Pt(8.5)

    # Cell 0,1: Grade Level Chairman
    p_chm = sig_table_1.rows[0].cells[1].paragraphs[0]
    p_chm.paragraph_format.space_after = Pt(1)
    r3 = p_chm.add_run(f"{grade_chairman}\n")
    r3.font.bold = True
    r3.font.size = Pt(9.5)
    r4 = p_chm.add_run("Grade Level Chairman")
    r4.font.size = Pt(8.5)

    # Tier 3: Consultants (Teacher III & Head Teacher-III)
    p_gap = doc.add_paragraph()
    p_gap.paragraph_format.space_before = Pt(8)
    p_gap.paragraph_format.space_after = Pt(0)

    sig_table_2 = doc.add_table(rows=1, cols=2)
    sig_table_2.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_table_2.autofit = False
    for r in sig_table_2.rows:
        r.cells[0].width = Inches(3.5)
        r.cells[1].width = Inches(3.5)
        for c in r.cells:
            set_cell_borders(c, top="none", bottom="none", left="none", right="none")

    p_c1 = sig_table_2.rows[0].cells[0].paragraphs[0]
    p_c1.paragraph_format.space_after = Pt(1)
    rc1 = p_c1.add_run(f"{consultant_1}\n")
    rc1.font.bold = True
    rc1.font.size = Pt(9.5)
    rc2 = p_c1.add_run("Teacher III\nConsultant")
    rc2.font.size = Pt(8.5)

    p_c2 = sig_table_2.rows[0].cells[1].paragraphs[0]
    p_c2.paragraph_format.space_after = Pt(1)
    rc3 = p_c2.add_run(f"{consultant_2}\n")
    rc3.font.bold = True
    rc3.font.size = Pt(9.5)
    rc4 = p_c2.add_run("Head Teacher-III\nConsultant")
    rc4.font.size = Pt(8.5)

    # Tier 4: Principal IV (Centered)
    p_gap2 = doc.add_paragraph()
    p_gap2.paragraph_format.space_before = Pt(8)
    p_gap2.paragraph_format.space_after = Pt(0)

    p_prn = doc.add_paragraph()
    p_prn.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_prn.paragraph_format.space_after = Pt(0)
    rp1 = p_prn.add_run(f"{principal_name}\n")
    rp1.font.bold = True
    rp1.font.size = Pt(10)
    rp2 = p_prn.add_run("Principal IV")
    rp2.font.size = Pt(9)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf
