import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Clock,
  Lock,
  Layers,
  ChevronDown,
  Edit3,
  Plus,
  Trash2,
  BookOpen,
  User,
  Check,
} from "lucide-react";
import { api } from "../api/client";

interface SectionOption {
  id: number;
  name: string;
  grade_level?: number;
  gradeLevel?: number;
  program_type?: string;
  room_number?: string;
}

interface ParsedSlotItem {
  day_of_week: number;
  day_name: string;
  period_index: number;
  time_str: string;
  raw_subject: string;
  subject_id: number | null;
  subject_name: string;
  department_id?: number | null;
  raw_teacher?: string | null;
  teacher_id: number | null;
  teacher_name: string;
  eligible_teachers?: Array<{
    id: number;
    name: string;
    current_load: number;
    is_adviser?: boolean;
  }>;
  is_locked: boolean;
  status: "VALID" | "CONFLICT" | "WARNING" | "UNMATCHED_SUBJECT" | "UNMATCHED_TEACHER";
  message: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
  sections: SectionOption[];
  initialSectionId?: number;
  teachers?: any[];
}

const DAYS_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const PERIOD_TIME_LABELS: Record<number, string> = {
  1: "7:00 AM – 8:00 AM",
  2: "8:00 AM – 9:00 AM",
  3: "9:20 AM – 10:20 AM",
  4: "10:20 AM – 11:20 AM",
  5: "12:00 PM – 1:00 PM",
  6: "1:00 PM – 2:00 PM",
  7: "2:00 PM – 3:00 PM",
  8: "3:00 PM – 4:00 PM",
  9: "4:00 PM – 5:00 PM",
};

export const ImportSectionScheduleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImportComplete,
  sections,
  initialSectionId,
  teachers: initialTeachers,
}) => {
  const [localSections, setLocalSections] = useState<SectionOption[]>(sections);
  const [selectedSectionId, setSelectedSectionId] = useState<number>(() => {
    if (initialSectionId) return initialSectionId;
    return sections.length > 0 ? sections[0].id : 1;
  });

  const [sectionOption, setSectionOption] = useState<"EXISTING" | "NEW">("EXISTING");
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionGrade, setNewSectionGrade] = useState<number>(7);
  const [newSectionTrack, setNewSectionTrack] = useState<string>("BEC");
  const [newSectionRoom, setNewSectionRoom] = useState<string>("");
  const [newSectionAdviserId, setNewSectionAdviserId] = useState<number | "">("");
  const [creatingSection, setCreatingSection] = useState(false);

  // References and metadata
  const [curriculumSubjects, setCurriculumSubjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allTeachers, setAllTeachers] = useState<any[]>(initialTeachers || []);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [previewSlots, setPreviewSlots] = useState<ParsedSlotItem[]>([]);
  const [layoutDetected, setLayoutDetected] = useState<string>("");
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");

  const [stats, setStats] = useState<{
    total_slots: number;
    valid_count: number;
    conflict_count: number;
    warning_count: number;
  }>({ total_slots: 0, valid_count: 0, conflict_count: 0, warning_count: 0 });

  const [statusFilter, setStatusFilter] = useState<"ALL" | "CONFLICT" | "WARNING" | "VALID">("ALL");
  const [viewMode, setViewMode] = useState<"GRID" | "LIST">("GRID");
  const [importing, setImporting] = useState(false);

  // Interactive Slot Editor State
  const [editingSlot, setEditingSlot] = useState<{
    isNew: boolean;
    day_of_week: number;
    period_index: number;
    raw_subject: string;
    subject_id: number | null;
    subject_name: string;
    teacher_id: number | null;
    teacher_name: string;
    department_id: number | null;
    applySubjectToAll: boolean;
    applyTeacherToAll: boolean;
  } | null>(null);

  // Quick Create Subject State
  const [quickCreateSubject, setQuickCreateSubject] = useState<{
    isOpen: boolean;
    name: string;
    department_id: number;
    grade_level: number;
    required_weekly_loads: number;
    program_type: string;
    applyToAll: boolean;
    saving: boolean;
  }>({
    isOpen: false,
    name: "",
    department_id: 1,
    grade_level: 7,
    required_weekly_loads: 4,
    program_type: "ALL",
    applyToAll: true,
    saving: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch subjects, departments, and teachers when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadMetaData = async () => {
      try {
        const [subs, depts] = await Promise.all([
          api.getSubjects().catch(() => []),
          api.getDepartments().catch(() => []),
        ]);
        setCurriculumSubjects(subs || []);
        setDepartments(depts || []);

        if (!initialTeachers || initialTeachers.length === 0) {
          const tList = await api.getTeachers().catch(() => []);
          setAllTeachers(tList || []);
        } else {
          setAllTeachers(initialTeachers);
        }
      } catch (e) {
        console.warn("Failed to load reference metadata for import modal:", e);
      }
    };

    loadMetaData();
  }, [isOpen, initialTeachers]);

  // Synchronize initialSectionId and sections when modal opens or props change
  useEffect(() => {
    setLocalSections(sections);
    if (initialSectionId) {
      setSelectedSectionId(initialSectionId);
    } else if (sections.length > 0) {
      setSelectedSectionId(sections[0].id);
    }
  }, [initialSectionId, isOpen, sections]);

  const currentSection = useMemo(() => {
    return localSections.find((s) => s.id === selectedSectionId) || localSections[0];
  }, [localSections, selectedSectionId]);

  // Distinct unrecognized subjects in uploaded sheet
  const unrecognizedSubjects = useMemo(() => {
    const map = new Map<string, { raw: string; count: number; slots: ParsedSlotItem[] }>();
    previewSlots.forEach((slot) => {
      if (slot.status === "UNMATCHED_SUBJECT" || !slot.subject_id) {
        const rawName = (slot.raw_subject || slot.subject_name.replace(/^Unrecognized:\s*/i, "")).trim();
        if (!rawName) return;
        if (!map.has(rawName)) {
          map.set(rawName, { raw: rawName, count: 0, slots: [] });
        }
        const item = map.get(rawName)!;
        item.count += 1;
        item.slots.push(slot);
      }
    });
    return Array.from(map.values());
  }, [previewSlots]);

  // Helper to recompute stats
  const recomputeStats = (slots: ParsedSlotItem[]) => {
    const confCount = slots.filter(
      (s) => s.status === "CONFLICT" || s.status.startsWith("UNMATCHED") || !s.subject_id || !s.teacher_id
    ).length;
    const warnCount = slots.filter((s) => s.status === "WARNING").length;
    const valCount = slots.filter(
      (s) => s.status === "VALID" && s.subject_id !== null && s.teacher_id !== null
    ).length;
    return {
      total_slots: slots.length,
      conflict_count: confCount,
      warning_count: warnCount,
      valid_count: valCount,
    };
  };

  const handleCreateNewSection = async (customName?: string): Promise<number | null> => {
    const trimmed = (customName !== undefined ? customName : newSectionName).trim();
    const finalName = trimmed || `Grade ${newSectionGrade} - Section ${localSections.length + 1}`;
    try {
      setCreatingSection(true);
      setError(null);
      const created = await api.createSection({
        name: finalName,
        grade_level: Number(newSectionGrade),
        program_type: newSectionTrack,
        room_number: newSectionRoom.trim() || `Room ${newSectionGrade}01`,
        adviser_id: newSectionAdviserId ? Number(newSectionAdviserId) : null,
      });

      const newSecOption: SectionOption = {
        id: created.id,
        name: created.name,
        grade_level: created.grade_level,
        program_type: created.program_type,
        room_number: created.room_number,
      };

      setLocalSections((prev) => [...prev, newSecOption]);
      setSelectedSectionId(created.id);
      setSectionOption("EXISTING");
      setSuccessMessage(`Section "${created.name}" created successfully! Now ready to import its schedule.`);
      window.dispatchEvent(new CustomEvent("schedmaster_sections_refresh"));
      return created.id;
    } catch (err: any) {
      setError(err?.message || "Failed to create new section.");
      return null;
    } finally {
      setCreatingSection(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      setError(null);

      if (sectionOption === "NEW") {
        // Download 9-period template even if fields are left empty
        const secName = newSectionName.trim() || `Grade ${newSectionGrade} - New Section`;
        await api.downloadSectionScheduleTemplateExcel(
          0,
          secName,
          newSectionGrade,
          newSectionTrack,
          9
        );
      } else {
        if (!currentSection) return;
        await api.downloadSectionScheduleTemplateExcel(
          currentSection.id,
          currentSection.name,
          currentSection.grade_level || currentSection.gradeLevel,
          currentSection.program_type,
          9
        );
      }
    } catch (err: any) {
      setError(err?.message || "Failed to download schedule template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = async (selectedFile: File) => {
    const fn = selectedFile.name.toLowerCase();
    if (!fn.endsWith(".xlsx") && !fn.endsWith(".xls") && !fn.endsWith(".csv")) {
      setError("Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV file.");
      return;
    }

    let targetId = selectedSectionId;

    if (sectionOption === "NEW") {
      let secName = newSectionName.trim();
      if (!secName) {
        const baseName = selectedFile.name
          .replace(/\.[^/.]+$/, "")
          .replace(/^(?:Schedule_Template_|Schedule_)/i, "")
          .replace(/_/g, " ")
          .trim();
        secName = baseName || `Grade ${newSectionGrade} - Section ${localSections.length + 1}`;
        setNewSectionName(secName);
      }
      const createdId = await handleCreateNewSection(secName);
      if (!createdId) return;
      targetId = createdId;
    }

    setFile(selectedFile);
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const data = await api.previewSectionScheduleExcel(targetId, selectedFile);
      const incomingSlots: ParsedSlotItem[] = data.slots || [];
      setPreviewSlots(incomingSlots);
      setLayoutDetected(data.layout_detected || "GRID_MATRIX");
      setAvailableSheets(data.available_sheets || []);
      setActiveSheet(data.active_sheet || "");
      setStats(recomputeStats(incomingSlots));
    } catch (err: any) {
      setError(err?.message || "Failed to parse section schedule spreadsheet.");
      setPreviewSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSheet = async (sheetName: string) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const matchingSec = sections.find((s) => {
        const cleanName = s.name.replace(/^(grade\s*\d+\s*[-–]\s*)/i, "").trim().toLowerCase();
        return sheetName.toLowerCase().includes(cleanName) || s.name.toLowerCase().includes(sheetName.toLowerCase());
      });
      const targetSecId = matchingSec ? matchingSec.id : selectedSectionId;
      if (matchingSec && matchingSec.id !== selectedSectionId) {
        setSelectedSectionId(matchingSec.id);
      }

      const data = await api.previewSectionScheduleExcel(targetSecId, file, sheetName);
      const incomingSlots: ParsedSlotItem[] = data.slots || [];
      setPreviewSlots(incomingSlots);
      setLayoutDetected(data.layout_detected || "GRID_MATRIX");
      setActiveSheet(sheetName);
      setStats(recomputeStats(incomingSlots));
    } catch (err: any) {
      setError(err?.message || "Failed to switch sheet.");
    } finally {
      setLoading(false);
    }
  };

  // Quick Map an Unrecognized Subject to an Existing Subject
  const handleMapSubjectToExisting = (rawSubjectName: string, targetSubjectId: number, applyToAll: boolean = true) => {
    const targetSub = curriculumSubjects.find((s) => s.id === targetSubjectId);
    if (!targetSub) return;

    const deptFaculty = allTeachers.filter((t) => t.department_id === targetSub.department_id);

    const updated = previewSlots.map((slot) => {
      const slotRaw = (slot.raw_subject || slot.subject_name.replace(/^Unrecognized:\s*/i, "")).trim().toLowerCase();
      const match = applyToAll
        ? slotRaw === rawSubjectName.trim().toLowerCase()
        : slot.raw_subject === rawSubjectName;

      if (!match) return slot;

      // Determine teacher
      let assignedTeacherId = slot.teacher_id;
      let assignedTeacherName = slot.teacher_name;

      if (!assignedTeacherId || !deptFaculty.some((t) => t.id === assignedTeacherId)) {
        if (deptFaculty.length > 0) {
          assignedTeacherId = deptFaculty[0].id;
          assignedTeacherName = deptFaculty[0].name;
        }
      }

      const isComplete = assignedTeacherId !== null && assignedTeacherId !== undefined;
      return {
        ...slot,
        subject_id: targetSub.id,
        subject_name: targetSub.name,
        department_id: targetSub.department_id,
        teacher_id: assignedTeacherId,
        teacher_name: assignedTeacherName,
        eligible_teachers: deptFaculty.map((t) => ({
          id: t.id,
          name: t.name,
          current_load: t.current_load_hours || 0,
          is_adviser: t.is_adviser,
        })),
        status: (isComplete ? "VALID" : "UNMATCHED_TEACHER") as any,
        message: isComplete
          ? `Mapped to ${targetSub.name} (${assignedTeacherName})`
          : `Mapped to ${targetSub.name}. Please assign teacher.`,
      };
    });

    setPreviewSlots(updated);
    setStats(recomputeStats(updated));
    setSuccessMessage(`Mapped "${rawSubjectName}" to curriculum subject "${targetSub.name}".`);
  };

  // Quick Create New Subject and Map
  const handleQuickCreateSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCreateSubject.name.trim()) return;

    try {
      setQuickCreateSubject((prev) => ({ ...prev, saving: true }));
      setError(null);

      const created = await api.createSubject({
        name: quickCreateSubject.name.trim(),
        department_id: Number(quickCreateSubject.department_id),
        grade_level: Number(quickCreateSubject.grade_level),
        required_weekly_loads: Number(quickCreateSubject.required_weekly_loads),
        program_type: quickCreateSubject.program_type,
      });

      // Update local subjects list
      setCurriculumSubjects((prev) => [...prev, created]);

      // Map the raw subject slots
      handleMapSubjectToExisting(quickCreateSubject.name.trim(), created.id, quickCreateSubject.applyToAll);

      setSuccessMessage(`Subject "${created.name}" created successfully and mapped to schedule.`);
      setQuickCreateSubject((prev) => ({ ...prev, isOpen: false, saving: false }));
    } catch (err: any) {
      setError(err?.message || "Failed to create new subject.");
      setQuickCreateSubject((prev) => ({ ...prev, saving: false }));
    }
  };

  // Reassign faculty for a single slot
  const handleReassignTeacher = (dayIdx: number, periodIdx: number, teacherId: number) => {
    const updated = previewSlots.map((slot) => {
      if (slot.day_of_week === dayIdx && slot.period_index === periodIdx) {
        const tInfo =
          slot.eligible_teachers?.find((t) => t.id === teacherId) ||
          allTeachers.find((t) => t.id === teacherId);
        const tName = tInfo?.name || `Teacher #${teacherId}`;
        const hasValidSubject = slot.subject_id !== null;
        return {
          ...slot,
          teacher_id: teacherId,
          teacher_name: tName,
          status: (hasValidSubject ? "VALID" : "UNMATCHED_SUBJECT") as any,
          message: hasValidSubject ? `Reassigned to ${tName}` : `Assigned ${tName}. Subject still unmapped.`,
        };
      }
      return slot;
    });

    setPreviewSlots(updated);
    setStats(recomputeStats(updated));
  };

  // Open the interactive slot editor for existing or new slot
  const handleOpenSlotEditor = (
    day: number,
    period: number,
    existingSlot?: ParsedSlotItem
  ) => {
    if (existingSlot) {
      setEditingSlot({
        isNew: false,
        day_of_week: existingSlot.day_of_week,
        period_index: existingSlot.period_index,
        raw_subject: existingSlot.raw_subject || existingSlot.subject_name,
        subject_id: existingSlot.subject_id,
        subject_name: existingSlot.subject_name,
        teacher_id: existingSlot.teacher_id,
        teacher_name: existingSlot.teacher_name,
        department_id: existingSlot.department_id || null,
        applySubjectToAll: existingSlot.status === "UNMATCHED_SUBJECT",
        applyTeacherToAll: false,
      });
    } else {
      setEditingSlot({
        isNew: true,
        day_of_week: day,
        period_index: period,
        raw_subject: "",
        subject_id: curriculumSubjects.length > 0 ? curriculumSubjects[0].id : null,
        subject_name: curriculumSubjects.length > 0 ? curriculumSubjects[0].name : "",
        teacher_id: allTeachers.length > 0 ? allTeachers[0].id : null,
        teacher_name: allTeachers.length > 0 ? allTeachers[0].name : "Unassigned",
        department_id: curriculumSubjects.length > 0 ? curriculumSubjects[0].department_id : null,
        applySubjectToAll: false,
        applyTeacherToAll: false,
      });
    }
  };

  // Save changes from the interactive slot editor
  const handleSaveSlotEditor = () => {
    if (!editingSlot) return;

    const {
      isNew,
      day_of_week,
      period_index,
      subject_id,
      teacher_id,
      applySubjectToAll,
      applyTeacherToAll,
      raw_subject,
    } = editingSlot;

    const targetSub = curriculumSubjects.find((s) => s.id === subject_id);
    const targetTeacher = allTeachers.find((t) => t.id === teacher_id);
    const subName = targetSub ? targetSub.name : raw_subject || "Custom Subject";
    const teachName = targetTeacher ? targetTeacher.name : "Unassigned";
    const deptFaculty = targetSub ? allTeachers.filter((t) => t.department_id === targetSub.department_id) : [];

    let updated = [...previewSlots];

    if (isNew) {
      // Add new slot to preview
      const newSlot: ParsedSlotItem = {
        day_of_week,
        day_name: DAYS_NAMES[day_of_week],
        period_index,
        time_str: PERIOD_TIME_LABELS[period_index] || `Period ${period_index}`,
        raw_subject: subName,
        subject_id: targetSub ? targetSub.id : null,
        subject_name: subName,
        department_id: targetSub ? targetSub.department_id : null,
        raw_teacher: teachName,
        teacher_id: targetTeacher ? targetTeacher.id : null,
        teacher_name: teachName,
        eligible_teachers: deptFaculty.map((t) => ({
          id: t.id,
          name: t.name,
          current_load: t.current_load_hours || 0,
          is_adviser: t.is_adviser,
        })),
        is_locked: day_of_week === 0 && period_index === 1,
        status: (targetSub && targetTeacher ? "VALID" : "WARNING") as any,
        message: "Manually added slot",
      };
      // Replace existing slot at same day and period if any, else append
      updated = updated.filter((s) => !(s.day_of_week === day_of_week && s.period_index === period_index));
      updated.push(newSlot);
    } else {
      // Batch update subjects if applySubjectToAll is active
      if (applySubjectToAll && raw_subject && targetSub) {
        updated = updated.map((s) => {
          const sRaw = (s.raw_subject || s.subject_name.replace(/^Unrecognized:\s*/i, "")).trim().toLowerCase();
          if (sRaw === raw_subject.trim().toLowerCase()) {
            return {
              ...s,
              subject_id: targetSub.id,
              subject_name: targetSub.name,
              department_id: targetSub.department_id,
              status: (s.teacher_id ? "VALID" : "UNMATCHED_TEACHER") as any,
              message: s.teacher_id ? `Mapped to ${targetSub.name}` : `Mapped to ${targetSub.name}. Assign teacher.`,
            };
          }
          return s;
        });
      }

      // Batch update teachers if applyTeacherToAll is active
      if (applyTeacherToAll && targetTeacher && targetSub) {
        updated = updated.map((s) => {
          if (s.subject_id === targetSub.id) {
            return {
              ...s,
              teacher_id: targetTeacher.id,
              teacher_name: targetTeacher.name,
              status: "VALID" as const,
              message: `Assigned ${targetTeacher.name}`,
            };
          }
          return s;
        });
      }

      // Update the specific slot being edited
      updated = updated.map((s) => {
        if (s.day_of_week === day_of_week && s.period_index === period_index) {
          const isValid = targetSub !== undefined && targetTeacher !== undefined;
          return {
            ...s,
            subject_id: targetSub ? targetSub.id : null,
            subject_name: subName,
            department_id: targetSub ? targetSub.department_id : null,
            teacher_id: targetTeacher ? targetTeacher.id : null,
            teacher_name: teachName,
            eligible_teachers: deptFaculty.map((t) => ({
              id: t.id,
              name: t.name,
              current_load: t.current_load_hours || 0,
              is_adviser: t.is_adviser,
            })),
            status: (isValid ? "VALID" : "UNMATCHED_SUBJECT") as any,
            message: `Manually edited: ${subName} (${teachName})`,
          };
        }
        return s;
      });
    }

    setPreviewSlots(updated);
    setStats(recomputeStats(updated));
    setEditingSlot(null);
    setSuccessMessage(`Period ${period_index} on ${DAYS_NAMES[day_of_week]} updated successfully.`);
  };

  // Remove a slot from the import preview
  const handleDeleteSlot = (day: number, period: number) => {
    const updated = previewSlots.filter(
      (s) => !(s.day_of_week === day && s.period_index === period)
    );
    setPreviewSlots(updated);
    setStats(recomputeStats(updated));
    setEditingSlot(null);
    setSuccessMessage(`Removed slot from Period ${period} on ${DAYS_NAMES[day]}.`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleConfirmImport = async () => {
    if (!previewSlots || previewSlots.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      // Filter slots that have valid subject and teacher
      const validSlots = previewSlots
        .filter((s) => s.subject_id !== null && s.teacher_id !== null)
        .map((s) => ({
          day_of_week: s.day_of_week,
          period_index: s.period_index,
          subject_id: s.subject_id!,
          teacher_id: s.teacher_id!,
          is_locked: s.is_locked,
        }));

      if (validSlots.length === 0) {
        throw new Error("No valid instructional periods found to import. Please map unrecognized subjects and teachers first.");
      }

      const res = await api.importSectionScheduleExcel(selectedSectionId, validSlots);
      setSuccessMessage(res.message || `Successfully imported ${res.slots_imported} periods.`);

      setTimeout(() => {
        if (onImportComplete) onImportComplete();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to commit section schedule.");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewSlots([]);
    setError(null);
    setSuccessMessage(null);
    setEditingSlot(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filteredSlots = useMemo(() => {
    if (statusFilter === "CONFLICT")
      return previewSlots.filter(
        (s) => s.status === "CONFLICT" || s.status.startsWith("UNMATCHED") || !s.subject_id || !s.teacher_id
      );
    if (statusFilter === "WARNING") return previewSlots.filter((s) => s.status === "WARNING");
    if (statusFilter === "VALID")
      return previewSlots.filter((s) => s.status === "VALID" && s.subject_id && s.teacher_id);
    return previewSlots;
  }, [previewSlots, statusFilter]);

  // Group slots by period (1 to 9) and day (0 to 4) for Grid View
  const gridMatrix = useMemo(() => {
    const matrix: Record<number, Record<number, ParsedSlotItem | undefined>> = {};
    for (let p = 1; p <= 9; p++) {
      matrix[p] = {};
    }
    previewSlots.forEach((slot) => {
      if (matrix[slot.period_index]) {
        matrix[slot.period_index][slot.day_of_week] = slot;
      }
    });
    return matrix;
  }, [previewSlots]);

  // Always show up to 9 periods for DepEd schedules
  const maxPeriodInPreview = useMemo(() => {
    if (previewSlots.length === 0) return 9;
    return Math.max(9, ...previewSlots.map((s) => s.period_index));
  }, [previewSlots]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-[#2E0249] to-[#4A0E4E] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/20">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Import Section</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Excel / CSV
                </span>
                <span className="text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Periods 1–9
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Section Option Card: Pre-existing Section vs New Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Section:
                </span>
                <div className="relative">
                  <select
                    value={sectionOption}
                    onChange={(e) => setSectionOption(e.target.value as "EXISTING" | "NEW")}
                    className="appearance-none bg-white border border-slate-300 text-slate-800 text-xs font-bold py-1.5 pl-3 pr-8 rounded-lg shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-[#A91079] cursor-pointer"
                  >
                    <option value="EXISTING">Pre-existing Section</option>
                    <option value="NEW">+ Create New Section</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Download clean DepEd 9-period schedule spreadsheet template (.xlsx)"
                >
                  {downloadingTemplate ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#A91079]" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-[#A91079]" />
                  )}
                  <span>Download 9-Period Template (.xlsx)</span>
                </button>
              </div>
            </div>

            {sectionOption === "EXISTING" ? (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex-1 min-w-[240px]">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Select Existing Section
                  </label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(Number(e.target.value))}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#A91079] cursor-pointer"
                  >
                    {localSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Grade {s.grade_level || s.gradeLevel} • {s.program_type || "BEC"})
                      </option>
                    ))}
                  </select>
                </div>
                {currentSection && (
                  <div className="flex items-center gap-3 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200 mt-5">
                    <div>
                      <span className="text-slate-400">Track:</span>{" "}
                      <span className="font-bold text-purple-900">{currentSection.program_type || "BEC"}</span>
                    </div>
                    <span>•</span>
                    <div>
                      <span className="text-slate-400">Room:</span>{" "}
                      <span className="font-semibold text-slate-700">{currentSection.room_number || "Room 101"}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-1 border-t border-slate-200/60 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Section Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Grade 7 - Diamond"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#A91079]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Grade Level
                    </label>
                    <select
                      value={newSectionGrade}
                      onChange={(e) => setNewSectionGrade(Number(e.target.value))}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#A91079] cursor-pointer"
                    >
                      <option value={7}>Grade 7</option>
                      <option value={8}>Grade 8</option>
                      <option value={9}>Grade 9</option>
                      <option value={10}>Grade 10</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Program Track
                    </label>
                    <select
                      value={newSectionTrack}
                      onChange={(e) => setNewSectionTrack(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#A91079] cursor-pointer"
                    >
                      <option value="BEC">BEC (Regular)</option>
                      <option value="STE">STE (Science)</option>
                      <option value="SPA">SPA (Arts)</option>
                      <option value="SPJ">SPJ (Journalism)</option>
                      <option value="SPS">SPS (Sports)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Room Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Room 701"
                      value={newSectionRoom}
                      onChange={(e) => setNewSectionRoom(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#A91079]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Class Adviser:</span>
                    <select
                      value={newSectionAdviserId}
                      onChange={(e) => setNewSectionAdviserId(e.target.value ? Number(e.target.value) : "")}
                      className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 cursor-pointer"
                    >
                      <option value="">-- No Adviser Assigned --</option>
                      {allTeachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCreateNewSection()}
                    disabled={creatingSection || !newSectionName.trim()}
                    className="px-4 py-2 bg-[#2E0249] hover:bg-[#4A0E4E] disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {creatingSection ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Create Section Now</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error / Success Notifications */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
              <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {/* Upload Dropzone (When no preview is active) */}
          {previewSlots.length === 0 && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? "border-[#A91079] bg-purple-50/70"
                  : "border-slate-300 hover:border-[#A91079] bg-slate-50/50 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="p-3.5 bg-purple-100 text-[#A91079] rounded-2xl shadow-xs">
                {loading ? (
                  <RefreshCw className="w-7 h-7 animate-spin" />
                ) : (
                  <Upload className="w-7 h-7" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {loading ? "Analyzing Schedule Spreadsheet..." : "Click to select or drag and drop your schedule file"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv). Grid Matrix and Tabular layouts up to 9 periods supported.
                </p>
              </div>
            </div>
          )}

          {/* Interactive Preview View */}
          {previewSlots.length > 0 && (
            <div className="space-y-4">
              {/* Multi-Sheet Tab Strip */}
              {availableSheets.length > 1 && (
                <div className="flex items-center gap-2 bg-[#FAF5FA] border border-[#E5CCE3] p-2.5 rounded-xl overflow-x-auto shadow-2xs">
                  <span className="text-[11px] font-bold text-[#A91079] uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#A91079]" />
                    <span>Workbook Sheets:</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {availableSheets.map((sh) => (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => handleSelectSheet(sh)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                          activeSheet === sh
                            ? "bg-[#2E0249] text-white shadow-xs"
                            : "bg-white hover:bg-purple-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {sh}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Distinct Unrecognized Subjects Banner */}
              {unrecognizedSubjects.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-purple-50 border border-amber-300 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-900">
                        {unrecognizedSubjects.length} Unrecognized Subject{unrecognizedSubjects.length > 1 ? "s" : ""} Found in Uploaded Schedule
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 italic">
                      Map to curriculum subjects or create new subjects before importing:
                    </span>
                  </div>

                  <div className="space-y-2">
                    {unrecognizedSubjects.map((item) => (
                      <div
                        key={item.raw}
                        className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white rounded-lg border border-amber-200 shadow-2xs text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#2E0249] bg-purple-100 px-2 py-0.5 rounded text-xs border border-purple-200">
                            {item.raw}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            ({item.count} period{item.count > 1 ? "s" : ""})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value === "CREATE_NEW") {
                                setQuickCreateSubject({
                                  isOpen: true,
                                  name: item.raw,
                                  department_id: departments[0]?.id || 1,
                                  grade_level: currentSection?.grade_level || 7,
                                  required_weekly_loads: 4,
                                  program_type: "ALL",
                                  applyToAll: true,
                                  saving: false,
                                });
                              } else if (e.target.value) {
                                handleMapSubjectToExisting(item.raw, Number(e.target.value), true);
                              }
                            }}
                            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-semibold focus:ring-1 focus:ring-purple-500 cursor-pointer"
                          >
                            <option value="">-- Map to Existing Subject --</option>
                            {curriculumSubjects.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.name}
                              </option>
                            ))}
                            <option value="CREATE_NEW" className="font-bold text-[#A91079]">
                              + Create "{item.raw}" as New Subject...
                            </option>
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              setQuickCreateSubject({
                                isOpen: true,
                                name: item.raw,
                                department_id: departments[0]?.id || 1,
                                grade_level: currentSection?.grade_level || 7,
                                required_weekly_loads: 4,
                                program_type: "ALL",
                                applyToAll: true,
                                saving: false,
                              })
                            }
                            className="px-2.5 py-1 bg-[#A91079] hover:bg-[#8F0B66] text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add New Subject</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Stats Strip & View Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">Layout Detected:</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold uppercase tracking-wider text-[10px]">
                    {layoutDetected === "GRID_MATRIX" ? "Timetable Grid Matrix" : "Tabular Slot List"}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600 font-medium">{file?.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      statusFilter === "ALL" ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All ({stats.total_slots})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("VALID")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === "VALID" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Valid ({stats.valid_count})</span>
                  </button>
                  {stats.warning_count > 0 && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter("WARNING")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        statusFilter === "WARNING" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Warnings ({stats.warning_count})</span>
                    </button>
                  )}
                  {stats.conflict_count > 0 && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter("CONFLICT")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        statusFilter === "CONFLICT" ? "bg-red-700 text-white" : "bg-red-50 text-red-800 hover:bg-red-100"
                      }`}
                    >
                      <AlertOctagon className="w-3.5 h-3.5" />
                      <span>Clashes ({stats.conflict_count})</span>
                    </button>
                  )}

                  <div className="h-4 w-px bg-slate-300 mx-1" />

                  <button
                    type="button"
                    onClick={() => setViewMode(viewMode === "GRID" ? "LIST" : "GRID")}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-semibold transition cursor-pointer flex items-center gap-1"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{viewMode === "GRID" ? "List View" : "Grid Matrix View"}</span>
                  </button>
                </div>
              </div>

              {/* Grid Matrix View (Periods 1 to 9 with Statutory Breaks) */}
              {viewMode === "GRID" && (
                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-[#2E0249] text-white">
                        <th className="p-2.5 border-r border-[#4A0E4E] font-bold text-center w-28">Period</th>
                        {DAYS_NAMES.map((d) => (
                          <th key={d} className="p-2.5 border-r border-[#4A0E4E] font-bold text-center">
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Array.from({ length: maxPeriodInPreview }, (_, i) => i + 1).map((periodNum) => {
                        return (
                          <React.Fragment key={periodNum}>
                            {/* Insert Recess between Period 2 and 3 */}
                            {periodNum === 3 && (
                              <tr className="bg-slate-100 text-slate-600 font-semibold text-center italic text-[11px]">
                                <td colSpan={6} className="py-1 px-4">
                                  9:00 AM – 9:20 AM • RECESS / HEALTH BREAK (Statutory Block)
                                </td>
                              </tr>
                            )}
                            {/* Insert Lunch between Period 4 and 5 */}
                            {periodNum === 5 && (
                              <tr className="bg-slate-100 text-slate-600 font-semibold text-center italic text-[11px]">
                                <td colSpan={6} className="py-1 px-4">
                                  11:20 AM – 12:00 PM • NOON BREAK / LUNCH RECESS
                                </td>
                              </tr>
                            )}
                            <tr className="hover:bg-slate-50/50 transition">
                              <td className="p-2 border-r border-slate-200 text-center font-bold bg-slate-50 text-slate-700">
                                <div className="text-xs">Period {periodNum}</div>
                                <div className="text-[10px] text-slate-500 font-normal flex items-center justify-center gap-1 mt-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>
                                    {PERIOD_TIME_LABELS[periodNum] || `P${periodNum}`}
                                  </span>
                                </div>
                              </td>

                              {[0, 1, 2, 3, 4].map((dayIdx) => {
                                const slot = gridMatrix[periodNum]?.[dayIdx];
                                if (!slot) {
                                  return (
                                    <td
                                      key={dayIdx}
                                      onClick={() => handleOpenSlotEditor(dayIdx, periodNum)}
                                      className="p-2 border-r border-slate-200 text-center text-slate-400 italic hover:bg-purple-50/50 cursor-pointer group transition"
                                      title="Click to add a slot to this period"
                                    >
                                      <div className="flex flex-col items-center justify-center py-2">
                                        <span className="text-[11px] group-hover:hidden">Vacant</span>
                                        <span className="hidden group-hover:flex items-center gap-1 text-[11px] font-bold text-[#A91079]">
                                          <Plus className="w-3 h-3" /> Add Slot
                                        </span>
                                      </div>
                                    </td>
                                  );
                                }

                                const isUnmatchedSub = slot.status === "UNMATCHED_SUBJECT" || !slot.subject_id;
                                const isConflict = slot.status === "CONFLICT" || isUnmatchedSub || !slot.teacher_id;
                                const isWarning = slot.status === "WARNING";

                                return (
                                  <td
                                    key={dayIdx}
                                    onClick={() => handleOpenSlotEditor(dayIdx, periodNum, slot)}
                                    className={`p-2 border-r border-slate-200 align-top transition cursor-pointer hover:shadow-xs ${
                                      isConflict
                                        ? "bg-red-50/80 border-red-200 hover:bg-red-100/70"
                                        : isWarning
                                        ? "bg-amber-50/80 border-amber-200 hover:bg-amber-100/70"
                                        : "bg-white hover:bg-purple-50/40"
                                    }`}
                                  >
                                    <div className="space-y-1 relative">
                                      <div className="flex items-center justify-between gap-1">
                                        <div className="font-bold text-slate-900 truncate flex items-center gap-1">
                                          {isUnmatchedSub && (
                                            <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold bg-amber-200 text-amber-900 rounded">
                                              Unmatched
                                            </span>
                                          )}
                                          <span className="truncate">{slot.subject_name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {slot.is_locked && (
                                            <span title="Locked Slot">
                                              <Lock className="w-3 h-3 text-[#A91079]" />
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            title="Edit Subject & Faculty"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenSlotEditor(dayIdx, periodNum, slot);
                                            }}
                                            className="p-1 hover:bg-purple-100 rounded text-slate-400 hover:text-[#A91079] transition cursor-pointer"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="text-[11px] text-slate-600 truncate flex items-center gap-1">
                                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="truncate">{slot.teacher_name}</span>
                                      </div>

                                      {slot.message && (
                                        <div
                                          className={`text-[10px] font-medium leading-tight ${
                                            isConflict
                                              ? "text-red-700 font-semibold"
                                              : isWarning
                                              ? "text-amber-800"
                                              : "text-emerald-700"
                                          }`}
                                        >
                                          {slot.message}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* List View */}
              {viewMode === "LIST" && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 font-bold">Day & Period</th>
                        <th className="p-2.5 font-bold">Subject</th>
                        <th className="p-2.5 font-bold">Assigned Teacher</th>
                        <th className="p-2.5 font-bold">Audit Status</th>
                        <th className="p-2.5 font-bold">Diagnostic Details</th>
                        <th className="p-2.5 font-bold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSlots.map((slot, idx) => {
                        const isUnmatchedSub = slot.status === "UNMATCHED_SUBJECT" || !slot.subject_id;
                        const isConflict = slot.status === "CONFLICT" || isUnmatchedSub || !slot.teacher_id;
                        const isWarning = slot.status === "WARNING";
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 font-medium text-slate-800 whitespace-nowrap">
                              {slot.day_name} • Period {slot.period_index}
                            </td>
                            <td className="p-2.5">
                              {isUnmatchedSub ? (
                                <div className="space-y-1">
                                  <div className="font-bold text-red-700 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>{slot.subject_name}</span>
                                  </div>
                                  <select
                                    defaultValue=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleMapSubjectToExisting(slot.raw_subject, Number(e.target.value), false);
                                      }
                                    }}
                                    className="text-[11px] bg-amber-50 border border-amber-300 rounded px-2 py-0.5 text-slate-800 font-semibold cursor-pointer"
                                  >
                                    <option value="">-- Map Subject --</option>
                                    {curriculumSubjects.map((sub) => (
                                      <option key={sub.id} value={sub.id}>
                                        {sub.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <span className="font-bold text-slate-900">{slot.subject_name}</span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <select
                                value={slot.teacher_id || ""}
                                onChange={(e) =>
                                  handleReassignTeacher(
                                    slot.day_of_week,
                                    slot.period_index,
                                    Number(e.target.value)
                                  )
                                }
                                className="text-xs bg-white border border-slate-300 rounded px-2 py-1 font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-purple-500 cursor-pointer"
                              >
                                <option value="">-- Assign Teacher --</option>
                                {slot.eligible_teachers && slot.eligible_teachers.length > 0
                                  ? slot.eligible_teachers.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name} ({t.current_load} hrs/wk{t.is_adviser ? " • Adv" : ""})
                                      </option>
                                    ))
                                  : allTeachers.map((t: any) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name} ({t.current_load_hours || 0} hrs/wk)
                                      </option>
                                    ))}
                              </select>
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              {isConflict ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                  <AlertOctagon className="w-3 h-3" /> Clashing
                                </span>
                              ) : isWarning ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  <AlertTriangle className="w-3 h-3" /> Warning
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" /> Ready
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-600 text-[11px]">{slot.message || "—"}</td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSlotEditor(slot.day_of_week, slot.period_index, slot)}
                                  className="p-1 hover:bg-purple-100 rounded text-slate-500 hover:text-[#A91079] transition cursor-pointer"
                                  title="Edit Slot Details"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSlot(slot.day_of_week, slot.period_index)}
                                  className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 transition cursor-pointer"
                                  title="Remove Slot"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          {previewSlots.length > 0 ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={importing}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Choose Different File
            </button>
          ) : (
            <div className="text-xs text-slate-500 italic">
              Make sure your class advisers and subjects are properly configured before import.
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            {previewSlots.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || previewSlots.length === 0}
                className="px-5 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white text-xs font-bold rounded-xl shadow-md shadow-[#A91079]/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {importing
                    ? "Importing Schedule..."
                    : `Confirm & Import Schedule (${previewSlots.filter((s) => s.subject_id && s.teacher_id).length} Valid Slots)`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive In-Modal Slot Editor Popover / Dialog */}
        {editingSlot && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="p-4 bg-gradient-to-r from-[#2E0249] to-[#4A0E4E] text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold">
                    {editingSlot.isNew ? "Add Schedule Period Slot" : "Edit Period Slot Details"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* Time & Day Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Day of the Week
                    </label>
                    <select
                      value={editingSlot.day_of_week}
                      onChange={(e) =>
                        setEditingSlot({ ...editingSlot, day_of_week: Number(e.target.value) })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                    >
                      {DAYS_NAMES.map((d, idx) => (
                        <option key={d} value={idx}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Instructional Period
                    </label>
                    <select
                      value={editingSlot.period_index}
                      onChange={(e) =>
                        setEditingSlot({ ...editingSlot, period_index: Number(e.target.value) })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                    >
                      {Array.from({ length: 9 }, (_, i) => i + 1).map((p) => (
                        <option key={p} value={p}>
                          Period {p} ({PERIOD_TIME_LABELS[p] || `Period ${p}`})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Raw Subject Warning if Unrecognized */}
                {editingSlot.raw_subject && (
                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-purple-700 font-semibold uppercase tracking-wider block">
                        Spreadsheet Subject Value:
                      </span>
                      <span className="font-bold text-purple-900">{editingSlot.raw_subject}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setQuickCreateSubject({
                          isOpen: true,
                          name: editingSlot.raw_subject,
                          department_id: departments[0]?.id || 1,
                          grade_level: currentSection?.grade_level || 7,
                          required_weekly_loads: 4,
                          program_type: "ALL",
                          applyToAll: true,
                          saving: false,
                        })
                      }
                      className="px-2.5 py-1 bg-[#A91079] hover:bg-[#8F0B66] text-white text-[11px] font-bold rounded-md flex items-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Create as New Subject</span>
                    </button>
                  </div>
                )}

                {/* Curriculum Subject Selection */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Map to Curriculum Subject *
                  </label>
                  <select
                    value={editingSlot.subject_id || ""}
                    onChange={(e) => {
                      const subId = Number(e.target.value);
                      const sub = curriculumSubjects.find((s) => s.id === subId);
                      setEditingSlot({
                        ...editingSlot,
                        subject_id: subId || null,
                        subject_name: sub ? sub.name : "",
                        department_id: sub ? sub.department_id : null,
                      });
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 focus:ring-2 focus:ring-[#A91079]"
                  >
                    <option value="">-- Choose Subject --</option>
                    {curriculumSubjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Teacher Selection */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Assigned Faculty / Teacher *
                  </label>
                  <select
                    value={editingSlot.teacher_id || ""}
                    onChange={(e) => {
                      const tId = Number(e.target.value);
                      const t = allTeachers.find((item) => item.id === tId);
                      setEditingSlot({
                        ...editingSlot,
                        teacher_id: tId || null,
                        teacher_name: t ? t.name : "Unassigned",
                      });
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-[#A91079]"
                  >
                    <option value="">-- Choose Faculty Member --</option>
                    {allTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.current_load_hours || 0} hrs/wk{t.is_adviser ? " • Adviser" : ""})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Batch Application Options */}
                {!editingSlot.isNew && editingSlot.raw_subject && (
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={editingSlot.applySubjectToAll}
                        onChange={(e) =>
                          setEditingSlot({ ...editingSlot, applySubjectToAll: e.target.checked })
                        }
                        className="rounded text-[#A91079] focus:ring-[#A91079]"
                      />
                      <span>Apply this subject to all occurrences of "{editingSlot.raw_subject}" in this schedule</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={editingSlot.applyTeacherToAll}
                        onChange={(e) =>
                          setEditingSlot({ ...editingSlot, applyTeacherToAll: e.target.checked })
                        }
                        className="rounded text-[#A91079] focus:ring-[#A91079]"
                      />
                      <span>Apply this teacher to all slots for this subject in this section</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Editor Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                {!editingSlot.isNew ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(editingSlot.day_of_week, editingSlot.period_index)}
                    className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Slot</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSlot(null)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSlotEditor}
                    className="px-4 py-1.5 bg-[#A91079] hover:bg-[#8F0B66] text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-2xs"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Create Subject Dialog */}
        {quickCreateSubject.isOpen && (
          <div className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="p-4 bg-gradient-to-r from-[#2E0249] to-[#4A0E4E] text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold">Create New Curriculum Subject</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickCreateSubject((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleQuickCreateSubjectSubmit} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickCreateSubject.name}
                    onChange={(e) =>
                      setQuickCreateSubject((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 focus:ring-2 focus:ring-[#A91079]"
                    placeholder="e.g. Robotics, Creative Writing"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Department *
                  </label>
                  <select
                    value={quickCreateSubject.department_id}
                    onChange={(e) =>
                      setQuickCreateSubject((prev) => ({ ...prev, department_id: Number(e.target.value) }))
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-[#A91079] cursor-pointer"
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Grade Level
                    </label>
                    <select
                      value={quickCreateSubject.grade_level}
                      onChange={(e) =>
                        setQuickCreateSubject((prev) => ({ ...prev, grade_level: Number(e.target.value) }))
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 cursor-pointer"
                    >
                      <option value={7}>Grade 7</option>
                      <option value={8}>Grade 8</option>
                      <option value={9}>Grade 9</option>
                      <option value={10}>Grade 10</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Weekly Loads (Hours)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={quickCreateSubject.required_weekly_loads}
                      onChange={(e) =>
                        setQuickCreateSubject((prev) => ({
                          ...prev,
                          required_weekly_loads: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Applicable Program Track
                  </label>
                  <select
                    value={quickCreateSubject.program_type}
                    onChange={(e) =>
                      setQuickCreateSubject((prev) => ({ ...prev, program_type: e.target.value }))
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value="ALL">All Program Tracks</option>
                    <option value="BEC">BEC (Regular)</option>
                    <option value="STE">STE (Science)</option>
                    <option value="SPA">SPA (Arts)</option>
                    <option value="SPJ">SPJ (Journalism)</option>
                    <option value="SPS">SPS (Sports)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={quickCreateSubject.applyToAll}
                      onChange={(e) =>
                        setQuickCreateSubject((prev) => ({ ...prev, applyToAll: e.target.checked }))
                      }
                      className="rounded text-[#A91079] focus:ring-[#A91079]"
                    />
                    <span>Automatically map all slots matching "{quickCreateSubject.name}" in this sheet</span>
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickCreateSubject((prev) => ({ ...prev, isOpen: false }))}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={quickCreateSubject.saving || !quickCreateSubject.name.trim()}
                    className="px-4 py-1.5 bg-[#A91079] hover:bg-[#8F0B66] text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  >
                    {quickCreateSubject.saving ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Create & Map Subject</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Backward-compatible alias for existing imports
export const ImportSectionsExcelModal = ImportSectionScheduleModal;
