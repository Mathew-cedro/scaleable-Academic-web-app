"""
Google OR-Tools CP-SAT Master Schedule Generator & Dynamic Repair Engine.
Enforces DepEd Order No. 009, s. 2026 (Key Stage 3) & RA 4670 Workload Limits.
"""

import os
import time
from typing import Dict, List, Optional, Tuple
from ortools.sat.python import cp_model
from sqlmodel import Session, select

from app.models import (
    Department,
    ProgramType,
    ScheduleSlot,
    Section,
    Subject,
    Teacher,
    TeacherStatus,
)
from app.schemas import (
    DiffResult,
    GenerateScheduleRequest,
    ReassignTeacherSlotsRequest,
    ScheduleOperationResponse,
    ScheduleSlotRead,
)
from app.services.diff_engine import compute_schedule_diff
from app.services.llm_reporter import generate_llm_compliance_report


def get_rank_score(position: Optional[str]) -> int:
    """Numerical seniority score for Philippine public school faculty."""
    pos = (position or "").lower()
    if "master teacher ii" in pos or "mt-ii" in pos or "master ii" in pos:
        return 5
    if "master teacher i" in pos or "mt-i" in pos or "master i" in pos:
        return 4
    if "special science" in pos or "sst" in pos or "head teacher" in pos:
        return 3
    if "teacher iii" in pos or "t-iii" in pos:
        return 2
    if "teacher ii" in pos or "t-ii" in pos:
        return 1
    return 0


def is_special_track(program_type: Optional[str]) -> bool:
    """Returns True if the curricular program is a specialized track (STE, SPS, SPA, SPJ, etc.)."""
    if not program_type:
        return False
    norm = program_type.strip().upper()
    return norm not in ("BEC", "REGULAR", "STANDARD", "GENERAL")


def generate_master_schedule(
    session: Session,
    config: Optional[GenerateScheduleRequest] = None,
) -> ScheduleOperationResponse:
    """
    Generate complete conflict-free Master Schedule using Google OR-Tools CP-SAT.
    Enforces:
    1. Monday Period 1 Homeroom Guidance lock to Class Adviser.
    2. Dynamic weekly loads (3, 4, 5 loads/week) and durations (30, 40, 50, 60m).
    3. Values Education on Tuesday-Friday.
    4. Single consistent teacher per subject per section.
    5. RA 4670 daily cap (<= 4 to 6 hours/day of classroom teaching).
    6. Max consecutive teaching hours limit (2, 3, or 4h).
    7. Prefer morning academic core (Science, Math, English in Periods 1-4).
    8. Preserves existing locked slots when preserve_locked_slots is enabled.
    9. Soft vs Strict room collision handling.
    10. Balanced workload distribution across department faculty.
    """
    start_time = time.perf_counter()
    if config is None:
        config = GenerateScheduleRequest()

    # Load entities from DB
    teachers = session.exec(select(Teacher)).all()
    all_db_sections = session.exec(select(Section)).all()
    subjects = session.exec(select(Subject)).all()
    departments = session.exec(select(Department)).all()

    # Filter to targeted sections if specified (Grades 7 to 10 selection)
    if config.target_section_ids and len(config.target_section_ids) > 0:
        target_ids_set = set(config.target_section_ids)
        sections = [s for s in all_db_sections if s.id in target_ids_set]
        if not sections:
            sections = all_db_sections
    else:
        sections = all_db_sections

    if not teachers or not sections or not subjects:
        return ScheduleOperationResponse(
            success=False,
            message="Cannot generate schedule: Database missing teachers, sections, or subjects. Please seed data.",
            latency_ms=0.0,
        )

    # Apply custom subject allotments if provided and persist
    if config.subject_allotments:
        updated_any = False
        for sub_id, allot in config.subject_allotments.items():
            sub_obj = session.get(Subject, int(sub_id))
            if sub_obj:
                sub_obj.required_weekly_loads = allot.required_weekly_loads
                sub_obj.duration_minutes = allot.duration_minutes
                session.add(sub_obj)
                updated_any = True
        if updated_any:
            session.commit()
            subjects = session.exec(select(Subject)).all()

    # Active teachers only
    active_teachers = [t for t in teachers if t.status == TeacherStatus.ACTIVE]
    teacher_map = {t.id: t for t in teachers}
    section_map = {s.id: s for s in sections}
    subject_map = {s.id: s for s in subjects}
    dept_map = {d.id: d for d in departments}

    # Department to teacher mapping
    dept_teachers: Dict[int, List[Teacher]] = {}
    for t in active_teachers:
        dept_teachers.setdefault(t.department_id, []).append(t)

    # Check for homeroom guidance subject or custom adviser-locked subject
    locked_subject_ids = set()
    unlocked_subject_ids = set()
    if config.subject_allotments:
        for s_id, allot in config.subject_allotments.items():
            if getattr(allot, "is_adviser_locked", None) is True:
                locked_subject_ids.add(int(s_id))
            elif getattr(allot, "is_adviser_locked", None) is False:
                unlocked_subject_ids.add(int(s_id))

    if locked_subject_ids:
        homeroom_subject = next((s for s in subjects if s.id in locked_subject_ids), None)
    else:
        homeroom_subject = next(
            (
                s for s in subjects
                if s.id not in unlocked_subject_ids
                and ("homeroom" in s.name.lower() or "guidance" in s.name.lower())
            ),
            None,
        )

    # Core academic subjects (excluding separate homeroom if present)
    academic_subjects = [s for s in subjects if s.id != (homeroom_subject.id if homeroom_subject else None)]

    # Time dimensions: Days (0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri), Periods (1 to 9)
    days = [0, 1, 2, 3, 4]
    all_periods = [1, 2, 3, 4, 5, 6, 7, 8, 9]

    # Modular Track Subject Resolver: filters subjects specifically configured for each section's track and grade level
    def get_section_subjects(sec: Section) -> List[Subject]:
        p_type = (sec.program_type or "BEC").upper().strip()
        sec_grade = sec.grade_level

        if config.track_subjects:
            # 1. First check grade-specific keys: e.g. "STE_7", "STE:7", "STE-7", "BEC_7", "REGULAR_7"
            grade_keys = [
                f"{p_type}_{sec_grade}",
                f"{p_type}:{sec_grade}",
                f"{p_type}-{sec_grade}",
            ]
            if p_type in ("BEC", "REGULAR"):
                grade_keys.extend([f"BEC_{sec_grade}", f"REGULAR_{sec_grade}"])

            matched_ids = None
            for gk in grade_keys:
                for k, ids in config.track_subjects.items():
                    if k.upper().strip() == gk:
                        matched_ids = ids
                        break
                if matched_ids:
                    break

            # 2. Fallback to general track key if no grade-specific key
            if not matched_ids:
                general_key = next(
                    (
                        k
                        for k in config.track_subjects
                        if k.upper().strip() == p_type
                        or (p_type == "REGULAR" and k.upper().strip() == "BEC")
                        or (p_type == "BEC" and k.upper().strip() == "REGULAR")
                    ),
                    None,
                )
                if general_key and config.track_subjects[general_key]:
                    matched_ids = config.track_subjects[general_key]

            if matched_ids:
                allowed_ids = set(matched_ids)
                matched = [s for s in academic_subjects if s.id in allowed_ids]
                if matched:
                    return matched

        # If no track subjects matched, match subjects for this section's grade level or core standard subjects
        if p_type in ("BEC", "REGULAR"):
            core_matched = [s for s in academic_subjects if s.id in (1, 2, 3, 4, 5, 6, 7, 8)]
            return core_matched if core_matched else academic_subjects

        grade_matched = [s for s in academic_subjects if s.grade_level == sec_grade or s.id in (1, 2, 3, 4, 5, 6, 7, 8)]
        return grade_matched if grade_matched else academic_subjects

    section_subjects: Dict[int, List[Subject]] = {c.id: get_section_subjects(c) for c in sections}

    # Section total weekly load feasibility pre-check
    # Standard BEC: 34 instructional periods (35 total minus Monday P1 Homeroom).
    # Special curricular tracks (STE, SPS, SPA, SPJ): Can accommodate up to 8 additional hours (Periods 8 & 9, up to 44 instructional periods).
    for c in sections:
        is_special = is_special_track(c.program_type)
        max_allowed = 44 if is_special else 34
        total_sec_loads = sum(
            (subject_map[s.id].required_weekly_loads if s.id in subject_map and subject_map[s.id].required_weekly_loads else 4)
            for s in section_subjects[c.id]
        )
        if total_sec_loads > max_allowed:
            limit_desc = f"{max_allowed} available instructional periods (extended special track up to 9 periods/day)" if is_special else "the 34 available instructional periods in a standard 7-period day"
            return ScheduleOperationResponse(
                success=False,
                message=f"Section '{c.name}' ({c.program_type} Grade {c.grade_level}) has {len(section_subjects[c.id])} learning areas totaling {total_sec_loads} weekly loads, which exceeds {limit_desc}. Please adjust weekly loads in 'Learning Areas & Time Allotments' to total {max_allowed} or fewer.",
                latency_ms=0.0,
            )

    # -------------------------------------------------------------
    # TWO-PHASE DECOMPOSED SOLVER FOR SCALABLE TIMETABLES
    # Phase 1: Balanced Faculty Assignment with Advisory & Grade Affinity
    # Phase 2: Conflict-Free Timetable Slot Placement (OR-Tools CP-SAT)
    # -------------------------------------------------------------

    # =============================================================
    # PHASE 1: Optimal Faculty-to-Section Assignment
    # =============================================================
    p1_model = cp_model.CpModel()
    Y: Dict[Tuple[int, int, int], cp_model.IntVar] = {}

    for c in sections:
        for s in section_subjects[c.id]:
            eligible_teachers = dept_teachers.get(s.department_id, [])
            if not eligible_teachers:
                continue
            for t in eligible_teachers:
                Y[t.id, c.id, s.id] = p1_model.NewBoolVar(f"y_{t.id}_{c.id}_{s.id}")

            # Exactly one teacher assigned per section per subject
            p1_model.Add(sum(Y[t.id, c.id, s.id] for t in eligible_teachers) == 1)

    # Department-level Workload Balancing & Advisory Affinity
    p1_penalties = []
    for d_id, d_t_list in dept_teachers.items():
        if not d_t_list:
            continue
        max_sec = p1_model.NewIntVar(0, len(sections), f"dept_{d_id}_max_sec")
        min_sec = p1_model.NewIntVar(0, len(sections), f"dept_{d_id}_min_sec")

        for t in d_t_list:
            t_assigned_secs = sum(
                Y[t.id, c.id, s.id]
                for c in sections
                for s in section_subjects[c.id]
                if (t.id, c.id, s.id) in Y
            )
            p1_model.Add(t_assigned_secs <= max_sec)
            p1_model.Add(t_assigned_secs >= min_sec)

        p1_penalties.append(200 * (max_sec - min_sec))

    # Preference Incentives:
    # 1. Advisers teaching their own advisory section
    # 2. Grade-level affinity: teachers prefer cohorts in the same grade level as their advisory cohort
    # 3. Faculty rank weighting
    for (t_id, c_id, s_id), y_var in Y.items():
        t = teacher_map.get(t_id)
        c = section_map.get(c_id)
        if t and c:
            if t.is_adviser and t.advisory_section_id == c.id:
                p1_penalties.append(-1000 * y_var)
            elif t.is_adviser and t.advisory_section_id:
                adv_sec = section_map.get(t.advisory_section_id)
                if adv_sec and adv_sec.grade_level == c.grade_level:
                    p1_penalties.append(-50 * y_var)

            rank = get_rank_score(t.position)
            if rank > 0:
                p1_penalties.append(-5 * rank * y_var)

    if p1_penalties:
        p1_model.Minimize(sum(p1_penalties))

    p1_solver = cp_model.CpSolver()
    p1_solver.parameters.max_time_in_seconds = 5.0
    p1_solver.parameters.num_search_workers = max(4, min(8, os.cpu_count() or 4))
    p1_status = p1_solver.Solve(p1_model)

    if p1_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assigned_pairs = [
            (t_id, c_id, s_id)
            for (t_id, c_id, s_id), y_var in Y.items()
            if p1_solver.Value(y_var) == 1
        ]
    else:
        # Fallback deterministic matching
        assigned_pairs = []
        for c in sections:
            for s in section_subjects[c.id]:
                eligible = dept_teachers.get(s.department_id, [])
                if eligible:
                    adv_match = next(
                        (t for t in eligible if t.is_adviser and t.advisory_section_id == c.id),
                        None,
                    )
                    if adv_match:
                        assigned_pairs.append((adv_match.id, c.id, s.id))
                    else:
                        idx = c.id % len(eligible)
                        assigned_pairs.append((eligible[idx].id, c.id, s.id))

    # =============================================================
    # PHASE 2: Conflict-Free Timetable Slot Placement
    # =============================================================
    existing_locked_slots = []
    if config.preserve_locked_slots:
        existing_locked_slots = session.exec(select(ScheduleSlot).where(ScheduleSlot.is_locked == True)).all()

    def build_p2_model(allow_relaxed_consec: bool = False) -> Tuple[cp_model.CpModel, Dict]:
        p2_m = cp_model.CpModel()
        p2_X = {}
        for (t_id, c_id, s_id) in assigned_pairs:
            sec = section_map[c_id]
            sec_periods = all_periods if is_special_track(sec.program_type) else [1, 2, 3, 4, 5, 6, 7]
            for d in days:
                for p in sec_periods:
                    p2_X[t_id, c_id, s_id, d, p] = p2_m.NewBoolVar(f"x_{t_id}_{c_id}_{s_id}_{d}_{p}")

        # Constraint 1: Adviser Homeroom Lock on Monday Period 1 (d=0, p=1)
        for (t_id, c_id, s_id) in assigned_pairs:
            if (t_id, c_id, s_id, 0, 1) in p2_X:
                p2_m.Add(p2_X[t_id, c_id, s_id, 0, 1] == 0)

        # Constraint 2: Subject Weekly Load Quota & Daily Limit (max 1/day, or 2/day if loads > 5)
        for (t_id, c_id, s_id) in assigned_pairs:
            sub = subject_map.get(s_id)
            sec = section_map[c_id]
            sec_periods = all_periods if is_special_track(sec.program_type) else [1, 2, 3, 4, 5, 6, 7]
            req_loads = (sub.required_weekly_loads if sub else 4) or 4
            p2_m.Add(sum(p2_X[t_id, c_id, s_id, d, p] for d in days for p in sec_periods if (t_id, c_id, s_id, d, p) in p2_X) == req_loads)

            max_daily_loads = max(1, (req_loads + 4) // 5)
            for d in days:
                p2_m.Add(sum(p2_X[t_id, c_id, s_id, d, p] for p in sec_periods if (t_id, c_id, s_id, d, p) in p2_X) <= max_daily_loads)

            # Values Education / EsP runs Tuesday to Friday (skip Monday)
            if sub and ("values" in sub.name.lower() or "esp" in sub.name.lower()):
                p2_m.Add(sum(p2_X[t_id, c_id, s_id, 0, p] for p in sec_periods if (t_id, c_id, s_id, 0, p) in p2_X) == 0)

        # Constraint 3: Section Collision Free (at most 1 class at any d, p)
        for c in sections:
            sec_periods = all_periods if is_special_track(c.program_type) else [1, 2, 3, 4, 5, 6, 7]
            for d in days:
                for p in sec_periods:
                    c_slots = [
                        p2_X[t_id, c_id, s_id, d, p]
                        for (t_id, c_id, s_id) in assigned_pairs
                        if c_id == c.id and (t_id, c_id, s_id, d, p) in p2_X
                    ]
                    if c_slots:
                        p2_m.Add(sum(c_slots) <= 1)

        # Constraint 4: Teacher Collision Free (at most 1 class at any d, p across all sections)
        for t in active_teachers:
            for d in days:
                for p in all_periods:
                    t_slots = [
                        p2_X[t_id, c_id, s_id, d, p]
                        for (t_id, c_id, s_id) in assigned_pairs
                        if t_id == t.id and (t_id, c_id, s_id, d, p) in p2_X
                    ]
                    if t_slots:
                        p2_m.Add(sum(t_slots) <= 1)

        # Constraint 5: RA 4670 Daily Cap (<= 4 to 6 hours/day of classroom teaching)
        daily_cap = max(4, min(config.max_daily_hours, 6))
        for t in active_teachers:
            cap = min(t.max_daily_hours or daily_cap, daily_cap)
            for d in days:
                t_daily = [
                    p2_X[t_id, c_id, s_id, d, p]
                    for (t_id, c_id, s_id) in assigned_pairs
                    if t_id == t.id
                    for p in all_periods
                    if (t_id, c_id, s_id, d, p) in p2_X
                ]
                if d == 0 and t.is_adviser and t.advisory_section_id:
                    # Deduct 1 hour for locked Monday Period 1 Homeroom Guidance
                    p2_m.Add(sum(t_daily) <= cap - 1)
                else:
                    p2_m.Add(sum(t_daily) <= cap)

        # Constraint 6: Max Consecutive Teaching Hours Limit
        base_consec = max(2, min(config.max_consecutive_hours, 4))
        max_consec = min(5, base_consec + 1) if allow_relaxed_consec else base_consec
        for t in active_teachers:
            for d in days:
                for p in range(1, 10 - max_consec):
                    window = [
                        p2_X[t_id, c_id, s_id, d, p + i]
                        for i in range(max_consec + 1)
                        for (t_id, c_id, s_id) in assigned_pairs
                        if t_id == t.id and (t_id, c_id, s_id, d, p + i) in p2_X
                    ]
                    if window:
                        p2_m.Add(sum(window) <= max_consec)

        # Constraint 7: Preserve Locked Slots if enabled
        if config.preserve_locked_slots and existing_locked_slots:
            for lk in existing_locked_slots:
                key = (lk.teacher_id, lk.section_id, lk.subject_id, lk.day_of_week, lk.period_index)
                if key in p2_X:
                    p2_m.Add(p2_X[key] == 1)

        # Constraint 8: Physical Room Collision Policy (Strict vs Soft Penalty)
        rooms_to_sections: Dict[str, List[Section]] = {}
        for c in sections:
            r_num = (c.room_number or "").strip().lower()
            if r_num:
                rooms_to_sections.setdefault(r_num, []).append(c)

        room_clash_penalties = []
        if config.room_collision_mode == "STRICT_ISOLATION":
            for r_num, room_secs in rooms_to_sections.items():
                if len(room_secs) > 1:
                    room_sec_ids = {rc.id for rc in room_secs}
                    for d in days:
                        for p in all_periods:
                            r_slots = [
                                p2_X[t_id, c_id, s_id, d, p]
                                for (t_id, c_id, s_id) in assigned_pairs
                                if c_id in room_sec_ids and (t_id, c_id, s_id, d, p) in p2_X
                            ]
                            if len(r_slots) > 1:
                                p2_m.Add(sum(r_slots) <= 1)
        else:  # SOFT_PENALTY
            for r_num, room_secs in rooms_to_sections.items():
                if len(room_secs) > 1:
                    room_sec_ids = {rc.id for rc in room_secs}
                    for d in days:
                        for p in all_periods:
                            r_slots = [
                                p2_X[t_id, c_id, s_id, d, p]
                                for (t_id, c_id, s_id) in assigned_pairs
                                if c_id in room_sec_ids and (t_id, c_id, s_id, d, p) in p2_X
                            ]
                            if len(r_slots) > 1:
                                clash_var = p2_m.NewIntVar(0, len(room_secs), f"clash_{r_num[:6]}_{d}_{p}")
                                p2_m.Add(clash_var >= sum(r_slots) - 1)
                                room_clash_penalties.append(500 * clash_var)

        # Objective: Preferred Placement (Morning Academic Core vs Afternoon Applied/Labs/Specialized)
        placement_penalties = []
        for (t_id, c_id, s_id) in assigned_pairs:
            sub = subject_map.get(s_id)
            if not sub:
                continue

            sec = section_map[c_id]
            sec_periods = all_periods if is_special_track(sec.program_type) else [1, 2, 3, 4, 5, 6, 7]

            allot_cfg = (config.subject_allotments or {}).get(s_id)
            explicit_pref = (
                (allot_cfg.preferred_placement if allot_cfg and allot_cfg.preferred_placement else None)
                or getattr(sub, "preferred_placement", None)
            )

            is_morning_pref = False
            is_afternoon_pref = False

            if explicit_pref:
                pref_up = explicit_pref.upper().strip()
                if "MORNING" in pref_up:
                    is_morning_pref = True
                elif "AFTERNOON" in pref_up:
                    is_afternoon_pref = True
                # "FLEXIBLE" and "MON_P1" do not impose morning/afternoon shifts
            elif config.prefer_morning_academic and not allow_relaxed_consec:
                name_lower = sub.name.lower()
                is_morning_pref = any(k in name_lower for k in ["math", "science", "english", "filipino", "araling", "ap"])
                is_afternoon_pref = any(k in name_lower for k in ["mapeh", "tle", "technology", "livelihood", "pe", "arts", "music", "research"])

            for d in days:
                for p in sec_periods:
                    if (t_id, c_id, s_id, d, p) in p2_X:
                        if is_morning_pref and p >= 5:
                            placement_penalties.append(15 * p2_X[t_id, c_id, s_id, d, p])
                        elif is_afternoon_pref and p <= 4:
                            placement_penalties.append(15 * p2_X[t_id, c_id, s_id, d, p])

        obj_components = list(room_clash_penalties) + list(placement_penalties)
        if obj_components:
            p2_m.Minimize(sum(obj_components))

        return p2_m, p2_X

    # Execute Phase 2 Solver
    solve_timeout = max(10.0, float(config.max_solve_time_seconds or 15.0))
    p2_model, X = build_p2_model(allow_relaxed_consec=False)

    p2_solver = cp_model.CpSolver()
    p2_solver.parameters.max_time_in_seconds = solve_timeout
    p2_solver.parameters.num_search_workers = max(4, min(8, os.cpu_count() or 4))
    status = p2_solver.Solve(p2_model)

    # Fallback relaxation if needed
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        p2_model_fallback, X_fallback = build_p2_model(allow_relaxed_consec=True)
        p2_solver_fallback = cp_model.CpSolver()
        p2_solver_fallback.parameters.max_time_in_seconds = 10.0
        p2_solver_fallback.parameters.num_search_workers = max(4, min(8, os.cpu_count() or 4))
        status_fallback = p2_solver_fallback.Solve(p2_model_fallback)
        if status_fallback in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            status = status_fallback
            p2_solver = p2_solver_fallback
            X = X_fallback

    latency_ms = (time.perf_counter() - start_time) * 1000.0

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return ScheduleOperationResponse(
            success=False,
            message="Solver could not find a feasible schedule satisfying all constraints. Try adjusting timeout or consecutive hour settings.",
            latency_ms=latency_ms,
        )

    # Clear existing schedule slots for target sections (preserving locked slots if configured)
    target_sec_ids = [c.id for c in sections]
    if config.preserve_locked_slots:
        for existing in session.exec(
            select(ScheduleSlot).where(
                ScheduleSlot.section_id.in_(target_sec_ids),
                ScheduleSlot.is_locked == False
            )
        ).all():
            session.delete(existing)
    else:
        for existing in session.exec(
            select(ScheduleSlot).where(ScheduleSlot.section_id.in_(target_sec_ids))
        ).all():
            session.delete(existing)
    session.commit()

    # Create new ScheduleSlot records
    new_slots: List[ScheduleSlot] = []

    # 1. Add locked Homeroom Guidance on Monday Period 1 for each section (if not preserved)
    for c in sections:
        adviser = next((t for t in teachers if t.advisory_section_id == c.id), None)
        adviser_id = adviser.id if (adviser and adviser.status == TeacherStatus.ACTIVE) else None
        if not adviser_id:
            sub_adviser = next(
                (
                    t for t in active_teachers
                    if not any(s.teacher_id == t.id and s.day_of_week == 0 and s.period_index == 1 for s in new_slots)
                ),
                active_teachers[0],
            )
            adviser_id = sub_adviser.id

        existing_hr = next(
            (
                lk for lk in (existing_locked_slots if config.preserve_locked_slots else [])
                if lk.section_id == c.id and lk.day_of_week == 0 and lk.period_index == 1
            ),
            None,
        )

        if existing_hr:
            if adviser_id and existing_hr.teacher_id != adviser_id:
                existing_hr.teacher_id = adviser_id
                session.add(existing_hr)
        else:
            sub_id = homeroom_subject.id if homeroom_subject else academic_subjects[0].id
            hr_slot = ScheduleSlot(
                section_id=c.id,
                subject_id=sub_id,
                teacher_id=adviser_id,
                day_of_week=0,  # Monday
                period_index=1,  # 7:00 AM - 8:00 AM
                is_locked=True,
            )
            session.add(hr_slot)
            new_slots.append(hr_slot)

    # 2. Add solved academic subject slots
    for (t_id, c_id, s_id) in assigned_pairs:
        sec = section_map[c_id]
        sec_periods = all_periods if is_special_track(sec.program_type) else [1, 2, 3, 4, 5, 6, 7]
        for d in days:
            for p in sec_periods:
                if (t_id, c_id, s_id, d, p) in X and p2_solver.Value(X[t_id, c_id, s_id, d, p]) == 1:
                    slot = ScheduleSlot(
                        section_id=c_id,
                        subject_id=s_id,
                        teacher_id=t_id,
                        day_of_week=d,
                        period_index=p,
                        is_locked=False,
                    )
                    session.add(slot)
                    new_slots.append(slot)

    session.commit()

    # Recalculate teacher load hours
    all_current_slots = session.exec(select(ScheduleSlot)).all()
    for t in teachers:
        t_loads = len([s for s in all_current_slots if s.teacher_id == t.id])
        t.current_load_hours = t_loads
        session.add(t)
    session.commit()

    saved_slots = session.exec(select(ScheduleSlot)).all()
    hydrated_slots = hydrate_slots(saved_slots, section_map, subject_map, teacher_map, dept_map)

    return ScheduleOperationResponse(
        success=True,
        message=f"Master schedule generated successfully with {len(saved_slots)} slots in {latency_ms:.1f}ms.",
        latency_ms=latency_ms,
        slots_count=len(saved_slots),
        slots=hydrated_slots,
    )


def repair_schedule(
    session: Session,
    config: Optional[GenerateScheduleRequest] = None,
    strategy: str = "LEAST_LOAD",
    dept_head_teacher_id: Optional[int] = None,
) -> ScheduleOperationResponse:
    """
    Fault-Tolerant Dynamic Schedule Repair.
    Triggered when:
    1. A teacher is marked 'On Leave' or 'Wellness Leave' (DO 002, s. 2026).
    2. A manual override creates a conflict.
    3. New learning areas / subjects are added to tracks and need dynamic scheduling.
    
    Objective:
    - Minimal Disruption Cost (weight 100 on moved classes).
    - Prioritization Strategies:
      - 'LEAST_LOAD': Underloaded Teacher Priority (DO 005, s. 2024).
      - 'HIGHER_RANK': Master Teacher & Seniority Priority.
      - 'SELF_ASSIGN': Department Head direct coverage.
    """
    start_time = time.perf_counter()

    teachers = session.exec(select(Teacher)).all()
    all_db_sections = session.exec(select(Section)).all()
    subjects = session.exec(select(Subject)).all()
    departments = session.exec(select(Department)).all()
    original_slots = session.exec(select(ScheduleSlot)).all()

    if not original_slots:
        # If no slots exist, run master generation
        return generate_master_schedule(session, config)

    # Filter to targeted sections if specified
    if config and config.target_section_ids and len(config.target_section_ids) > 0:
        target_ids_set = set(config.target_section_ids)
        sections = [s for s in all_db_sections if s.id in target_ids_set]
        if not sections:
            sections = all_db_sections
    else:
        sections = all_db_sections

    # Apply custom subject allotments if provided and persist
    if config and config.subject_allotments:
        updated_any = False
        for sub_id, allot in config.subject_allotments.items():
            sub_obj = session.get(Subject, int(sub_id))
            if sub_obj:
                sub_obj.required_weekly_loads = allot.required_weekly_loads
                sub_obj.duration_minutes = allot.duration_minutes
                if allot.preferred_placement:
                    sub_obj.preferred_placement = allot.preferred_placement
                session.add(sub_obj)
                updated_any = True
        if updated_any:
            session.commit()
            subjects = session.exec(select(Subject)).all()

    teacher_map = {t.id: t for t in teachers}
    section_map = {s.id: s for s in sections}
    subject_map = {s.id: s for s in subjects}
    dept_map = {d.id: d for d in departments}

    active_teachers = [t for t in teachers if t.status == TeacherStatus.ACTIVE]
    absent_teachers = [t for t in teachers if t.status != TeacherStatus.ACTIVE]
    absent_teacher_ids = {t.id for t in absent_teachers}

    dept_teachers: Dict[int, List[Teacher]] = {}
    for t in active_teachers:
        dept_teachers.setdefault(t.department_id, []).append(t)

    days = [0, 1, 2, 3, 4]
    all_periods = [1, 2, 3, 4, 5, 6, 7, 8, 9]

    # Filter academic slots vs locked homeroom slots
    locked_slots = [s for s in original_slots if s.is_locked]
    slots_to_repair = [s for s in original_slots if not s.is_locked]

    # Check for homeroom guidance subject
    homeroom_sub = next(
        (s for s in subjects if "homeroom" in s.name.lower() or "guidance" in s.name.lower()),
        None,
    )
    homeroom_id = homeroom_sub.id if homeroom_sub else None
    academic_subjects = [s for s in subjects if s.id != homeroom_id]

    # Resolve required subjects for each section
    def get_repair_section_subjects(sec: Section) -> List[Subject]:
        p_type = (sec.program_type or "BEC").upper().strip()
        sec_grade = sec.grade_level

        if config and config.track_subjects:
            grade_keys = [
                f"{p_type}_{sec_grade}",
                f"{p_type}:{sec_grade}",
                f"{p_type}-{sec_grade}",
            ]
            if p_type in ("BEC", "REGULAR"):
                grade_keys.extend([f"BEC_{sec_grade}", f"REGULAR_{sec_grade}"])

            matched_ids = None
            for gk in grade_keys:
                for k, ids in config.track_subjects.items():
                    if k.upper().strip() == gk:
                        matched_ids = ids
                        break
                if matched_ids:
                    break

            if not matched_ids:
                general_key = next(
                    (
                        k for k in config.track_subjects
                        if k.upper().strip() == p_type
                        or (p_type == "REGULAR" and k.upper().strip() == "BEC")
                        or (p_type == "BEC" and k.upper().strip() == "REGULAR")
                    ),
                    None,
                )
                if general_key and config.track_subjects[general_key]:
                    matched_ids = config.track_subjects[general_key]

            if matched_ids:
                allowed_ids = set(matched_ids)
                matched = [s for s in academic_subjects if s.id in allowed_ids]
                if matched:
                    return matched

        # Fallback when no config track_subjects: preserve existing subjects plus any grade-matched subjects
        existing_sub_ids = {s.subject_id for s in original_slots if s.section_id == sec.id and not s.is_locked}
        if existing_sub_ids:
            return [s for s in academic_subjects if s.id in existing_sub_ids]
        if p_type in ("BEC", "REGULAR"):
            core_matched = [s for s in academic_subjects if s.id in (1, 2, 3, 4, 5, 6, 7, 8)]
            return core_matched if core_matched else academic_subjects
        return [s for s in academic_subjects if s.grade_level == sec_grade or s.id in (1, 2, 3, 4, 5, 6, 7, 8)]

    section_subjects: Dict[int, List[Subject]] = {c.id: get_repair_section_subjects(c) for c in sections}

    # Map sections and subjects present in original schedule
    orig_pair_counts: Dict[Tuple[int, int], int] = {}
    for s in slots_to_repair:
        orig_pair_counts[(s.section_id, s.subject_id)] = orig_pair_counts.get((s.section_id, s.subject_id), 0) + 1

    # Map required counts from section subjects and allotments
    req_counts: Dict[Tuple[int, int], int] = {}
    for c in sections:
        for s in section_subjects[c.id]:
            if config and config.subject_allotments and s.id in config.subject_allotments:
                loads = config.subject_allotments[s.id].required_weekly_loads
            else:
                loads = s.required_weekly_loads or 4
            req_counts[(c.id, s.id)] = loads

    # Check total weekly load feasibility per section
    for c in sections:
        is_special = is_special_track(c.program_type)
        max_allowed = 44 if is_special else 34
        total_sec_loads = sum(req_counts.get((c.id, s.id), 4) for s in section_subjects[c.id])
        if total_sec_loads > max_allowed:
            limit_desc = f"{max_allowed} available instructional periods (extended special track up to 9 periods/day)" if is_special else "the 34 available instructional periods in a 5-day week"
            return ScheduleOperationResponse(
                success=False,
                message=(
                    f"Section '{c.name}' ({c.program_type} Grade {c.grade_level}) has {len(section_subjects[c.id])} "
                    f"learning areas totaling {total_sec_loads} weekly loads, which exceeds {limit_desc}. Please adjust subject weekly loads to fit within {max_allowed} periods."
                ),
                latency_ms=(time.perf_counter() - start_time) * 1000.0,
            )

    # Identify sections and departments that have changes
    changed_sections = set()
    changed_departments = set()
    for (c_id, s_id), needed in req_counts.items():
        if orig_pair_counts.get((c_id, s_id), 0) != needed:
            changed_sections.add(c_id)
            sub = subject_map.get(s_id)
            if sub:
                changed_departments.add(sub.department_id)

    for (c_id, s_id), orig_cnt in orig_pair_counts.items():
        if (c_id, s_id) not in req_counts:
            changed_sections.add(c_id)
            sub = subject_map.get(s_id)
            if sub:
                changed_departments.add(sub.department_id)

    affected_dept_ids = {t.department_id for t in absent_teachers} | changed_departments

    model = cp_model.CpModel()

    # Decision variables for repair
    X = {}
    for (c_id, s_id), count in req_counts.items():
        sub = subject_map.get(s_id)
        if not sub:
            continue
        c = section_map.get(c_id)
        sec_periods = all_periods if is_special_track(c.program_type if c else None) else [1, 2, 3, 4, 5, 6, 7]
        eligible = dept_teachers.get(sub.department_id, [])
        for t in eligible:
            for d in days:
                for p in sec_periods:
                    X[t.id, c_id, s_id, d, p] = model.NewBoolVar(f"rx_{t.id}_{c_id}_{s_id}_{d}_{p}")

    # Objective penalties:
    # 1. Disruption penalty (100 points for any moved slot)
    # 2. Prioritization policy penalty
    # 3. Preferred placement penalty
    disruption_penalties = []
    prioritization_penalties = []
    placement_penalties = []

    # Map original active assignments
    for orig in slots_to_repair:
        key = (orig.teacher_id, orig.section_id, orig.subject_id, orig.day_of_week, orig.period_index)
        if orig.teacher_id in absent_teacher_ids:
            # Teacher is absent: cannot teach this slot
            if key in X:
                model.Add(X[key] == 0)
        elif orig.section_id not in changed_sections and (orig.subject_id and subject_map.get(orig.subject_id) and subject_map[orig.subject_id].department_id not in affected_dept_ids):
            # Unaffected departments strictly pinned to eliminate combinatorial explosion
            if key in X:
                model.Add(X[key] == 1)
        else:
            # Affected department or changed section: soft disruption penalty (weight 100 on moved classes)
            if key in X:
                keep_var = X[key]
                moved = model.NewBoolVar(f"moved_{orig.id}")
                model.Add(moved + keep_var == 1)
                disruption_penalties.append(100 * moved)

    # Class Load Prioritization policy weighting
    for (t_id, c_id, s_id, d, p), var in X.items():
        teacher = teacher_map.get(t_id)
        if teacher:
            if strategy == "HIGHER_RANK":
                rank_score = get_rank_score(teacher.position)
                # Lower penalty for higher rank (Master Teachers get 0-25, Teacher I gets 125)
                cost = (5 - rank_score) * 25
                prioritization_penalties.append(cost * var)
            elif strategy == "SELF_ASSIGN" and dept_head_teacher_id:
                if t_id == dept_head_teacher_id:
                    # Negative penalty = strong reward for assigning Dept Head
                    prioritization_penalties.append(-500 * var)
                else:
                    prioritization_penalties.append(200 * var)
            else:  # "LEAST_LOAD" (default per DO 005, s. 2024)
                load_factor = teacher.current_load_hours * 10
                prioritization_penalties.append(load_factor * var)

    # Preferred placement weighting
    for (t_id, c_id, s_id, d, p), var in X.items():
        sub = subject_map.get(s_id)
        if not sub:
            continue
        pref = (sub.preferred_placement or "").upper().strip()
        if pref == "MORNING" and p >= 5:
            placement_penalties.append(50 * var)
        elif pref == "AFTERNOON" and p <= 4:
            placement_penalties.append(50 * var)

    # Collision constraint: Physical Room Minimization
    repair_rooms_to_sections: Dict[str, List[Section]] = {}
    for c in sections:
        r_num = (c.room_number or "").strip().lower()
        if r_num:
            repair_rooms_to_sections.setdefault(r_num, []).append(c)

    repair_room_clash_penalties = []
    for r_num, room_secs in repair_rooms_to_sections.items():
        if len(room_secs) > 1:
            for d in days:
                for p in all_periods:
                    room_slots_at_time = [
                        X[t.id, c.id, s.id, d, p]
                        for c in room_secs
                        for s in subjects
                        for t in dept_teachers.get(s.department_id, [])
                        if (t.id, c.id, s.id, d, p) in X
                    ]
                    if len(room_slots_at_time) > 1:
                        clash_var = model.NewIntVar(0, len(room_secs), f"r_clash_{r_num[:6]}_{d}_{p}")
                        model.Add(clash_var >= sum(room_slots_at_time) - 1)
                        repair_room_clash_penalties.append(500 * clash_var)

    model.Minimize(
        sum(disruption_penalties)
        + sum(prioritization_penalties)
        + sum(repair_room_clash_penalties)
        + sum(placement_penalties)
    )

    # Constraint: Preserve locked slots (e.g. Monday Homeroom)
    for lk in locked_slots:
        for (t_id, c_id, s_id, d, p), var in X.items():
            if c_id == lk.section_id and d == lk.day_of_week and p == lk.period_index:
                model.Add(var == 0)
            if t_id == lk.teacher_id and d == lk.day_of_week and p == lk.period_index:
                model.Add(var == 0)

    # Constraint: Maintain subject quotas for each section
    for (c_id, s_id), count in req_counts.items():
        sub = subject_map.get(s_id)
        if not sub:
            continue
        c = section_map.get(c_id)
        sec_periods = all_periods if is_special_track(c.program_type if c else None) else [1, 2, 3, 4, 5, 6, 7]
        eligible = dept_teachers.get(sub.department_id, [])
        all_slots = [
            X[t.id, c_id, s_id, d, p]
            for t in eligible
            for d in days
            for p in sec_periods
            if (t.id, c_id, s_id, d, p) in X
        ]
        model.Add(sum(all_slots) == count)

        # Max 1 load per subject per day, or 2 if count > 5
        max_daily_for_sub = max(1, (count + 4) // 5)
        for d in days:
            daily_slots = [
                X[t.id, c_id, s_id, d, p]
                for t in eligible
                for p in sec_periods
                if (t.id, c_id, s_id, d, p) in X
            ]
            model.Add(sum(daily_slots) <= max_daily_for_sub)

        # Single consistent teacher per subject per section
        if len(eligible) > 1:
            y_vars = []
            for t in eligible:
                y = model.NewBoolVar(f"ry_{t.id}_{c_id}_{s_id}")
                y_vars.append(y)
                all_t_slots = [
                    X[t.id, c_id, s_id, d, p]
                    for d in days
                    for p in sec_periods
                    if (t.id, c_id, s_id, d, p) in X
                ]
                if all_t_slots:
                    model.Add(sum(all_t_slots) <= count * y)
            model.Add(sum(y_vars) == 1)

    # Collision constraints: Section & Teacher
    for c in sections:
        sec_periods = all_periods if is_special_track(c.program_type) else [1, 2, 3, 4, 5, 6, 7]
        for d in days:
            for p in sec_periods:
                sec_slots = [
                    X[t.id, c.id, s.id, d, p]
                    for s in subjects
                    for t in dept_teachers.get(s.department_id, [])
                    if (t.id, c.id, s.id, d, p) in X
                ]
                if sec_slots:
                    model.Add(sum(sec_slots) <= 1)

    for t in active_teachers:
        cap = min(t.max_daily_hours or 6, 6)
        for d in days:
            t_daily_slots = []
            for p in all_periods:
                t_slots_at_time = [
                    X[t.id, c.id, s.id, d, p]
                    for c in sections
                    for s in subjects
                    if (t.id, c.id, s.id, d, p) in X
                ]
                if t_slots_at_time:
                    model.Add(sum(t_slots_at_time) <= 1)
                    t_daily_slots.extend(t_slots_at_time)

            # Account for Monday Homeroom lock if adviser
            if d == 0 and t.is_adviser:
                model.Add(sum(t_daily_slots) + 1 <= cap)
            else:
                model.Add(sum(t_daily_slots) <= cap)

    # Solve repair model
    solver = cp_model.CpSolver()
    solve_timeout = float(config.max_solve_time_seconds) if config and config.max_solve_time_seconds else 15.0
    solver.parameters.max_time_in_seconds = solve_timeout
    solver.parameters.num_search_workers = max(4, min(8, os.cpu_count() or 4))
    status = solver.Solve(model)

    latency_ms = (time.perf_counter() - start_time) * 1000.0

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return ScheduleOperationResponse(
            success=False,
            message="Dynamic repair could not find a feasible schedule configuration. Please check faculty availability and total section loads.",
            latency_ms=latency_ms,
        )

    # Build new schedule slots list
    repaired_slots: List[ScheduleSlot] = []

    # Preserve locked slots as fresh instances, reassigning to active teacher if adviser is on leave
    for lk in locked_slots:
        assigned_t_id = lk.teacher_id
        if assigned_t_id in absent_teacher_ids:
            # Adviser is on leave: pick an active teacher who isn't already assigned at this time
            sub_teacher = next(
                (
                    t for t in active_teachers
                    if not any(
                        s.teacher_id == t.id and s.day_of_week == lk.day_of_week and s.period_index == lk.period_index
                        for s in locked_slots
                    )
                ),
                active_teachers[0],
            )
            assigned_t_id = sub_teacher.id

        repaired_slots.append(
            ScheduleSlot(
                section_id=lk.section_id,
                subject_id=lk.subject_id,
                teacher_id=assigned_t_id,
                day_of_week=lk.day_of_week,
                period_index=lk.period_index,
                is_locked=True,
            )
        )

    # Extract solved slots
    for (t_id, c_id, s_id, d, p), var in X.items():
        if solver.Value(var) == 1:
            slot = ScheduleSlot(
                section_id=c_id,
                subject_id=s_id,
                teacher_id=t_id,
                day_of_week=d,
                period_index=p,
                is_locked=False,
            )
            repaired_slots.append(slot)

    # Compute Schedule Diff and Disruption Cost
    diff_result = compute_schedule_diff(
        original_slots=original_slots,
        repaired_slots=repaired_slots,
        teachers_map=teacher_map,
        sections_map=section_map,
        subjects_map=subject_map,
    )

    # Delete all previous slots in session
    for existing in session.exec(select(ScheduleSlot)).all():
        session.delete(existing)
    session.commit()

    # Insert fresh repaired slots
    for s in repaired_slots:
        session.add(s)
    session.commit()

    # Recalculate teacher load hours
    for t in teachers:
        t_loads = len([s for s in repaired_slots if s.teacher_id == t.id])
        t.current_load_hours = t_loads
        session.add(t)
    session.commit()

    # Re-query saved slots to get IDs
    saved_slots = session.exec(select(ScheduleSlot)).all()
    hydrated_slots = hydrate_slots(saved_slots, section_map, subject_map, teacher_map, dept_map)

    # Generate LLM Compliance and Repair report
    report = generate_llm_compliance_report(
        teachers=teachers,
        sections=sections,
        diff_result=diff_result,
        absent_teachers=absent_teachers,
        latency_ms=latency_ms,
    )
    import asyncio
    try:
        report_text = asyncio.run(report) if asyncio.iscoroutine(report) else report
    except Exception:
        report_text = str(report)

    return ScheduleOperationResponse(
        success=True,
        message=f"Schedule successfully repaired. Disruption Cost: {diff_result.disruption_cost} ({diff_result.reassigned_count} substitutes reassigned).",
        latency_ms=latency_ms,
        disruption_cost=diff_result.disruption_cost,
        diff=diff_result,
        llm_report=report_text,
        slots_count=len(saved_slots),
        slots=hydrated_slots,
    )


def reassign_teacher_slots(
    session: Session,
    payload: ReassignTeacherSlotsRequest,
) -> ScheduleOperationResponse:
    """
    Class Load Prioritization & Substitution Dispatcher.
    Handles targeted reassignment for absent teachers:
    1. If manual_assignments list is provided: commits exact per-class manual assignments.
    2. Otherwise: dynamically repairs schedule using chosen policy ('LEAST_LOAD', 'HIGHER_RANK', 'SELF_ASSIGN').
    """
    start_time = time.perf_counter()
    teachers = session.exec(select(Teacher)).all()
    sections = session.exec(select(Section)).all()
    subjects = session.exec(select(Subject)).all()
    departments = session.exec(select(Department)).all()

    teacher_map = {t.id: t for t in teachers}
    section_map = {s.id: s for s in sections}
    subject_map = {s.id: s for s in subjects}
    dept_map = {d.id: d for d in departments}

    absent_teacher = session.get(Teacher, payload.absent_teacher_id)
    if not absent_teacher:
        return ScheduleOperationResponse(
            success=False,
            message=f"Teacher ID {payload.absent_teacher_id} not found.",
            latency_ms=0.0,
        )

    # 1. Manual per-slot / per-class assignment mode
    if payload.manual_assignments and len(payload.manual_assignments) > 0:
        original_slots = session.exec(select(ScheduleSlot)).all()
        slots_by_id = {s.id: s for s in original_slots}
        reassigned_count = 0

        for item in payload.manual_assignments:
            slot = slots_by_id.get(item.slot_id)
            if not slot:
                continue
            sub_teacher = teacher_map.get(item.substitute_teacher_id)
            if not sub_teacher:
                continue
            slot.teacher_id = item.substitute_teacher_id
            session.add(slot)
            reassigned_count += 1

        session.commit()

        # Recalculate teacher load hours
        all_slots = session.exec(select(ScheduleSlot)).all()
        for t in teachers:
            t.current_load_hours = len([s for s in all_slots if s.teacher_id == t.id])
            session.add(t)
        session.commit()

        # Compute diff
        diff_result = compute_schedule_diff(
            original_slots=original_slots,
            repaired_slots=all_slots,
            teachers_map=teacher_map,
            sections_map=section_map,
            subjects_map=subject_map,
        )

        saved_slots = session.exec(select(ScheduleSlot)).all()
        hydrated_slots = hydrate_slots(saved_slots, section_map, subject_map, teacher_map, dept_map)
        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return ScheduleOperationResponse(
            success=True,
            message=f"Successfully reassigned {reassigned_count} class loads with custom configuration.",
            latency_ms=latency_ms,
            disruption_cost=diff_result.disruption_cost,
            diff=diff_result,
            slots_count=len(saved_slots),
            slots=hydrated_slots,
        )

    # 2. Automated Policy Mode (Least Load, Higher Rank, or Self-Assign)
    if absent_teacher.status == TeacherStatus.ACTIVE:
        absent_teacher.status = TeacherStatus.ON_LEAVE
        session.add(absent_teacher)
        session.commit()

    return repair_schedule(
        session=session,
        strategy=payload.strategy,
        dept_head_teacher_id=payload.dept_head_teacher_id,
    )


def hydrate_slots(
    slots: List[ScheduleSlot],
    sections_map: Dict[int, Section],
    subjects_map: Dict[int, Subject],
    teachers_map: Dict[int, Teacher],
    departments_map: Dict[int, Department],
) -> List[ScheduleSlotRead]:
    """Hydrate raw ScheduleSlot records with names for frontend display."""
    hydrated = []
    for s in slots:
        sec = sections_map.get(s.section_id)
        sub = subjects_map.get(s.subject_id)
        tch = teachers_map.get(s.teacher_id)
        dept = departments_map.get(tch.department_id) if tch else None

        hydrated.append(
            ScheduleSlotRead(
                id=s.id or 0,
                section_id=s.section_id,
                subject_id=s.subject_id,
                teacher_id=s.teacher_id,
                day_of_week=s.day_of_week,
                period_index=s.period_index,
                is_locked=s.is_locked,
                section_name=sec.name if sec else f"Section {s.section_id}",
                subject_name=sub.name if sub else f"Subject {s.subject_id}",
                teacher_name=tch.name if tch else f"Teacher {s.teacher_id}",
                department_name=dept.name if dept else "General",
                room_number=sec.room_number if sec else "TBA",
            )
        )
    return hydrated
