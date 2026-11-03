"""
Database configuration and session management for FastAPI.
Defaults to local SQLite 'sqlite:///./scheduler.db' with support for PostgreSQL.
"""

import os
from pathlib import Path
from typing import Generator
from sqlmodel import Session, SQLModel, create_engine

# Resolve path for local sqlite file relative to backend root
DEFAULT_DB_FILE = Path(__file__).resolve().parent.parent / "scheduler.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_FILE}")

# SQLite requires check_same_thread=False for FastAPI concurrent requests
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args=connect_args
)


def init_db() -> None:
    """Create database tables based on SQLModel metadata and apply safe column migrations."""
    SQLModel.metadata.create_all(engine)
    if str(DATABASE_URL).startswith("sqlite"):
        _migrate_sqlite_schema()


def _migrate_sqlite_schema() -> None:
    """Safely add newly introduced columns to existing SQLite tables if missing."""
    try:
        with engine.connect() as conn:
            result = conn.exec_driver_sql("PRAGMA table_info(scheduleslot);")
            existing_cols = {row[1] for row in result.fetchall()}
            if existing_cols:
                if "is_substituted" not in existing_cols:
                    conn.exec_driver_sql("ALTER TABLE scheduleslot ADD COLUMN is_substituted BOOLEAN DEFAULT 0;")
                if "original_teacher_id" not in existing_cols:
                    conn.exec_driver_sql("ALTER TABLE scheduleslot ADD COLUMN original_teacher_id INTEGER DEFAULT NULL;")
                if "substitution_reason" not in existing_cols:
                    conn.exec_driver_sql("ALTER TABLE scheduleslot ADD COLUMN substitution_reason VARCHAR DEFAULT NULL;")
                conn.commit()
    except Exception as e:
        print(f"[DB Migration Warning] Could not migrate SQLite schema: {e}")


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency yielding database session."""
    with Session(engine) as session:
        yield session
