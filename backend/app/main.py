"""
FastAPI Entry Point for Academic Scheduling Web Application.
Enforces DepEd Key Stage 3 Rules, OR-Tools CP-SAT Master Solving, and Dynamic Repair.
"""

from contextlib import asynccontextmanager
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session, select

logger = logging.getLogger("uvicorn.error")

from app.database import engine, init_db
from app.models import Department
from app.routers import auth, departments, schedule
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
    description="Scalable Academic Scheduling with OR-Tools CP-SAT, Fault-Tolerant Dynamic Repair, and DepEd Workload Compliance Reporting.",
    version="2.0.0",
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


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    logger.error(f"[422 Validation Error] {request.method} {request.url.path}: {errors}")
    msg_parts = []
    for err in errors:
        loc = " -> ".join(str(l) for l in err.get("loc", []) if l != "body")
        msg = err.get("msg", "Invalid value")
        msg_parts.append(f"{loc}: {msg}" if loc else msg)
    summary = "Validation error: " + "; ".join(msg_parts)
    return JSONResponse(
        status_code=422,
        content={"detail": summary, "errors": errors},
    )

# Register routers
app.include_router(auth.router)
app.include_router(departments.router)
app.include_router(schedule.router)


@app.get("/")
def root():
    return {
        "system": "Scalable Academic Scheduling Web Application",
        "standard": "DepEd Order No. 009, s. 2026 (Key Stage 3) & RA 4670",
        "solver": "Google OR-Tools CP-SAT",
        "status": "online",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
