"""
FastAPI Entry Point for Academic Scheduling Web Application.
Enforces DepEd Key Stage 3 Rules, OR-Tools CP-SAT Master Solving, and Dynamic Repair.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from local backend .env file if present
_env_path = Path(__file__).resolve().parent.parent / '.env'
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from app.database import engine, init_db
from app.models import Department
from app.routers import auth, departments, schedule, import_export
from seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and seed baseline data if empty on startup."""
    init_db()
    with Session(engine) as session:
        has_data = session.exec(select(Department)).first()
        if not has_data:
            seed_database()
    yield


app = FastAPI(
    title="DepEd Key Stage 3 Academic Scheduler API",
    description="Scalable Academic Scheduling with OR-Tools CP-SAT, Fault-Tolerant Dynamic Repair, Biometric DTR Attendance, and Excel Ingestion.",
    version="2.1.0",
    lifespan=lifespan,
)

# Configure CORS for local development with React Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(departments.router)
app.include_router(schedule.router)
app.include_router(import_export.router)


@app.get("/")
def root():
    return {
        "system": "Scalable Academic Scheduling Web Application",
        "standard": "DepEd Order No. 009, s. 2026 (Key Stage 3) & RA 4670",
        "solver": "Google OR-Tools CP-SAT",
        "features": [
            "Biometric DTR Attendance Sync",
            "Excel & CSV Master Schedule Importer",
            "New Hire Conflict Intelligence",
            "Zero-Effort Teacher Pocket Portal"
        ],
        "status": "online",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
