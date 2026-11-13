"""
Database migration: Add program_type column to subject table and backfill specialized track subjects.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "scheduler.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if program_type column exists
    cursor.execute("PRAGMA table_info(subject)")
    columns = [col[1] for col in cursor.fetchall()]

    if "program_type" not in columns:
        print("Adding 'program_type' column to 'subject' table...")
        cursor.execute("ALTER TABLE subject ADD COLUMN program_type VARCHAR DEFAULT 'ALL'")
        conn.commit()
        print("Column added successfully.")
    else:
        print("'program_type' column already exists.")

    # Backfill existing specialized subjects
    track_updates = {
        1: ("ALL", "MORNING"),
        2: ("ALL", "MORNING"),
        3: ("ALL", "MORNING"),
        4: ("ALL", "MORNING"),
        5: ("ALL", "AFTERNOON"),
        6: ("ALL", "AFTERNOON"),
        7: ("ALL", "AFTERNOON"),
        8: ("ALL", "AFTERNOON"),
        9: ("ALL", "MON_P1_LOCK"),
        10: ("STE", "SPECIALIZED"),
        11: ("SPS", "SPECIALIZED"),
        12: ("SPJ", "SPECIALIZED"),
        13: ("STE", "SPECIALIZED"),
        14: ("SPA", "SPECIALIZED"),
        15: ("SPA", "SPECIALIZED"),
        16: ("STE", "SPECIALIZED"),
        17: ("SPJ", "SPECIALIZED"),
    }

    for sub_id, (ptype, placement) in track_updates.items():
        cursor.execute(
            "UPDATE subject SET program_type = ?, preferred_placement = ? WHERE id = ?",
            (ptype, placement, sub_id)
        )

    # Set any other null/empty program_type to 'ALL'
    cursor.execute("UPDATE subject SET program_type = 'ALL' WHERE program_type IS NULL OR program_type = ''")
    conn.commit()

    # Print summary
    cursor.execute("SELECT id, name, grade_level, program_type, preferred_placement FROM subject ORDER BY id")
    rows = cursor.fetchall()
    print("\nUpdated Subjects in Database:")
    for r in rows:
        print(f"  ID {r[0]}: {r[1]} (Grade {r[2]}, Track: {r[3]}, Placement: {r[4]})")

    conn.close()

if __name__ == "__main__":
    migrate()
