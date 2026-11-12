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

# SQLite requires check_same_thread=False for FastAPI concurrent requests and timeout=30 to prevent lock contention
connect_args = {"check_same_thread": False, "timeout": 30} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args=connect_args
)


def init_db() -> None:
    """Create database tables based on SQLModel metadata."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency yielding database session."""
    with Session(engine) as session:
        yield session
