import { distributeStudyTime } from "./distributeStudyTime";

const DAY = 86_400_000;
function calendarDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp / DAY : null;
}
export type RevisionDate = { intervalDays: number; durationMinutes: number; scheduledDate: string; adjusted: boolean };
export type RevisionDatesResult = { revisions: RevisionDate[]; examDate: string | null; reason: "invalid" | "no_window" | null };

/** Dates souhaitées ; les créneaux disponibles seront traités par le planificateur. */
export function generateRevisionDates(courseDate: string, totalMinutes: number, intervals: readonly number[], examDates: readonly string[] = []): RevisionDatesResult {
  const invalid: RevisionDatesResult = { revisions: [], examDate: null, reason: "invalid" };
  const courseDay = calendarDay(courseDate);
  const allocations = distributeStudyTime(totalMinutes, intervals);
  const exams = examDates.map(calendarDay);
  if (courseDay === null || !allocations || exams.some((day) => day === null)) return invalid;
  const nextExam = exams.filter((day): day is number => day !== null && day >= courseDay).sort((a, b) => a - b)[0];
  const toDate = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
  const examDate = nextExam === undefined ? null : toDate(nextExam);
  const active = allocations.filter((allocation) => allocation.durationMinutes > 0);
  if (active.length && nextExam !== undefined && nextExam - courseDay <= 1) return { revisions: [], examDate, reason: "no_window" };
  const revisions: RevisionDate[] = [];
  const lastDay = calendarDay("9999-12-31")!;
  for (const allocation of active) {
    const desired = courseDay + allocation.intervalDays;
    const scheduled = nextExam === undefined ? desired : Math.min(desired, nextExam - 1);
    if (scheduled > lastDay) return invalid;
    revisions.push({ ...allocation, scheduledDate: toDate(scheduled), adjusted: scheduled !== desired });
  }
  return { revisions, examDate, reason: null };
}
