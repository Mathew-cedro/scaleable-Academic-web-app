/**
 * API Client for FastAPI Academic Scheduler Backend.
 * Base URL defaults to http://127.0.0.1:8000.
 */

const API_BASE = "http://127.0.0.1:8000/api";

export interface UserProfile {
  username: string;
  name: string;
  role: "PRINCIPAL" | "DEPARTMENT_HEAD";
  department_id?: number | null;
  department_name?: string | null;
  department_code?: string | null;
  position: string;
  badge: string;
  avatar_url?: string | null;
  email?: string | null;
  phone?: string | null;
  office_location?: string | null;
}

export interface MasterScheduleData {
  slots: any[];
  sections: any[];
  teachers: any[];
  subjects: any[];
  departments: any[];
}

export interface OperationResponse {
  success: boolean;
  message: string;
  latency_ms: number;
  disruption_cost: number;
  diff?: {
    disruption_cost: number;
    displaced_count: number;
    reassigned_count: number;
    unaffected_count: number;
    diff_items: Array<{
      action: string;
      slot_id: number;
      section_name: string;
      subject_name: string;
      day_of_week: number;
      period_index: number;
      original_teacher_name?: string;
      new_teacher_name?: string;
      reason: string;
    }>;
  };
  report?: string;
  llm_report?: string;
  slots_count: number;
  slots: any[];
}

export interface SubjectAllotmentConfig {
  duration_minutes: number;
  required_weekly_loads: number;
  is_adviser_locked?: boolean;
  preferred_placement?: string;
}

export interface GenerateScheduleRequest {
  period_duration_minutes?: number;
  subject_allotments?: Record<number, SubjectAllotmentConfig>;
  track_subjects?: Record<string, number[]>;
  target_section_ids?: number[];
  objective_strategy?: "WORKLOAD_BALANCE" | "COMPACT_SCHEDULE" | "HYBRID";
  prefer_morning_academic?: boolean;
  max_daily_hours?: number;
  max_consecutive_hours?: number;
  room_collision_mode?: "SOFT_PENALTY" | "STRICT_ISOLATION";
  preserve_locked_slots?: boolean;
  max_solve_time_seconds?: number;
}

export interface CurriculumTrack {
  id: string;
  code: string;
  name: string;
  description: string;
  badge_color: string;
  subject_ids: number[];
}

export interface SlotReassignmentItem {
  slot_id: number;
  substitute_teacher_id: number;
  section_id?: number;
  subject_id?: number;
  day_of_week?: number;
  period_index?: number;
}

export interface ReassignTeacherSlotsRequest {
  absent_teacher_id: number;
  strategy: "LEAST_LOAD" | "HIGHER_RANK" | "SELF_ASSIGN" | "MANUAL";
  dept_head_teacher_id?: number | null;
  manual_assignments?: SlotReassignmentItem[];
}

export interface SavedScheduleItem {
  id: number;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  period_duration_minutes: number;
  slots_count: number;
  is_active: boolean;
  config_json?: string | null;
}

export interface SavedScheduleDetail extends SavedScheduleItem {
  slots_json: string;
}

export interface CreateSavedSchedulePayload {
  name: string;
  description?: string;
  period_duration_minutes?: number;
  config_json?: string;
}

export interface UpdateSavedSchedulePayload {
  name?: string;
  description?: string;
  period_duration_minutes?: number;
  config_json?: string;
}

export interface DepartmentDeploySummary {
  department_id: number;
  department_name: string;
  department_code: string;
  faculty_count: number;
  slots_count: number;
  weekly_hours: number;
}

export interface ScheduleDeployRequest {
  department_ids?: number[];
  academic_year?: string;
  semester?: string;
  memo?: string;
  deployed_by?: string;
  notify_faculty?: boolean;
}

export interface ScheduleDeploymentRecord {
  id: number;
  academic_year: string;
  semester: string;
  deployed_by: string;
  memo?: string | null;
  target_departments_json: string;
  target_department_ids: number[];
  status: string;
  slots_count: number;
  created_at: string;
}

export interface ScheduleDeployResponse {
  success: boolean;
  message: string;
  deployment: ScheduleDeploymentRecord;
  department_summaries: DepartmentDeploySummary[];
}

export interface CSForm6PreviewSlot {
  slot_id: number;
  day_of_week: number;
  day_name: string;
  period_index: number;
  time_window: string;
  section_id: number;
  section_name: string;
  subject_id: number;
  subject_name: string;
  room_number: string;
}

export interface CSForm6RecommendedSub {
  teacher_id: number;
  teacher_name: string;
  position: string;
  department_name: string;
  current_load_hours: number;
  max_weekly_hours: number;
  rank_score: number;
  is_available: boolean;
  reason: string;
}

export interface CSForm6PreviewResponse {
  teacher_id: number;
  teacher_name: string;
  position: string;
  department_id: number;
  department_name: string;
  start_date: string;
  end_date: string;
  impacted_slots_count: number;
  impacted_hours: number;
  slots: CSForm6PreviewSlot[];
  recommended_substitutes: CSForm6RecommendedSub[];
}

export interface LeaveApplicationCreate {
  teacher_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  number_of_days?: number;
  reason_details?: string;
  commutation_requested?: boolean;
  auto_dispatch_substitutes?: boolean;
  manual_substitute_id?: number | null;
}

export interface LeaveApplicationRecord {
  id: number;
  control_number: string;
  teacher_id: number;
  teacher_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  number_of_days: number;
  reason_details?: string | null;
  commutation_requested: boolean;
  status: string;
  impacted_slots_count: number;
  substitute_summary?: string | null;
  created_at: string;
}

export function formatErrorDetail(detail: any, fallback: string = "Request failed"): string {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((d: any) => {
        if (!d) return "";
        if (typeof d === "string") return d;
        if (typeof d === "object") {
          const loc = Array.isArray(d.loc)
            ? d.loc.filter((x: any) => x !== "body").join(" -> ")
            : "";
          const msg = d.msg || d.message || JSON.stringify(d);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(d);
      })
      .filter(Boolean);
    return messages.length > 0 ? messages.join("; ") : fallback;
  }
  if (typeof detail === "object") {
    if (detail.message && typeof detail.message === "string") return detail.message;
    if (detail.msg && typeof detail.msg === "string") return detail.msg;
    if (detail.detail) return formatErrorDetail(detail.detail, fallback);
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }
  return String(detail);
}

export async function parseErrorMessage(res: Response, defaultMsg: string): Promise<string> {
  try {
    const data = await res.json();
    return formatErrorDetail(data?.detail || data?.message || data?.error, defaultMsg);
  } catch {
    return `${defaultMsg} (HTTP ${res.status})`;
  }
}

export const api = {
  async listSavedSchedules(): Promise<SavedScheduleItem[]> {
    const res = await fetch(`${API_BASE}/schedule/saved`);
    if (!res.ok) throw new Error("Failed to fetch saved schedules");
    return res.json();
  },

  async createSavedSchedule(payload: CreateSavedSchedulePayload): Promise<SavedScheduleItem> {
    const res = await fetch(`${API_BASE}/schedule/saved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to save schedule snapshot"));
    }
    return res.json();
  },

  async getSavedSchedule(id: number): Promise<SavedScheduleDetail> {
    const res = await fetch(`${API_BASE}/schedule/saved/${id}`);
    if (!res.ok) throw new Error("Failed to fetch saved schedule detail");
    return res.json();
  },

  async updateSavedSchedule(id: number, payload: UpdateSavedSchedulePayload): Promise<SavedScheduleItem> {
    const res = await fetch(`${API_BASE}/schedule/saved/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to update saved schedule"));
    }
    return res.json();
  },

  async deleteSavedSchedule(id: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/schedule/saved/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to delete saved schedule"));
    }
    return res.json();
  },

  async restoreSavedSchedule(id: number): Promise<OperationResponse> {
    const res = await fetch(`${API_BASE}/schedule/saved/${id}/restore`, {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to restore saved schedule"));
    }
    return res.json();
  },
  async getMasterSchedule(): Promise<MasterScheduleData> {
    const res = await fetch(`${API_BASE}/schedule/master`);
    if (!res.ok) throw new Error("Failed to fetch master schedule");
    return res.json();
  },

  async generateSchedule(config?: GenerateScheduleRequest): Promise<OperationResponse> {
    const res = await fetch(`${API_BASE}/schedule/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: config ? JSON.stringify(config) : undefined,
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to generate schedule"));
    }
    return res.json();
  },

  async reassignTeacherSlots(payload: ReassignTeacherSlotsRequest): Promise<OperationResponse> {
    const res = await fetch(`${API_BASE}/schedule/reassign-teacher-slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to reassign teacher slots"));
    }
    return res.json();
  },

  async repairSchedule(config?: GenerateScheduleRequest): Promise<OperationResponse> {
    const res = await fetch(`${API_BASE}/schedule/repair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: config ? JSON.stringify(config) : undefined,
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to execute schedule repair"));
    }
    return res.json();
  },

  async manualOverrideSlot(payload: {
    slot_id: number;
    new_teacher_id?: number;
    new_subject_id?: number;
    new_day_of_week?: number;
    new_period_index?: number;
  }): Promise<OperationResponse> {
    const res = await fetch(`${API_BASE}/schedule/manual-override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to override slot"));
    }
    return res.json();
  },

  async assignOrUpdateSlot(payload: {
    slot_id?: number;
    section_id: number;
    subject_id: number;
    teacher_id: number;
    day_of_week: number;
    period_index: number;
    allow_room_override?: boolean;
  }): Promise<OperationResponse> {
    const res = await fetch(`${API_BASE}/schedule/slot/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to assign schedule slot"));
    }
    return res.json();
  },

  async unassignSlot(slotId: number): Promise<OperationResponse> {
    const res = await fetch(`${API_BASE}/schedule/slot/${slotId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to unassign schedule slot"));
    }
    return res.json();
  },

  async swapSlots(slotIdA: number, slotIdB: number): Promise<OperationResponse> {
    const res = await fetch(`${API_BASE}/schedule/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot_id_a: slotIdA, slot_id_b: slotIdB }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to swap slots"));
    }
    return res.json();
    return res.json();
  },

  async getDepartments(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/departments`);
    if (!res.ok) throw new Error("Failed to fetch departments");
    return res.json();
  },

  async getTeachers(deptId?: number, status?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (deptId !== undefined) params.append("department_id", deptId.toString());
    if (status) params.append("status", status);
    const res = await fetch(`${API_BASE}/teachers?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch teachers");
    return res.json();
  },

  async createTeacher(data: any): Promise<any> {
    const cleanPayload = {
      name: String(data.name || "").trim(),
      department_id: Number(data.department_id) || 1,
      position: String(data.position || "Teacher I"),
      max_daily_hours: Number(data.max_daily_hours) || 6,
      max_weekly_hours: Number(data.max_weekly_hours) || 30,
      is_adviser: Boolean(data.is_adviser),
      advisory_section_id:
        data.advisory_section_id !== null && data.advisory_section_id !== undefined
          ? Number(data.advisory_section_id)
          : null,
      status: String(data.status || "Active"),
      avatar_url: data.avatar_url ? String(data.avatar_url) : null,
    };
    const res = await fetch(`${API_BASE}/teachers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanPayload),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to create teacher"));
    }
    return res.json();
  },

  async updateTeacher(teacherId: number, data: any): Promise<any> {
    const cleanPayload: Record<string, any> = {};
    if (data.name !== undefined) cleanPayload.name = String(data.name).trim();
    if (data.department_id !== undefined) cleanPayload.department_id = Number(data.department_id);
    if (data.position !== undefined) cleanPayload.position = String(data.position);
    if (data.max_daily_hours !== undefined) cleanPayload.max_daily_hours = Number(data.max_daily_hours);
    if (data.max_weekly_hours !== undefined) cleanPayload.max_weekly_hours = Number(data.max_weekly_hours);
    if (data.is_adviser !== undefined) cleanPayload.is_adviser = Boolean(data.is_adviser);
    if (data.advisory_section_id !== undefined) {
      cleanPayload.advisory_section_id =
        data.advisory_section_id !== null ? Number(data.advisory_section_id) : null;
    }
    if (data.status !== undefined) cleanPayload.status = String(data.status);
    if (data.avatar_url !== undefined) {
      cleanPayload.avatar_url = data.avatar_url ? String(data.avatar_url) : null;
    }

    const res = await fetch(`${API_BASE}/teachers/${teacherId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanPayload),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to update teacher"));
    }
    return res.json();
  },

  async deleteTeacher(teacherId: number): Promise<{ success: boolean; message: string; removed_slots_count: number }> {
    const res = await fetch(`${API_BASE}/teachers/${teacherId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to delete teacher"));
    }
    return res.json();
  },

  async createSection(data: {
    name: string;
    grade_level: number;
    program_type?: string;
    room_number: string;
    adviser_id?: number | null;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to create section"));
    }
    return res.json();
  },

  async createSectionsBatch(sections: Array<{
    name: string;
    grade_level: number;
    program_type?: string;
    room_number: string;
    adviser_id?: number | null;
  }>): Promise<any[]> {
    const res = await fetch(`${API_BASE}/sections/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to create sections in batch"));
    }
    return res.json();
  },

  async updateSection(
    sectionId: number,
    data: {
      name?: string;
      grade_level?: number;
      program_type?: string;
      room_number?: string;
      adviser_id?: number | null;
    }
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/sections/${sectionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to update section"));
    }
    return res.json();
  },

  async deleteSection(
    sectionId: number
  ): Promise<{ success: boolean; message: string; removed_slots_count: number }> {
    const res = await fetch(`${API_BASE}/sections/${sectionId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to delete section"));
    }
    return res.json();
  },

  async getComplianceReport(): Promise<{ report: string }> {
    const res = await fetch(`${API_BASE}/schedule/report`);
    if (!res.ok) throw new Error("Failed to fetch compliance report");
    return res.json();
  },

  async updateUserProfile(
    username: string,
    data: {
      name?: string;
      position?: string;
      badge?: string;
      avatar_url?: string | null;
      email?: string | null;
      phone?: string | null;
      office_location?: string | null;
    }
  ): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/auth/profile/${encodeURIComponent(username)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update user profile");
    return res.json();
  },

  async login(
    username: string,
    password: string,
    remember_me: boolean = false
  ): Promise<{ success: boolean; token: string; user: UserProfile; expires_in: number }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, remember_me }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Authentication failed"));
    }
    return res.json();
  },

  async verifyToken(
    token: string
  ): Promise<{ success: boolean; token: string; user: UserProfile; expires_in: number }> {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Session expired or invalid"));
    }
    return res.json();
  },

  async getAccounts(): Promise<UserProfile[]> {
    const res = await fetch(`${API_BASE}/auth/accounts`);
    if (!res.ok) throw new Error("Failed to fetch department accounts");
    return res.json();
  },

  async createSubject(data: {
    name: string;
    department_id: number;
    grade_level?: number;
    required_weekly_loads?: number;
    duration_minutes?: number;
    preferred_placement?: string;
    program_type?: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/subjects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to create subject"));
    }
    return res.json();
  },

  async updateSubject(id: number, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/subjects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to update subject"));
    }
    return res.json();
  },

  async deleteSubject(id: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/subjects/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to delete subject"));
    }
    return res.json();
  },

  async deploySchedule(payload: ScheduleDeployRequest): Promise<ScheduleDeployResponse> {
    const res = await fetch(`${API_BASE}/schedule/deploy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to deploy schedule"));
    }
    return res.json();
  },

  async getLatestDeployment(): Promise<ScheduleDeploymentRecord | null> {
    const res = await fetch(`${API_BASE}/schedule/deployments/latest`);
    if (!res.ok) throw new Error("Failed to fetch latest deployment");
    return res.json();
  },

  async listDeployments(): Promise<ScheduleDeploymentRecord[]> {
    const res = await fetch(`${API_BASE}/schedule/deployments`);
    if (!res.ok) throw new Error("Failed to fetch deployments");
    return res.json();
  },

  async downloadSectionDocx(
    sectionId: number,
    params?: {
      school_year?: string;
      flag_ceremony_time?: string;
      morning_break_time?: string;
      lunch_break_time?: string;
      adviser_name?: string;
      grade_chairman?: string;
      consultant_1?: string;
      consultant_2?: string;
      principal_name?: string;
    }
  ): Promise<void> {
    const query = new URLSearchParams();
    if (params?.school_year) query.set("school_year", params.school_year);
    if (params?.flag_ceremony_time) query.set("flag_ceremony_time", params.flag_ceremony_time);
    if (params?.morning_break_time) query.set("morning_break_time", params.morning_break_time);
    if (params?.lunch_break_time) query.set("lunch_break_time", params.lunch_break_time);
    if (params?.adviser_name) query.set("adviser_name", params.adviser_name);
    if (params?.grade_chairman) query.set("grade_chairman", params.grade_chairman);
    if (params?.consultant_1) query.set("consultant_1", params.consultant_1);
    if (params?.consultant_2) query.set("consultant_2", params.consultant_2);
    if (params?.principal_name) query.set("principal_name", params.principal_name);

    const url = `${API_BASE}/schedule/export/docx/${sectionId}?${query.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to download class program document"));
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", `Class_Program_${sectionId}.docx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  async downloadSectionsTemplateExcel(): Promise<void> {
    const url = `${API_BASE}/sections/template-excel`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to download section template"));
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", "DepEd_Section_Roster_Template.xlsx");
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  async downloadSectionScheduleTemplateExcel(sectionId: number, sectionName: string = "Section"): Promise<void> {
    const url = `${API_BASE}/sections/${sectionId}/schedule-template-excel`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to download section schedule template"));
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    const safeName = sectionName.replace(/[^a-zA-Z0-9_\-]/g, "_");
    link.setAttribute("download", `Schedule_Template_${safeName}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  async previewSectionScheduleExcel(sectionId: number, file: File): Promise<{
    success: boolean;
    section_id: number;
    section_name: string;
    layout_detected: "GRID_MATRIX" | "TABULAR_LIST";
    slots: Array<{
      day_of_week: number;
      day_name: string;
      period_index: number;
      time_str: string;
      raw_subject: string;
      subject_id: number | null;
      subject_name: string;
      raw_teacher?: string | null;
      teacher_id: number | null;
      teacher_name: string;
      is_locked: boolean;
      status: "VALID" | "CONFLICT" | "WARNING" | "UNMATCHED_SUBJECT" | "UNMATCHED_TEACHER";
      message: string;
    }>;
    stats: {
      total_slots: number;
      valid_count: number;
      conflict_count: number;
      warning_count: number;
    };
    can_import: boolean;
  }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/sections/${sectionId}/preview-schedule-excel`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to preview section schedule"));
    }
    return res.json();
  },

  async importSectionScheduleExcel(
    sectionId: number,
    slots: Array<{
      day_of_week: number;
      period_index: number;
      subject_id: number;
      teacher_id: number;
      is_locked?: boolean;
    }>
  ): Promise<{
    success: boolean;
    section_id: number;
    section_name: string;
    slots_imported: number;
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/sections/${sectionId}/import-schedule-excel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to import section schedule"));
    }
    return res.json();
  },

  async previewSectionsExcel(file: File): Promise<{
    success: boolean;
    filename: string;
    detected_columns: Record<string, string | null>;
    rows: Array<{
      row_index: number;
      section_id?: number | null;
      name: string;
      grade_level: number;
      program_type: string;
      room_number: string;
      raw_adviser?: string | null;
      adviser_id?: number | null;
      adviser_name?: string | null;
      adviser_matched: boolean;
      status: "NEW" | "UPDATING" | "DUPLICATE_IN_FILE";
      status_message: string;
    }>;
    stats: {
      total: number;
      valid: number;
      new: number;
      updating: number;
      advisers_matched: number;
    };
  }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/sections/preview-excel`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to parse section spreadsheet"));
    }
    return res.json();
  },

  async importSectionsExcel(
    sections: Array<{
      name: string;
      grade_level: number;
      program_type: string;
      room_number: string;
      adviser_id?: number | null;
    }>,
    updateExisting: boolean = true
  ): Promise<{
    success: boolean;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    total_processed: number;
  }> {
    const res = await fetch(`${API_BASE}/sections/import-excel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections, update_existing: updateExisting }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to import sections"));
    }
    return res.json();
  },

  async exportSF7Excel(): Promise<Blob> {
    const res = await fetch(`${API_BASE}/schedule/export/sf7`);
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to export DepEd SF-7"));
    }
    return res.blob();
  },

  async getCSForm6Preview(
    teacherId: number,
    startDate: string,
    endDate: string
  ): Promise<CSForm6PreviewResponse> {
    const res = await fetch(
      `${API_BASE}/schedule/leave-filing/preview/${teacherId}?start_date=${encodeURIComponent(
        startDate
      )}&end_date=${encodeURIComponent(endDate)}`
    );
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to preview leave impact"));
    }
    return res.json();
  },

  async fileCSForm6Leave(
    payload: LeaveApplicationCreate
  ): Promise<LeaveApplicationRecord> {
    const res = await fetch(`${API_BASE}/schedule/leave-filing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to submit CS Form 6 application"));
    }
    return res.json();
  },

  async getLeaveApplications(): Promise<LeaveApplicationRecord[]> {
    const res = await fetch(`${API_BASE}/schedule/leave-applications`);
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to fetch leave applications"));
    }
    return res.json();
  },
};

export const apiClient = api;

