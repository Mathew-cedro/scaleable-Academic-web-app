/**
 * Modular Curriculum Program Tracks Utility & Shared Storage.
 * Compliant with DepEd Order No. 009, s. 2026 Key Stage 3 Special Programs.
 */

export interface ModularTrack {
  id: string;
  code: string;
  name: string;
  description: string;
  badgeColor: "emerald" | "indigo" | "amber" | "fuchsia" | "sky" | "rose" | "teal";
  isDefault?: boolean;
  subjectIds: number[];
  isGradeSpecific?: boolean;
  gradeSubjects?: Record<number, number[]>; // Maps grade level (7, 8, 9, 10) to subject IDs
}

export const DEFAULT_MODULAR_TRACKS: ModularTrack[] = [
  {
    id: "BEC",
    code: "BEC",
    name: "Basic Education Curriculum (Regular)",
    description: "Standard DepEd Key Stage 3 general curriculum across all core and exploratory areas.",
    badgeColor: "emerald",
    isDefault: true,
    isGradeSpecific: true,
    subjectIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    gradeSubjects: {
      7: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      8: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      9: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
  },
  {
    id: "STE",
    code: "STE",
    name: "Science, Technology, and Engineering",
    description: "Enriched STEM program emphasizing scientific research, robotics, biotechnology, and advanced math.",
    badgeColor: "indigo",
    isDefault: true,
    isGradeSpecific: true,
    subjectIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    gradeSubjects: {
      7: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      8: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      9: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
  },
  {
    id: "SPJ",
    code: "SPJ",
    name: "Special Program in Journalism",
    description: "Mass media curriculum developing campus journalists in Print, Broadcast, and Digital Media.",
    badgeColor: "sky",
    isDefault: true,
    isGradeSpecific: true,
    subjectIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    gradeSubjects: {
      7: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      8: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      9: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
  },
  {
    id: "SPS",
    code: "SPS",
    name: "Special Program in Sports",
    description: "Athletics-focused curriculum with sports science, physical conditioning, coaching, and sports psychology.",
    badgeColor: "amber",
    isDefault: true,
    isGradeSpecific: true,
    subjectIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    gradeSubjects: {
      7: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      8: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      9: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
  },
  {
    id: "SPA",
    code: "SPA",
    name: "Special Program in the Arts",
    description: "Creative arts curriculum nurturing talents in Visual Arts, Music, Dance, Theater, and Media Arts.",
    badgeColor: "fuchsia",
    isDefault: true,
    isGradeSpecific: true,
    subjectIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    gradeSubjects: {
      7: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      8: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      9: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      10: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
  },
];

export const BADGE_COLOR_MAP: Record<string, { bg: string; border: string; text: string; pill: string }> = {
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    pill: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  },
  indigo: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-800",
    pill: "bg-indigo-100 text-indigo-800 border border-indigo-300",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    pill: "bg-amber-100 text-amber-800 border border-amber-300",
  },
  fuchsia: {
    bg: "bg-fuchsia-50",
    border: "border-fuchsia-200",
    text: "text-fuchsia-800",
    pill: "bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300",
  },
  sky: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-800",
    pill: "bg-sky-100 text-sky-800 border border-sky-300",
  },
  rose: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-800",
    pill: "bg-rose-100 text-rose-800 border border-rose-300",
  },
  teal: {
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-800",
    pill: "bg-teal-100 text-teal-800 border border-teal-300",
  },
};

export function normalizeModularTrack(track: ModularTrack): ModularTrack {
  const baseSubs = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const sanitize = (ids?: number[]) => {
    if (!ids || ids.length === 0) return [...baseSubs];
    return Array.from(new Set(ids));
  };
  const gradeSubjects: Record<number, number[]> = {
    7: sanitize(track.gradeSubjects?.[7]),
    8: sanitize(track.gradeSubjects?.[8]),
    9: sanitize(track.gradeSubjects?.[9]),
    10: sanitize(track.gradeSubjects?.[10]),
  };
  const allSubIds = Array.from(
    new Set([
      ...baseSubs,
      ...gradeSubjects[7],
      ...gradeSubjects[8],
      ...gradeSubjects[9],
      ...gradeSubjects[10],
    ])
  );
  return {
    ...track,
    subjectIds: allSubIds,
    isGradeSpecific: track.isGradeSpecific ?? true,
    gradeSubjects,
  };
}

const STORAGE_KEY = "schedmaster_custom_tracks_clean";

export function loadModularTracks(): ModularTrack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeModularTrack);
      }
    }
  } catch {
    // fallback to defaults
  }
  return DEFAULT_MODULAR_TRACKS.map(normalizeModularTrack);
}

export function saveModularTracks(tracks: ModularTrack[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
    window.dispatchEvent(new CustomEvent("schedmaster_tracks_updated", { detail: tracks }));
  } catch (e) {
    console.error("Failed to save modular tracks to storage:", e);
  }
}
