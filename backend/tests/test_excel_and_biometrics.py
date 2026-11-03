"""
Unit Tests for Excel Schedule Importer, Biometric Attendance Sync,
New Hire Conflict Audit, and Teacher Pocket Portal.
"""

from datetime import datetime
import io
import pytest
from sqlmodel import Session, SQLModel, create_engine, select
import openpyxl

from app.models import Department, ScheduleSlot, Section, Subject, Teacher, TeacherStatus
from app.schemas import NewHireAuditRequest, ProposedSlot
from app.services.biometric_service import (
    apply_biometric_substitutions,
    generate_dtr_template_bytes,
    process_biometric_log,
)
from app.services.excel_importer import (
    generate_schedule_template_bytes,
    preview_schedule_import,
)
from app.services.new_hire_service import audit_new_hire
from app.routers.import_export import get_teacher_pocket_schedule

test_engine = create_engine("sqlite:///:memory:", echo=False, connect_args={"check_same_thread": False})


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    SQLModel.metadata.create_all(test_engine)

    with Session(test_engine) as session:
        dept_sci = Department(name="Science", code="SCI")
        dept_math = Department(name="Mathematics", code="MATH")
        dept_eng = Department(name="English", code="ENG")
        session.add_all([dept_sci, dept_math, dept_eng])
        session.flush()

        t1 = Teacher(name="Dr. Aris Thorne", department_id=dept_sci.id, position="Master Teacher I", max_daily_hours=6, max_weekly_hours=30, current_load_hours=16, status=TeacherStatus.ACTIVE)
        t2 = Teacher(name="Mr. David Chen", department_id=dept_sci.id, position="Teacher III", max_daily_hours=6, max_weekly_hours=30, current_load_hours=12, status=TeacherStatus.ACTIVE)
        t3 = Teacher(name="Ms. Camille Santos", department_id=dept_sci.id, position="Teacher II", max_daily_hours=6, max_weekly_hours=30, current_load_hours=20, status=TeacherStatus.ACTIVE)
        t4 = Teacher(name="Mrs. Elena Rostova", department_id=dept_math.id, position="Master Teacher II", max_daily_hours=6, max_weekly_hours=30, current_load_hours=22, status=TeacherStatus.ACTIVE)
        session.add_all([t1, t2, t3, t4])
        session.flush()

        sec1 = Section(name="Grade 8 - STE Darwin", grade_level=8, program_type="STE", room_number="Room 201")
        sec2 = Section(name="Grade 8 - BEC Rizal", grade_level=8, program_type="BEC", room_number="Room 101")
        session.add_all([sec1, sec2])
        session.flush()

        sub_sci = Subject(name="Science", department_id=dept_sci.id, grade_level=8, required_weekly_loads=4)
        sub_math = Subject(name="Mathematics", department_id=dept_math.id, grade_level=8, required_weekly_loads=4)
        session.add_all([sub_sci, sub_math])
        session.flush()

        # Slot 1: Thorne teaches sec1 on Monday Period 2
        slot1 = ScheduleSlot(section_id=sec1.id, subject_id=sub_sci.id, teacher_id=t1.id, day_of_week=0, period_index=2)
        # Slot 2: Santos teaches sec2 on Monday Period 2
        slot2 = ScheduleSlot(section_id=sec2.id, subject_id=sub_sci.id, teacher_id=t3.id, day_of_week=0, period_index=2)
        # Slot 3: Santos teaches sec1 on Monday Period 3
        slot3 = ScheduleSlot(section_id=sec1.id, subject_id=sub_sci.id, teacher_id=t3.id, day_of_week=0, period_index=3)
        session.add_all([slot1, slot2, slot3])
        session.commit()

    yield
    SQLModel.metadata.drop_all(test_engine)


def test_excel_template_and_preview():
    """Verify schedule template generation and dry-run preview parsing."""
    template_bytes = generate_schedule_template_bytes()
    assert len(template_bytes) > 0, "Excel template was not generated"

    with Session(test_engine) as session:
        preview = preview_schedule_import(session, template_bytes, "template.xlsx")
        assert preview.total_rows > 0
        assert preview.valid_rows_count > 0
        assert preview.error_rows_count == 0


def test_biometric_dtr_and_substitutions():
    """Verify biometric scan ingestion detects absent teacher and suggests underloaded substitute."""
    dtr_bytes = generate_dtr_template_bytes()
    assert len(dtr_bytes) > 0

    with Session(test_engine) as session:
        # Process biometric log for Monday (day_of_week=0)
        res = process_biometric_log(session, dtr_bytes, "dtr.xlsx", target_day_of_week=0)
        assert res.total_scanned > 0
        assert res.absent_count >= 1

        # Ms. Camille Santos is marked absent in the sample template
        # She had slot2 (Period 2) and slot3 (Period 3) on Monday.
        # Thorne is busy Period 2, but Chen is free both periods and is in Science department.
        assert len(res.recommendations) > 0
        rec = res.recommendations[0]
        assert rec.suggested_substitute_id is not None
        assert rec.suggested_substitute_name == "Mr. David Chen"

        # Apply substitutions
        apply_res = apply_biometric_substitutions(session, res.recommendations)
        assert apply_res["success"] is True
        assert apply_res["applied_count"] > 0


def test_new_hire_conflict_audit():
    """Verify new hire conflict intelligence detects section collision and overload."""
    with Session(test_engine) as session:
        sec1 = session.exec(select(Section).where(Section.name == "Grade 8 - STE Darwin")).first()
        sub1 = session.exec(select(Subject).where(Subject.name == "Science")).first()
        dept1 = session.exec(select(Department).where(Department.code == "SCI")).first()

        # Try to schedule new hire on Monday Period 2 for sec1 (already taken by Thorne)
        req = NewHireAuditRequest(
            name="Mr. New Teacher",
            department_id=dept1.id,
            position="Teacher I",
            proposed_slots=[
                ProposedSlot(section_id=sec1.id, subject_id=sub1.id, day_of_week=0, period_index=2)
            ]
        )
        audit_res = audit_new_hire(session, req)
        assert audit_res.feasibility == "CONFLICT"
        assert audit_res.can_commit is False
        assert any(c.slot_type == "SECTION_CLASH" for c in audit_res.clashes)

        # Check that relief opportunities identify overloaded teachers
        assert len(audit_res.relief_opportunities) > 0


def test_teacher_pocket_schedule():
    """Verify minimal-effort pocket schedule for teachers."""
    with Session(test_engine) as session:
        t1 = session.exec(select(Teacher).where(Teacher.name == "Dr. Aris Thorne")).first()
        pocket = get_teacher_pocket_schedule(teacher_id=t1.id, day_override=0, session=session)
        assert pocket.teacher_name == "Dr. Aris Thorne"
        assert pocket.day_of_week == 0
        assert len(pocket.today_schedule) >= 1
        assert pocket.max_daily_hours == 6
