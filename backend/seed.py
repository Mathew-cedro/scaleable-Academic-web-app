"""
Seed Script for Junior High School (Key Stage 3) Academic Scheduler.
Populates:
- 8 DepEd Core Academic Departments
- 64 Faculty Members (8 per Department, with 48 designated Class Advisers)
- 48 Student Cohort Sections:
  * 4 BEC sections per grade level (Grades 7, 8, 9, 10 = 16 sections)
  * 2 sections per special program (STE, SPS, SPA, SPJ) for each grade level (32 sections)
- 9 Core Curriculum Subjects
"""

from sqlmodel import Session, select
from app.database import engine, init_db
from app.models import Department, Section, Subject, Teacher, TeacherStatus

TEACHERS_BY_DEPT = {
    "SCI": [
        ("Dr. Aris Thorne", "Master Teacher I"),
        ("Mr. David Chen", "Teacher III"),
        ("Ms. Camille Santos", "Teacher II"),
        ("Mr. Raymond Cruz", "Teacher II"),
        ("Mrs. Janet Mendoza", "Teacher III"),
        ("Ms. Angela Delos Reyes", "Teacher I"),
        ("Dr. Victorio Ramos", "Master Teacher II"),
        ("Mr. Mark Villanueva", "Teacher I"),
    ],
    "MATH": [
        ("Mrs. Elena Rostova", "Master Teacher II"),
        ("Mr. Gabriel Torres", "Teacher III"),
        ("Ms. Janelle Cruz", "Teacher II"),
        ("Mr. Arthur Panganiban", "Teacher II"),
        ("Mrs. Liza De Jesus", "Teacher III"),
        ("Mr. Kevin Alcantara", "Teacher I"),
        ("Mrs. Jocelyn Soriano", "Master Teacher I"),
        ("Ms. Patricia Tan", "Teacher I"),
    ],
    "ENG": [
        ("Mr. Jonathan Hayes", "Teacher III"),
        ("Ms. Bianca Reyes", "Teacher II"),
        ("Mrs. Sarah Alcantara", "Teacher I"),
        ("Mr. Christian Dizon", "Teacher II"),
        ("Ms. Maria Theresa Ramos", "Teacher III"),
        ("Mr. Paolo Guinto", "Teacher I"),
        ("Mrs. Rowena Fernandez", "Master Teacher II"),
        ("Bb. Katrina Mercado", "Teacher I"),
    ],
    "FIL": [
        ("G. Danilo Ramos", "Master Teacher I"),
        ("Gng. Maricel Mendoza", "Teacher II"),
        ("Bb. Kristine Joy Diaz", "Teacher I"),
        ("G. Ronald Macaraig", "Teacher II"),
        ("Gng. Lualhati Bautista", "Teacher III"),
        ("Bb. Cherrylyn Manalo", "Teacher I"),
        ("G. Ferdinand Tolentino", "Master Teacher II"),
        ("G. Bernardo Carandang", "Teacher I"),
    ],
    "AP": [
        ("Ms. Sofia Alcantara", "Master Teacher I"),
        ("Mr. Ramon Bautista", "Teacher II"),
        ("Mrs. Clarissa Lim", "Teacher I"),
        ("Mr. Joel Salcedo", "Teacher II"),
        ("Ms. Hazel Navarro", "Teacher III"),
        ("Mr. Dennis Cordero", "Teacher I"),
        ("Dr. Antonio Mabanta", "Master Teacher II"),
        ("Mrs. Irene Castaneda", "Teacher I"),
    ],
    "TLE": [
        ("Mr. Lucas Rivera", "Master Teacher I"),
        ("Mrs. Glenda Soriano", "Teacher II"),
        ("Mr. Kenneth Aquino", "Teacher I"),
        ("Mrs. Rosemarie Beltran", "Teacher II"),
        ("Mr. Noel Magpantay", "Teacher III"),
        ("Ms. Diane Pascual", "Teacher I"),
        ("Mr. Edgardo Valencia", "Master Teacher II"),
        ("Mrs. Milagros Santos", "Teacher I"),
    ],
    "MAPEH": [
        ("Coach Marcus Vance", "Teacher III"),
        ("Ms. Patricia Mercado", "Teacher II"),
        ("Mr. Joseph Garcia", "Teacher I"),
        ("Coach Allan Del Rosario", "Teacher II"),
        ("Ms. Joanna Belleza", "Teacher III"),
        ("Mr. Rodolfo Quizon", "Teacher I"),
        ("Coach Nestor Ibarra", "Master Teacher I"),
        ("Ms. Rochelle Estacio", "Teacher I"),
    ],
    "ESP": [
        ("Mme. Claire Delacroix", "Master Teacher I"),
        ("Bro. Francis Ocampo", "Teacher II"),
        ("Mrs. Theresa Navarro", "Teacher I"),
        ("Mr. Michael Angelo Cruz", "Teacher II"),
        ("Ms. Maria Cecilia Perez", "Teacher III"),
        ("Bro. Anthony Morales", "Teacher I"),
        ("Mrs. Corazon Aquino-Cruz", "Master Teacher II"),
        ("Mr. Gabriel San Jose", "Teacher I"),
    ],
}

SECTIONS_CONFIG = [
    # Grade 7 (4 BEC, 2 STE, 2 SPS, 2 SPA, 2 SPJ)
    (7, "Grade 7 - Rizal", "BEC", "Room 701"),
    (7, "Grade 7 - Bonifacio", "BEC", "Room 702"),
    (7, "Grade 7 - Mabini", "BEC", "Room 703"),
    (7, "Grade 7 - Luna", "BEC", "Room 704"),
    (7, "Grade 7 - STE Newton", "STE", "Room 705"),
    (7, "Grade 7 - STE Galileo", "STE", "Room 706"),
    (7, "Grade 7 - SPS Agila", "SPS", "Room 707"),
    (7, "Grade 7 - SPS Tamaraw", "SPS", "Room 708"),
    (7, "Grade 7 - SPA Amorsolo", "SPA", "Room 709"),
    (7, "Grade 7 - SPA Hidalgo", "SPA", "Room 710"),
    (7, "Grade 7 - SPJ Chronicle", "SPJ", "Room 711"),
    (7, "Grade 7 - SPJ Courier", "SPJ", "Room 712"),

    # Grade 8 (4 BEC, 2 STE, 2 SPS, 2 SPA, 2 SPJ)
    (8, "Grade 8 - Silang", "BEC", "Room 801"),
    (8, "Grade 8 - Del Pilar", "BEC", "Room 802"),
    (8, "Grade 8 - Jacinto", "BEC", "Room 803"),
    (8, "Grade 8 - Aguinaldo", "BEC", "Room 804"),
    (8, "Grade 8 - STE Darwin", "STE", "Room 805"),
    (8, "Grade 8 - STE Curie", "STE", "Room 806"),
    (8, "Grade 8 - SPS Alab", "SPS", "Room 807"),
    (8, "Grade 8 - SPS Siglakas", "SPS", "Room 808"),
    (8, "Grade 8 - SPA Luna", "SPA", "Room 809"),
    (8, "Grade 8 - SPA San Pedro", "SPA", "Room 810"),
    (8, "Grade 8 - SPJ Tribune", "SPJ", "Room 811"),
    (8, "Grade 8 - SPJ Gazette", "SPJ", "Room 812"),

    # Grade 9 (4 BEC, 2 STE, 2 SPS, 2 SPA, 2 SPJ)
    (9, "Grade 9 - Quezon", "BEC", "Room 901"),
    (9, "Grade 9 - Magsaysay", "BEC", "Room 902"),
    (9, "Grade 9 - Osmeña", "BEC", "Room 903"),
    (9, "Grade 9 - Roxas", "BEC", "Room 904"),
    (9, "Grade 9 - STE Tesla", "STE", "Room 905"),
    (9, "Grade 9 - STE Archimedes", "STE", "Room 906"),
    (9, "Grade 9 - SPS Haribon", "SPS", "Room 907"),
    (9, "Grade 9 - SPS Sinag", "SPS", "Room 908"),
    (9, "Grade 9 - SPA Francisco", "SPA", "Room 909"),
    (9, "Grade 9 - SPA Ocampo", "SPA", "Room 910"),
    (9, "Grade 9 - SPJ Herald", "SPJ", "Room 911"),
    (9, "Grade 9 - SPJ Sentinel", "SPJ", "Room 912"),

    # Grade 10 (4 BEC, 2 STE, 2 SPS, 2 SPA, 2 SPJ)
    (10, "Grade 10 - Laurel", "BEC", "Room 1001"),
    (10, "Grade 10 - Quirino", "BEC", "Room 1002"),
    (10, "Grade 10 - Garcia", "BEC", "Room 1003"),
    (10, "Grade 10 - Macapagal", "BEC", "Room 1004"),
    (10, "Grade 10 - STE Einstein", "STE", "Room 1005"),
    (10, "Grade 10 - STE Hawking", "STE", "Room 1006"),
    (10, "Grade 10 - SPS Bagani", "SPS", "Room 1007"),
    (10, "Grade 10 - SPS Lakas", "SPS", "Room 1008"),
    (10, "Grade 10 - SPA Joya", "SPA", "Room 1009"),
    (10, "Grade 10 - SPA Legaspi", "SPA", "Room 1010"),
    (10, "Grade 10 - SPJ Inquirer", "SPJ", "Room 1011"),
    (10, "Grade 10 - SPJ Vanguard", "SPJ", "Room 1012"),
]


DEPARTMENTS_DATA = [
    {"name": "Science", "code": "SCI"},
    {"name": "Mathematics", "code": "MATH"},
    {"name": "English", "code": "ENG"},
    {"name": "Filipino", "code": "FIL"},
    {"name": "Araling Panlipunan (AP)", "code": "AP"},
    {"name": "EPP / TLE", "code": "TLE"},
    {"name": "MAPEH", "code": "MAPEH"},
    {"name": "Values Education (EsP)", "code": "ESP"},
]

SUBJECTS_DATA = [
    {"name": "Science", "code": "SCI", "loads": 4},
    {"name": "Mathematics", "code": "MATH", "loads": 4},
    {"name": "English", "code": "ENG", "loads": 4},
    {"name": "Filipino", "code": "FIL", "loads": 4},
    {"name": "Araling Panlipunan (AP)", "code": "AP", "loads": 4},
    {"name": "Technology & Livelihood Education (TLE)", "code": "TLE", "loads": 4},
    {"name": "Music, Arts, PE, Health (MAPEH)", "code": "MAPEH", "loads": 4},
    {"name": "Values Education (EsP)", "code": "ESP", "loads": 4},
    {"name": "Homeroom Guidance Program", "code": "ESP", "loads": 1},
]


def seed_database():
    init_db()
    with Session(engine) as session:
        # 1. Departments
        existing_dept = session.exec(select(Department)).first()
        if not existing_dept:
            print("Seeding 8 DepEd Core Academic Departments...")
            for d in DEPARTMENTS_DATA:
                session.add(Department(name=d["name"], code=d["code"]))
            session.commit()

        depts = session.exec(select(Department)).all()
        dept_by_code = {d.code: d.id for d in depts}

        # 2. Subjects
        existing_subject = session.exec(select(Subject)).first()
        if not existing_subject:
            print("Seeding DepEd Core Curriculum Subjects...")
            for s in SUBJECTS_DATA:
                session.add(
                    Subject(
                        name=s["name"],
                        department_id=dept_by_code[s["code"]],
                        grade_level=8,
                        required_weekly_loads=s["loads"],
                    )
                )
            session.commit()

        # 3. Sections
        existing_sections = session.exec(select(Section)).all()
        if not existing_sections:
            print(f"Seeding {len(SECTIONS_CONFIG)} Sections...")
            for g, name, ptype, room in SECTIONS_CONFIG:
                session.add(
                    Section(
                        name=name,
                        grade_level=g,
                        program_type=ptype,
                        room_number=room,
                    )
                )
            session.commit()

        sections = session.exec(select(Section)).all()

        # 4. Teachers
        existing_teachers = session.exec(select(Teacher)).all()
        if not existing_teachers:
            print("Seeding 64 Faculty Members (8 per department)...")
            adviser_idx = 0
            for code, t_list in TEACHERS_BY_DEPT.items():
                dept_id = dept_by_code[code]
                for i, (name, pos) in enumerate(t_list):
                    seed_clean = "".join(c for c in name if c.isalnum())
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
                            avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={seed_clean}",
                        )
                    )
            session.commit()

        print("Database seeding completed successfully!")


if __name__ == "__main__":
    seed_database()
