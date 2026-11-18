import io
from pathlib import Path
import pytest
import openpyxl
from sqlmodel import Session, SQLModel, create_engine, select
from app.models import Section, Subject, Teacher, ScheduleSlot, Department, TeacherStatus
from app.services.excel_importer import (
    parse_schedule_cell,
    generate_section_schedule_template,
    parse_and_preview_section_schedule_excel,
    persist_section_schedule_excel,
    generate_sections_excel_template,
    parse_and_preview_spreadsheet,
    import_sections_from_items,
)

EXCEL_TEST_DB = Path(__file__).resolve().parent.parent / "test_excel_import.db"
excel_test_engine = create_engine(
    f"sqlite:///{EXCEL_TEST_DB}",
    echo=False,
    connect_args={"check_same_thread": False},
)


@pytest.fixture(scope="module", autouse=True)
def setup_excel_test_db():
    SQLModel.metadata.drop_all(excel_test_engine)
    SQLModel.metadata.create_all(excel_test_engine)

    with Session(excel_test_engine) as session:
        dept = Department(name="Science", code="SCI")
        session.add(dept)
        session.flush()

        t1 = Teacher(
            name="Dr. Aris Thorne",
            department_id=dept.id,
            position="Master Teacher I",
            max_daily_hours=6,
            max_weekly_hours=30,
            status=TeacherStatus.ACTIVE,
        )
        t2 = Teacher(
            name="Mrs. Janet Mendoza",
            department_id=dept.id,
            position="Teacher III",
            max_daily_hours=6,
            max_weekly_hours=30,
            status=TeacherStatus.ACTIVE,
        )
        session.add(t1)
        session.add(t2)
        session.flush()

        sub_hr = Subject(
            name="Homeroom Guidance Program",
            department_id=dept.id,
            grade_level=0,
            required_weekly_loads=1,
        )
        sub_sci = Subject(
            name="Science",
            department_id=dept.id,
            grade_level=7,
            required_weekly_loads=4,
        )
        session.add(sub_hr)
        session.add(sub_sci)
        session.flush()

        sec = Section(
            name="Grade 7 - Diamond",
            grade_level=7,
            program_type="BEC",
            room_number="Room 701",
        )
        session.add(sec)
        session.flush()

        t2.is_adviser = True
        t2.advisory_section_id = sec.id
        session.add(t2)

        # Add homeroom slot
        slot_hr = ScheduleSlot(
            section_id=sec.id,
            subject_id=sub_hr.id,
            teacher_id=t2.id,
            day_of_week=0,
            period_index=1,
            is_locked=True,
        )
        session.add(slot_hr)

        # Add academic slot
        slot_sci = ScheduleSlot(
            section_id=sec.id,
            subject_id=sub_sci.id,
            teacher_id=t1.id,
            day_of_week=1,
            period_index=2,
            is_locked=False,
        )
        session.add(slot_sci)
        session.commit()

    yield

    SQLModel.metadata.drop_all(excel_test_engine)
    if EXCEL_TEST_DB.exists():
        try:
            EXCEL_TEST_DB.unlink()
        except Exception:
            pass


def test_parse_schedule_cell_room_stripping():
    # Room in parentheses should NOT be parsed as teacher
    sub, tch = parse_schedule_cell("Mathematics (Room 101)")
    assert sub == "Mathematics"
    assert tch is None

    sub2, tch2 = parse_schedule_cell("Science (Rm 204)")
    assert sub2 == "Science"
    assert tch2 is None

    sub3, tch3 = parse_schedule_cell("Filipino (Grade 7)")
    assert sub3 == "Filipino"
    assert tch3 is None

    # Teacher in parentheses SHOULD be parsed as teacher
    sub4, tch4 = parse_schedule_cell("English (Ms. Camille Santos)")
    assert sub4 == "English"
    assert tch4 == "Ms. Camille Santos"

    # Multi-line with room annotation on teacher
    sub5, tch5 = parse_schedule_cell("Science\nDr. Aris Thorne (Room 101)")
    assert sub5 == "Science"
    assert tch5 == "Dr. Aris Thorne"


def test_section_schedule_excel_lifecycle():
    with Session(excel_test_engine) as session:
        # Pick first section
        sec = session.exec(select(Section)).first()
        assert sec is not None

        # 1. Generate template
        buf = generate_section_schedule_template(sec, session)
        assert buf.getbuffer().nbytes > 0

        # 2. Preview generated template
        preview_res = parse_and_preview_section_schedule_excel(
            buf.getvalue(),
            f"Schedule_{sec.name}.xlsx",
            sec.id,
            session,
        )
        assert preview_res["success"] is True
        assert preview_res["layout_detected"] == "GRID_MATRIX"
        assert len(preview_res["slots"]) > 0
        assert "eligible_teachers" in preview_res["slots"][0]

        # 3. Import slots
        valid_slots = [
            {
                "day_of_week": s["day_of_week"],
                "period_index": s["period_index"],
                "subject_id": s["subject_id"],
                "teacher_id": s["teacher_id"],
                "is_locked": s["is_locked"],
            }
            for s in preview_res["slots"]
            if s["subject_id"] and s["teacher_id"]
        ]
        import_res = persist_section_schedule_excel(sec.id, valid_slots, session)
        assert import_res["success"] is True
        assert import_res["slots_imported"] == len(valid_slots)


def test_section_roster_excel_lifecycle():
    with Session(excel_test_engine) as session:
        # 1. Generate roster template
        buf = generate_sections_excel_template()
        assert buf.getbuffer().nbytes > 0

        # 2. Preview roster template
        preview_res = parse_and_preview_spreadsheet(
            buf.getvalue(),
            "DepEd_Section_Roster_Template.xlsx",
            session,
        )
        assert preview_res["success"] is True
        assert len(preview_res["rows"]) >= 1
        assert preview_res["stats"]["total"] >= 1

        # 3. Import roster items
        import_res = import_sections_from_items(
            preview_res["rows"],
            update_existing=True,
            session=session,
        )
        assert import_res["success"] is True
        assert import_res["total_processed"] >= 1
