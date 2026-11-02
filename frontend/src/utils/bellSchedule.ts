/**
 * Bell Schedule Utility for DepEd SchedMaster
 * Computes dynamic real-world period intervals and schedule rows for durations
 * scaling from 20 minutes up to 4 hours (240 minutes) in 10-minute increments.
 */

export interface PeriodHeader {
  index: number;
  name: string;
  time: string;
}

export interface PeriodRow {
  type: "FIXED_ALL" | "PERIOD" | "SPECIAL";
  period?: number;
  time: string;
  label?: string;
}

/**
 * Formats duration in minutes into a compact human-readable string (e.g., "20m", "1h", "1h 30m", "4h").
 */
export function formatDuration(minutes: number): string {
  const d = Math.max(20, Math.min(240, Math.round((minutes || 60) / 10) * 10));
  const h = Math.floor(d / 60);
  const m = d % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Formats duration in minutes into a detailed string (e.g., "20 mins", "60 mins (1h)", "90 mins (1h 30m)", "240 mins (4h)").
 */
export function formatDurationDetailed(minutes: number): string {
  const d = Math.max(20, Math.min(240, Math.round((minutes || 60) / 10) * 10));
  const h = Math.floor(d / 60);
  const m = d % 60;
  if (h === 0) return `${m} mins`;
  if (m === 0) return `${d} mins (${h}h)`;
  return `${d} mins (${h}h ${m}m)`;
}

export function formatMinutesToTime(mins: number, includeAmPm: boolean = true): string {
  const normalized = mins % 1440;
  const h24 = Math.floor(normalized / 60);
  const m = normalized % 60;
  const ampm = h24 >= 12 && h24 < 24 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return includeAmPm ? `${h12}:${mStr} ${ampm}` : `${h12}:${mStr}`;
}

/**
 * Returns dynamic period header information (e.g. for MasterTimetableGrid column headers).
 */
export function getPeriodHeaders(durationMinutes: number = 60, maxPeriods: number = 7): PeriodHeader[] {
  // Clamped duration in 10-minute steps
  const dur = Math.max(20, Math.min(240, Math.round((durationMinutes || 60) / 10) * 10));

  // DepEd benchmark standards for common 30, 40, 50, 60
  if (dur === 30) {
    const list: PeriodHeader[] = [
      { index: 1, name: "Period 1", time: "7:00 – 7:30 AM" },
      { index: 2, name: "Period 2", time: "7:30 – 8:00 AM" },
      { index: 3, name: "Period 3", time: "8:15 – 8:45 AM" },
      { index: 4, name: "Period 4", time: "8:45 – 9:15 AM" },
      { index: 5, name: "Period 5", time: "9:45 – 10:15 AM" },
      { index: 6, name: "Period 6", time: "10:15 – 10:45 AM" },
      { index: 7, name: "Period 7", time: "10:45 – 11:15 AM" },
    ];
    if (maxPeriods >= 8) list.push({ index: 8, name: "Period 8", time: "11:15 – 11:45 AM" });
    if (maxPeriods >= 9) list.push({ index: 9, name: "Period 9", time: "11:45 – 12:15 PM" });
    return list.slice(0, maxPeriods);
  }
  if (dur === 40) {
    const list: PeriodHeader[] = [
      { index: 1, name: "Period 1", time: "7:00 – 7:40 AM" },
      { index: 2, name: "Period 2", time: "7:40 – 8:20 AM" },
      { index: 3, name: "Period 3", time: "8:40 – 9:20 AM" },
      { index: 4, name: "Period 4", time: "9:20 – 10:00 AM" },
      { index: 5, name: "Period 5", time: "10:40 – 11:20 AM" },
      { index: 6, name: "Period 6", time: "11:20 – 12:00 PM" },
      { index: 7, name: "Period 7", time: "12:00 – 12:40 PM" },
    ];
    if (maxPeriods >= 8) list.push({ index: 8, name: "Period 8", time: "12:40 – 1:20 PM" });
    if (maxPeriods >= 9) list.push({ index: 9, name: "Period 9", time: "1:20 – 2:00 PM" });
    return list.slice(0, maxPeriods);
  }
  if (dur === 50) {
    const list: PeriodHeader[] = [
      { index: 1, name: "Period 1", time: "7:00 – 7:50 AM" },
      { index: 2, name: "Period 2", time: "7:50 – 8:40 AM" },
      { index: 3, name: "Period 3", time: "9:00 – 9:50 AM" },
      { index: 4, name: "Period 4", time: "9:50 – 10:40 AM" },
      { index: 5, name: "Period 5", time: "11:30 – 12:20 PM" },
      { index: 6, name: "Period 6", time: "12:20 – 1:10 PM" },
      { index: 7, name: "Period 7", time: "1:10 – 2:00 PM" },
    ];
    if (maxPeriods >= 8) list.push({ index: 8, name: "Period 8", time: "2:00 – 2:50 PM" });
    if (maxPeriods >= 9) list.push({ index: 9, name: "Period 9", time: "2:50 – 3:40 PM" });
    return list.slice(0, maxPeriods);
  }
  if (dur === 60) {
    const list: PeriodHeader[] = [
      { index: 1, name: "Period 1", time: "7:00 – 8:00 AM" },
      { index: 2, name: "Period 2", time: "8:00 – 9:00 AM" },
      { index: 3, name: "Period 3", time: "9:20 – 10:20 AM" },
      { index: 4, name: "Period 4", time: "10:20 – 11:20 AM" },
      { index: 5, name: "Period 5", time: "12:00 – 1:00 PM" },
      { index: 6, name: "Period 6", time: "1:00 – 2:00 PM" },
      { index: 7, name: "Period 7", time: "2:00 – 3:00 PM" },
    ];
    if (maxPeriods >= 8) list.push({ index: 8, name: "Period 8", time: "3:00 – 4:00 PM" });
    if (maxPeriods >= 9) list.push({ index: 9, name: "Period 9", time: "4:00 – 5:00 PM" });
    return list.slice(0, maxPeriods);
  }

  // Dynamic algorithm for any duration between 20m and 240m
  const recessMins = dur <= 30 ? 15 : 20;
  const lunchMins = dur <= 30 ? 30 : dur <= 50 ? 40 : 45;

  let currentMin = 7 * 60; // 7:00 AM
  const headers: PeriodHeader[] = [];

  for (let p = 1; p <= maxPeriods; p++) {
    if (p === 3) {
      currentMin += recessMins; // Morning recess between P2 and P3
    } else if (p === 5) {
      currentMin += lunchMins; // Lunch break between P4 and P5
    }

    const startStr = formatMinutesToTime(currentMin);
    const endMin = currentMin + dur;
    const endStr = formatMinutesToTime(endMin);

    headers.push({
      index: p,
      name: `Period ${p}`,
      time: `${startStr} – ${endStr}`,
    });

    currentMin = endMin;
  }

  return headers;
}

/**
 * Returns dynamic period row layout with Flag Ceremony, Recess, and Lunch breaks
 * (for ClassTimetableGrid and TeacherTimetableGrid).
 */
export function getPeriodRows(durationMinutes: number = 60, maxPeriods: number = 7): PeriodRow[] {
  const dur = Math.max(20, Math.min(240, Math.round((durationMinutes || 60) / 10) * 10));

  if (dur === 30) {
    const rows: PeriodRow[] = [
      { type: "FIXED_ALL", time: "6:45-7:00", label: "Flag Ceremony" },
      { type: "PERIOD", period: 1, time: "7:00-7:30" },
      { type: "PERIOD", period: 2, time: "7:30-8:00" },
      { type: "FIXED_ALL", time: "8:00-8:15", label: "Morning Recess" },
      { type: "PERIOD", period: 3, time: "8:15-8:45" },
      { type: "PERIOD", period: 4, time: "8:45-9:15" },
      { type: "FIXED_ALL", time: "9:15-9:45", label: "Nutrition & Health Break" },
      { type: "PERIOD", period: 5, time: "9:45-10:15" },
      { type: "PERIOD", period: 6, time: "10:15-10:45" },
      { type: "PERIOD", period: 7, time: "10:45-11:15" },
    ];
    if (maxPeriods >= 8) rows.push({ type: "PERIOD", period: 8, time: "11:15-11:45" });
    if (maxPeriods >= 9) rows.push({ type: "PERIOD", period: 9, time: "11:45-12:15" });
    if (maxPeriods < 8) rows.push({ type: "SPECIAL", time: "11:15-12:00", label: "ARAL / Modular Consultation & Prep" });
    return rows;
  }
  if (dur === 40) {
    const rows: PeriodRow[] = [
      { type: "FIXED_ALL", time: "6:45-7:00", label: "Flag Ceremony" },
      { type: "PERIOD", period: 1, time: "7:00-7:40" },
      { type: "PERIOD", period: 2, time: "7:40-8:20" },
      { type: "FIXED_ALL", time: "8:20-8:40", label: "Morning Recess" },
      { type: "PERIOD", period: 3, time: "8:40-9:20" },
      { type: "PERIOD", period: 4, time: "9:20-10:00" },
      { type: "FIXED_ALL", time: "10:00-10:40", label: "Shift Transition / Lunch Break" },
      { type: "PERIOD", period: 5, time: "10:40-11:20" },
      { type: "PERIOD", period: 6, time: "11:20-12:00" },
      { type: "PERIOD", period: 7, time: "12:00-12:40" },
    ];
    if (maxPeriods >= 8) rows.push({ type: "PERIOD", period: 8, time: "12:40-1:20" });
    if (maxPeriods >= 9) rows.push({ type: "PERIOD", period: 9, time: "1:20-2:00" });
    if (maxPeriods < 8) rows.push({ type: "SPECIAL", time: "12:40-1:20", label: "SPA / Remedial & Shift Handover" });
    return rows;
  }
  if (dur === 50) {
    const rows: PeriodRow[] = [
      { type: "FIXED_ALL", time: "6:45-7:00", label: "Flag Ceremony" },
      { type: "PERIOD", period: 1, time: "7:00-7:50" },
      { type: "PERIOD", period: 2, time: "7:50-8:40" },
      { type: "FIXED_ALL", time: "8:40-9:00", label: "Break Time" },
      { type: "PERIOD", period: 3, time: "9:00-9:50" },
      { type: "PERIOD", period: 4, time: "9:50-10:40" },
      { type: "FIXED_ALL", time: "10:40-11:30", label: "Lunch Break" },
      { type: "PERIOD", period: 5, time: "11:30-12:20" },
      { type: "PERIOD", period: 6, time: "12:20-1:10" },
      { type: "PERIOD", period: 7, time: "1:10-2:00" },
    ];
    if (maxPeriods >= 8) rows.push({ type: "PERIOD", period: 8, time: "2:00-2:50" });
    if (maxPeriods >= 9) rows.push({ type: "PERIOD", period: 9, time: "2:50-3:40" });
    if (maxPeriods < 8) rows.push({ type: "SPECIAL", time: "2:00-3:00", label: "Remedial Coaching & Lesson Prep" });
    return rows;
  }
  if (dur === 60) {
    const rows: PeriodRow[] = [
      { type: "FIXED_ALL", time: "6:45-7:00", label: "Flag Ceremony" },
      { type: "PERIOD", period: 1, time: "7:00-8:00" },
      { type: "PERIOD", period: 2, time: "8:00-9:00" },
      { type: "FIXED_ALL", time: "9:00-9:15", label: "Break Time" },
      { type: "PERIOD", period: 3, time: "9:15-10:15" },
      { type: "PERIOD", period: 4, time: "10:15-11:15" },
      { type: "FIXED_ALL", time: "11:15-12:00", label: "Lunch Break" },
      { type: "PERIOD", period: 5, time: "12:00-1:00" },
      { type: "PERIOD", period: 6, time: "1:00-2:00" },
      { type: "PERIOD", period: 7, time: "2:00-3:00" },
    ];
    if (maxPeriods >= 8) rows.push({ type: "PERIOD", period: 8, time: "3:00-4:00" });
    if (maxPeriods >= 9) rows.push({ type: "PERIOD", period: 9, time: "4:00-5:00" });
    if (maxPeriods < 8) rows.push({ type: "SPECIAL", time: "3:00-4:00", label: "SPA / Special Program & Consultation" });
    return rows;
  }

  // Dynamic algorithm for any duration between 20m and 240m
  const recessMins = dur <= 30 ? 15 : 20;
  const lunchMins = dur <= 30 ? 30 : dur <= 50 ? 40 : 45;

  const rows: PeriodRow[] = [
    { type: "FIXED_ALL", time: "6:45-7:00", label: "Flag Ceremony" },
  ];

  let currentMin = 7 * 60; // 7:00 AM

  for (let p = 1; p <= maxPeriods; p++) {
    if (p === 3) {
      const recessEnd = currentMin + recessMins;
      rows.push({
        type: "FIXED_ALL",
        time: `${formatMinutesToTime(currentMin, false)}-${formatMinutesToTime(recessEnd, false)}`,
        label: "Recess / Morning Break",
      });
      currentMin = recessEnd;
    } else if (p === 5) {
      const lunchEnd = currentMin + lunchMins;
      rows.push({
        type: "FIXED_ALL",
        time: `${formatMinutesToTime(currentMin, false)}-${formatMinutesToTime(lunchEnd, false)}`,
        label: "Lunch Break / Midday Rest",
      });
      currentMin = lunchEnd;
    }

    const endMin = currentMin + dur;
    rows.push({
      type: "PERIOD",
      period: p,
      time: `${formatMinutesToTime(currentMin, false)}-${formatMinutesToTime(endMin, false)}`,
    });
    currentMin = endMin;
  }

  // If standard schedule, add special wrap-up block
  if (maxPeriods < 8) {
    const specialEnd = currentMin + 45;
    rows.push({
      type: "SPECIAL",
      time: `${formatMinutesToTime(currentMin, false)}-${formatMinutesToTime(specialEnd, false)}`,
      label: "Remedial Coaching & Lesson Prep",
    });
  }

  return rows;
}
