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
      const err = await res.json();
      throw new Error(err.detail || "Failed to save schedule snapshot");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to update saved schedule");
    }
    return res.json();
  },

  async deleteSavedSchedule(id: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/schedule/saved/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to delete saved schedule");
    }
    return res.json();
  },

  async restoreSavedSchedule(id: number): Promise<OperationResponse> {
    const res = await fetch(`${API_BASE}/schedule/saved/${id}/restore`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to restore saved schedule");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to generate schedule");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to reassign teacher slots");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to execute schedule repair");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to override slot");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to assign schedule slot");
    }
    return res.json();
  },

  async unassignSlot(slotId: number): Promise<OperationResponse> {
    const res = await fetch(`${API_BASE}/schedule/slot/${slotId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to unassign schedule slot");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to swap slots");
    }
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to create teacher");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to update teacher");
    }
    return res.json();
  },

  async deleteTeacher(teacherId: number): Promise<{ success: boolean; message: string; removed_slots_count: number }> {
    const res = await fetch(`${API_BASE}/teachers/${teacherId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to delete teacher");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to create section");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to create sections in batch");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to update section");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to delete section");
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

  async generateAIReport(
    reportType: string = "EXECUTIVE_BRIEFING",
    customPrompt?: string,
    departmentId?: number | null,
    requesterName?: string,
    requesterTitle?: string
  ): Promise<{ report: string; report_type: string; timestamp: string; ai_source?: string; ai_model?: string }> {
    try {
      const res = await fetch(`${API_BASE}/schedule/ai-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: reportType,
          custom_prompt: customPrompt,
          department_id: departmentId ?? undefined,
          requester_name: requesterName,
          requester_title: requesterTitle,
        }),
      });
      if (!res.ok) throw new Error("Backend AI report endpoint failed");
      return res.json();
    } catch {
      const fallback = await this.getComplianceReport();
      return {
        report: fallback.report,
        report_type: reportType,
        timestamp: new Date().toLocaleTimeString(),
      };
    }
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
      const err = await res.json();
      throw new Error(err.detail || "Authentication failed");
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
      const err = await res.json();
      throw new Error(err.detail || "Session expired or invalid");
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
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/subjects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create subject");
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
      const err = await res.json();
      throw new Error(err.detail || "Failed to update subject");
    }
    return res.json();
  },

  async deleteSubject(id: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/subjects/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to delete subject");
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
      const err = await res.json().catch(() => ({ detail: "Failed to deploy schedule" }));
      throw new Error(err.detail || "Failed to deploy schedule");
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

  // Excel Master Schedule Import
  async downloadScheduleTemplate(): Promise<Blob> {
    const res = await fetch(`${API_BASE}/import/template/schedule`);
    if (!res.ok) throw new Error("Failed to download schedule template");
    return res.blob();
  },

  async previewScheduleExcel(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/import/schedule/preview`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Preview failed" }));
      throw new Error(err.detail || "Failed to preview schedule");
    }
    return res.json();
  },

  async commitScheduleExcel(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/import/schedule/commit`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Import failed" }));
      throw new Error(err.detail || "Failed to commit schedule");
    }
    return res.json();
  },

  // Biometric DTR Attendance Sync
  async downloadDtrTemplate(): Promise<Blob> {
    const res = await fetch(`${API_BASE}/biometrics/template/dtr`);
    if (!res.ok) throw new Error("Failed to download DTR template");
    return res.blob();
  },

  async processBiometrics(file: File, cutoffTime: string = "07:45", dayOfWeek?: number): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    const params = new URLSearchParams({ cutoff_time: cutoffTime });
    if (dayOfWeek !== undefined) params.append("day_of_week", dayOfWeek.toString());
    const res = await fetch(`${API_BASE}/biometrics/process?${params.toString()}`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Biometric processing failed" }));
      throw new Error(err.detail || "Failed to process biometric scan");
    }
    return res.json();
  },

  async applyBiometricSubstitutions(payload: { date: string; recommendations: any[] }): Promise<any> {
    const res = await fetch(`${API_BASE}/biometrics/apply-substitutions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to apply substitutions" }));
      throw new Error(err.detail || "Failed to apply substitutions");
    }
    return res.json();
  },

  // New Hire Conflict Audit
  async auditNewHire(payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/teachers/audit-new-hire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Audit failed" }));
      throw new Error(err.detail || "Failed to audit new hire");
    }
    return res.json();
  },

  // Teacher Pocket Portal
  async getTeacherPocketSchedule(teacherId: number, dayOverride?: number): Promise<any> {
    const url = dayOverride !== undefined
      ? `${API_BASE}/teacher-pocket/${teacherId}?day_override=${dayOverride}`
      : `${API_BASE}/teacher-pocket/${teacherId}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to fetch pocket schedule" }));
      throw new Error(err.detail || "Failed to fetch teacher pocket schedule");
    }
    return res.json();
  },
};
