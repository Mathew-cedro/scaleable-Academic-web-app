from app.models import Teacher, Section, TeacherStatus
from app.services.compliance_reporter import generate_compliance_report


def test_compliance_reporter_deterministic():
    teachers = [
        Teacher(id=1, name="Juan Dela Cruz", department_id=1, position="Master Teacher I", current_load_hours=22, status=TeacherStatus.ACTIVE),
        Teacher(id=2, name="Maria Santos", department_id=1, position="Teacher III", current_load_hours=18, status=TeacherStatus.ACTIVE),
        Teacher(id=3, name="Pedro Penduko", department_id=1, position="Teacher I", current_load_hours=26, status=TeacherStatus.ACTIVE),
    ]
    sections = [
        Section(id=1, name="Grade 7 - Diamond", grade_level=7),
    ]

    report = generate_compliance_report(
        teachers=teachers,
        sections=sections,
        diff_result=None,
        absent_teachers=[],
        latency_ms=12.5,
    )

    assert "REPUBLIC OF THE PHILIPPINES" in report
    assert "POLANGUI GENERAL COMPREHENSIVE HIGH SCHOOL" in report
    assert "STATUTORY WORKLOAD COMPLIANCE" in report
    assert "Optimal Load (20-25 hrs): 1 faculty members" in report
    assert "Underloaded (<20 hrs):    1 faculty members" in report
    assert "Heavy/Maxed (>25 hrs):    1 faculty members" in report
    assert "DR. MARY ANNE M. SAHAGUN" in report
