import type { Course, CourseSession } from "@/types/course";
import type { Exam } from "@/types/exam";
import type { Availability } from "@/types/availability";
import { sessionMinutes, timeToMinutes } from "@/lib/courses/session-time";
import { calculateStudyTime } from "./calculateStudyTime";
import { generateRevisionDates } from "./generateRevisionDates";
import { findAvailableSlots, type MinuteSlot } from "./findAvailableSlots";

export type PlannerCourse = Course & { course_sessions: CourseSession[]; exams: Exam[] };
export type ExistingStudy = { scheduled_date: string; start_time: string; end_time: string; status: string };
export type ScheduleInput = { courses: PlannerCourse[]; availability: Availability[]; existing: ExistingStudy[]; intervals: number[]; courseStart: string; courseEnd: string; planningStart: string; planningEnd: string; includeOverdue: boolean };
export type PlannedRevision = { courseId: string; sourceId: string; courseDate: string; stage: number; durationMinutes: number; desiredDate: string; scheduledDate: string; startTime: string; endTime: string };
export type UnscheduledRevision = { courseId: string; courseDate: string; durationMinutes: number; reason: string };
const DAY = 86_400_000;
function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") throw new Error("Date invalide.");
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) throw new Error("Date invalide.");
  return timestamp / DAY;
}
const date = (value: number) => new Date(value * DAY).toISOString().slice(0, 10);
const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
function slot(start: string, end: string): MinuteSlot {
  const a = timeToMinutes(start), b = timeToMinutes(end);
  if (a === null || b === null || b <= a) throw new Error("Horaire invalide.");
  return { start: a, end: b };
}

export function generateSchedule(input: ScheduleInput) {
  const cs = day(input.courseStart), ce = day(input.courseEnd), ps = day(input.planningStart), pe = day(input.planningEnd);
  if (ce < cs || pe < ps || ce - cs > 365 || pe - ps > 90) throw new Error("Limite : 366 jours de cours et 91 jours de planification.");
  const free = new Map<number, MinuteSlot[]>();
  for (let d = ps; d <= pe; d++) {
    const weekday = new Date(d * DAY).getUTCDay() || 7;
    const availability = input.availability.filter((a) => a.day_of_week === weekday).map((a) => slot(a.start_time, a.end_time));
    const busy = input.courses.flatMap((c) => [
      ...(d >= cs && d <= ce ? c.course_sessions.filter((s) => s.day_of_week === weekday).map((s) => slot(s.start_time, s.end_time)) : []),
      ...c.exams.filter((e) => e.exam_date === date(d)).map((e) => slot(e.start_time, e.end_time)),
    ]);
    busy.push(...input.existing.filter((s) => s.scheduled_date === date(d) && s.status !== "cancelled").map((s) => slot(s.start_time, s.end_time)));
    free.set(d, findAvailableSlots(availability, busy));
  }
  const tasks: (Omit<PlannedRevision, "scheduledDate" | "startTime" | "endTime"> & { earliest: number; latest: number; target: number })[] = [];
  const unscheduled: UnscheduledRevision[] = [];
  let excludedMinutes = 0, occurrences = 0;
  for (let d = cs; d <= Math.min(ce, pe); d++) {
    const weekday = new Date(d * DAY).getUTCDay() || 7;
    for (const course of input.courses) for (const source of course.course_sessions.filter((s) => s.day_of_week === weekday)) {
      occurrences++;
      const minutes = calculateStudyTime(sessionMinutes(source.start_time, source.end_time) ?? 0, course.revision_multiplier);
      if (minutes === null) throw new Error("Charge de révision invalide.");
      const generated = generateRevisionDates(date(d), minutes, input.intervals, course.exams.map((e) => e.exam_date));
      if (generated.reason === "invalid") throw new Error("Intervalles ou dates de révision invalides.");
      if (generated.reason === "no_window") { unscheduled.push({ courseId: course.id, courseDate: date(d), durationMinutes: minutes, reason: "Aucun jour avant l’examen" }); continue; }
      for (const revision of generated.revisions) {
        const target = day(revision.scheduledDate);
        if (target < ps && !input.includeOverdue) { excludedMinutes += revision.durationMinutes; continue; }
        const latest = generated.examDate ? Math.min(pe, day(generated.examDate) - 1) : pe;
        tasks.push({ courseId: course.id, sourceId: source.id, courseDate: date(d), stage: [...input.intervals].sort((a,b) => a-b).indexOf(revision.intervalDays) + 1, durationMinutes: revision.durationMinutes, desiredDate: revision.scheduledDate, earliest: Math.max(ps, d + 1), latest, target });
      }
    }
  }
  tasks.sort((a,b) => a.latest - b.latest || a.target - b.target || a.courseId.localeCompare(b.courseId) || a.sourceId.localeCompare(b.sourceId));
  const planned: PlannedRevision[] = [];
  for (const task of tasks) {
    const candidates: number[] = [];
    for (let d = Math.max(task.earliest, task.target); d <= task.latest; d++) candidates.push(d);
    for (let d = Math.min(task.target - 1, task.latest); d >= task.earliest; d--) candidates.push(d);
    let placed = false;
    for (const d of candidates) {
      const slots = free.get(d)!;
      const available = slots.find((s) => s.end - s.start >= task.durationMinutes);
      if (!available) continue;
      const start = available.start;
      available.start += task.durationMinutes;
      planned.push({ courseId: task.courseId, sourceId: task.sourceId, courseDate: task.courseDate, stage: task.stage, durationMinutes: task.durationMinutes, desiredDate: task.desiredDate, scheduledDate: date(d), startTime: time(start), endTime: time(available.start) });
      placed = true; break;
    }
    if (!placed) unscheduled.push({ courseId: task.courseId, courseDate: task.courseDate, durationMinutes: task.durationMinutes, reason: "Aucun créneau assez long dans la période avant l’examen" });
  }
  planned.sort((a,b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime));
  return { planned, unscheduled, excludedMinutes, occurrences };
}
