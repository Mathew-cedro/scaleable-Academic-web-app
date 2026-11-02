"""
Automated Unit Tests for Google OR-Tools CP-SAT Master Generator & Dynamic Repair Engine.
Verifies DepEd Key Stage 3 Rules, RA 4670 Workload Ceilings, and Fault Tolerance.
Uses an isolated SQLite test database to ensure no mutation of the development database.
"""

import os
from pathlib import Path
import pytest
from sqlmodel import Session, SQLModel, create_engine, select
from app.models import Department, ScheduleSlot, Section, Subject, Teacher, TeacherStatus
from app.schemas import GenerateScheduleRequest
from app.services.cp_solver import generate_master_schedule, repair_schedule

TEST_DB_FILE = Path(__file__).resolve().parent.parent / "test_scheduler.db"
test_engine = create_engine(
    f"sqlite:///{TEST_DB_FILE}",
    echo=False,
    connect_args={"check_same_thread": False},
)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    """Ensure isolated test database is initialized, seeded with 8 departments, 48 sections, and 64 teachers."""
    SQLModel.metadata.drop_all(test_engine)
    SQLModel.metadata.create_all(test_engine)

    from seed import DEPARTMENTS_DATA, SUBJECTS_DATA, SECTIONS_CONFIG, TEACHERS_BY_DEPT

    with Session(test_engine) as session:
        # 1. Departments
        dept_by_code = {}
        for d in DEPARTMENTS_DATA:
            dept = Department(name=d["name"], code=d["code"])
            session.add(dept)
            session.flush()
            dept_by_code[d["code"]] = dept.id

        # 2. Subjects
        for s in SUBJECTS_DATA:
            session.add(
                Subject(
                    name=s["name"],
                    department_id=dept_by_code[s["code"]],
                    grade_level=8,
                    required_weekly_loads=s["loads"],
                )
            )

        # 3. Sections (48 sections)
        sections = []
        for g, name, ptype, room in SECTIONS_CONFIG:
            sec = Section(
                name=name,
                grade_level=g,
                program_type=ptype,
                room_number=room,
            )
            session.add(sec)
            session.flush()
            sections.append(sec)

        # 4. Teachers (64 teachers, 48 advisers)
        adviser_idx = 0
        for code, t_list in TEACHERS_BY_DEPT.items():
            dept_id = dept_by_code[code]
            for i, (name, pos) in enumerate(t_list):
                is_adv = (i < 6) and (adviser_idx < len(sections))
                adv_sec_id = sections[adviser_idx].id if is_adv else None
                if is_adv:
                    adviser_idx += 1

                session.add(
                    Teacher(
                        name=name,
                        department_id=dept_id,
                        position=pos,
                        max_daily_hours=6,
                        max_weekly_hours=30,
                        current_load_hours=0,
                        is_adviser=is_adv,
                        advisory_section_id=adv_sec_id,
                        status=TeacherStatus.ACTIVE,
                    )
                )

        session.commit()

    yield

    # Teardown: drop test tables and remove test DB file
    SQLModel.metadata.drop_all(test_engine)
    if TEST_DB_FILE.exists():
        try:
            TEST_DB_FILE.unlink()
        except Exception:
            pass


def test_seed_integrity():
    """Verify 8 departments, 64 faculty, and 48 sections seeded correctly in test DB."""
    with Session(test_engine) as session:
        depts = session.exec(select(Department)).all()
        assert len(depts) == 8, f"Expected 8 departments, got {len(depts)}"

        teachers = session.exec(select(Teacher)).all()
        assert len(teachers) == 64, f"Expected 64 teachers, got {len(teachers)}"

        sections = session.exec(select(Section)).all()
        assert len(sections) == 48, f"Expected 48 sections, got {len(sections)}"

        # Verify 48 class advisers exist
        advisers = [t for t in teachers if t.is_adviser and t.advisory_section_id is not None]
        assert len(advisers) == 48, f"Expected 48 class advisers, got {len(advisers)}"


def test_master_schedule_generation():
    """Verify Master Schedule generation satisfies all Key Stage 3 & RA 4670 rules."""
    with Session(test_engine) as session:
        result = generate_master_schedule(session, config=GenerateScheduleRequest(preserve_locked_slots=False))
        assert result.success is True, f"Generation failed: {result.message}"
        assert result.slots_count > 0, "No slots were generated"
        assert result.latency_ms > 0, "Latency was not recorded"

        slots = session.exec(select(ScheduleSlot)).all()
        sections = session.exec(select(Section)).all()
        teachers = session.exec(select(Teacher)).all()

        # 1. Monday Period 1 Homeroom Lock Test for advised sections
        advised_sections = [c for c in sections if any(t.advisory_section_id == c.id for t in teachers)]
        for c in advised_sections:
            adviser = next((t for t in teachers if t.advisory_section_id == c.id), None)
            assert adviser is not None, f"Section {c.name} missing adviser"

            mon_p1_slot = next(
                (s for s in slots if s.section_id == c.id and s.day_of_week == 0 and s.period_index == 1),
                None,
            )
            assert mon_p1_slot is not None, f"Missing Monday Period 1 Homeroom for {c.name}"
            assert mon_p1_slot.is_locked is True, "Monday Period 1 must be marked is_locked=True"
            assert mon_p1_slot.teacher_id == adviser.id, (
                f"Monday Period 1 Homeroom for {c.name} must be taught by Adviser {adviser.name}"
            )

        # 2. RA 4670 Daily Cap Test (<= 6 hours/day per teacher)
        for t in teachers:
            for day in range(5):
                daily_count = len([s for s in slots if s.teacher_id == t.id and s.day_of_week == day])
                assert daily_count <= min(t.max_daily_hours, 6), (
                    f"Teacher {t.name} exceeded daily cap on day {day}: {daily_count} > 6"
                )

        # 3. Collision Free Tests
        slot_keys = [(s.section_id, s.day_of_week, s.period_index) for s in slots]
        assert len(slot_keys) == len(set(slot_keys)), "Duplicate section time slot detected!"

        teacher_time_keys = [(s.teacher_id, s.day_of_week, s.period_index) for s in slots if s.teacher_id]
        assert len(teacher_time_keys) == len(set(teacher_time_keys)), "Teacher double-booking detected!"


def test_fault_tolerant_dynamic_repair():
    """Verify dynamic repair rebalances classes when a teacher goes on leave."""
    with Session(test_engine) as session:
        # Pick an active teacher with teaching loads to put on leave
        teacher_on_leave = session.exec(
            select(Teacher).where(Teacher.status == TeacherStatus.ACTIVE, Teacher.current_load_hours > 0)
        ).first()
        assert teacher_on_leave is not None, "No active teacher found with teaching loads"

        # Mark teacher as ON_LEAVE
        teacher_on_leave.status = TeacherStatus.ON_LEAVE
        session.add(teacher_on_leave)
        session.commit()

        # Run dynamic repair
        repair_result = repair_schedule(session)
        assert repair_result.success is True, f"Repair failed: {repair_result.message}"
        assert repair_result.diff is not None, "DiffResult was not generated"

        # Verify absent teacher now has 0 classes assigned
        repaired_slots = session.exec(select(ScheduleSlot)).all()
        absent_assigned = [s for s in repaired_slots if s.teacher_id == teacher_on_leave.id]
        assert len(absent_assigned) == 0, (
            f"Absent teacher {teacher_on_leave.name} still has {len(absent_assigned)} classes assigned!"
        )

        # Verify disruption cost was quantified
        assert repair_result.disruption_cost >= 0, "Disruption cost should be non-negative"

        # Reset teacher back to Active
        teacher_on_leave.status = TeacherStatus.ACTIVE
        session.add(teacher_on_leave)
        session.commit()
