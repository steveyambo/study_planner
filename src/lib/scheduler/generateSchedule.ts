import type { Course, CourseSession } from "@/types/course";
import type { Exam } from "@/types/exam";
import type { Availability } from "@/types/availability";
import { sessionMinutes, timeToMinutes } from "@/lib/courses/session-time";
import { calculateStudyTime } from "./calculateStudyTime";
import { generateRevisionDates } from "./generateRevisionDates";
import { findAvailableSlots, type MinuteSlot } from "./findAvailableSlots";

export type PlannerCourse = Course & { course_sessions: CourseSession[]; exams: Exam[] };
export type ExistingStudy = { scheduled_date: string; start_time: string; end_time: string; status: string };
export type ScheduleInput = { courses: PlannerCourse[]; availability: Availability[]; existing: ExistingStudy[]; intervals: number[]; courseStart: string; courseEnd: string; planningStart: string; planningEnd: string; includeOverdue: boolean; breakMinutes?: number };
export type PlannedRevision = { courseId: string; sourceId: string; courseDate: string; stage: number; durationMinutes: number; desiredDate: string; scheduledDate: string; startTime: string; endTime: string };
export type UnscheduledReason = "exam_window" | "planning_end" | "spacing" | "capacity" | "series_capacity" | "previous_unplaced";
export type UnscheduledRevision = { courseId: string; courseDate: string; durationMinutes: number; stage?: number; reasonCode: UnscheduledReason; reason: string };
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
  const breakMinutes = input.breakMinutes ?? 15;
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 60) throw new Error("La pause doit être un entier entre 0 et 60 minutes.");
  const withBreak = (study: MinuteSlot): MinuteSlot => ({ start: study.start - breakMinutes, end: study.end + breakMinutes });
  const existingStudies = input.existing.filter((s) => s.status !== "cancelled").map((s) => ({ day: day(s.scheduled_date), slot: withBreak(slot(s.start_time, s.end_time)) }));
  const free = new Map<number, MinuteSlot[]>();
  for (let d = ps; d <= pe; d++) {
    const weekday = new Date(d * DAY).getUTCDay() || 7;
    const availability = input.availability.filter((a) => a.day_of_week === weekday).map((a) => slot(a.start_time, a.end_time));
    const busy = input.courses.flatMap((c) => [
      ...(d >= cs && d <= ce ? c.course_sessions.filter((s) => s.day_of_week === weekday).map((s) => slot(s.start_time, s.end_time)) : []),
      ...c.exams.filter((e) => e.exam_date === date(d)).map((e) => slot(e.start_time, e.end_time)),
    ]);
    for (const study of existingStudies) {
      if (study.day === d) busy.push(study.slot);
      if (study.day === d - 1 && study.slot.end > 1440) busy.push({ start: 0, end: study.slot.end - 1440 });
      if (study.day === d + 1 && study.slot.start < 0) busy.push({ start: 1440 + study.slot.start, end: 1440 });
    }
    free.set(d, findAvailableSlots(availability, busy));
  }
  type Task = Omit<PlannedRevision, "scheduledDate" | "startTime" | "endTime"> & { earliest: number; latest: number; target: number; intervalDays: number; examDate: string | null; remaining: number };
  const tasks: Task[] = [];
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
      if (generated.reason === "no_window") { unscheduled.push({ courseId: course.id, courseDate: date(d), durationMinutes: minutes, reasonCode: "exam_window", reason: `Aucun jour entre le cours et l’examen du ${generated.examDate}` }); continue; }
      const occurrenceTasks: Task[] = [];
      for (const revision of generated.revisions) {
        const target = day(revision.scheduledDate);
        if (target < ps && !input.includeOverdue) { excludedMinutes += revision.durationMinutes; continue; }
        const latest = generated.examDate ? Math.min(pe, day(generated.examDate) - 1) : pe;
        occurrenceTasks.push({ courseId: course.id, sourceId: source.id, courseDate: date(d), stage: [...input.intervals].sort((a,b) => a-b).indexOf(revision.intervalDays) + 1, durationMinutes: revision.durationMinutes, desiredDate: revision.scheduledDate, earliest: Math.max(ps, d + 1), latest, target, intervalDays: revision.intervalDays, examDate: generated.examDate, remaining: 0 });
      }
      // Garder au moins un jour pour chacune des répétitions suivantes dans cet horizon.
      for (const [index, task] of occurrenceTasks.entries()) {
        task.remaining = occurrenceTasks.slice(index + 1).filter((later) => later.target <= pe).length;
        tasks.push(task);
      }
    }
  }
  tasks.sort((a,b) => a.latest - b.latest || a.target - b.target || a.courseId.localeCompare(b.courseId) || a.sourceId.localeCompare(b.sourceId) || a.courseDate.localeCompare(b.courseDate) || a.stage - b.stage);
  const planned: PlannedRevision[] = [];
  const occurrenceKey = (task: Task) => JSON.stringify([task.courseId, task.sourceId, task.courseDate]);
  const series = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = occurrenceKey(task);
    const group = series.get(key) ?? [];
    group.push(task);
    series.set(key, group);
  }
  // Vérifier les jours réellement libres pour les prochaines répétitions avant de réserver.
  const leavesRoomForLater = (task: Task, scheduledDay: number) => {
    let last = scheduledDay;
    for (const later of series.get(occurrenceKey(task))!) {
      if (later.stage <= task.stage || later.target > pe) continue;
      let found = false;
      for (let d = Math.max(last + 1, later.earliest); d <= later.latest; d++) {
        if (free.get(d)?.some((s) => s.end - s.start >= later.durationMinutes)) {
          last = d; found = true; break;
        }
      }
      if (!found) return false;
    }
    return true;
  };
  const previous = new Map<string, { day: number; intervalDays: number }>();
  const blocked = new Set<string>();
  for (const task of tasks) {
    const key = occurrenceKey(task);
    const fail = (reasonCode: UnscheduledReason, reason: string) => {
      unscheduled.push({ courseId: task.courseId, courseDate: task.courseDate, durationMinutes: task.durationMinutes, stage: task.stage, reasonCode, reason });
      blocked.add(key);
    };
    if (task.target > pe) {
      fail("planning_end", `Date prévue le ${task.desiredDate}, après la fin du planning (${input.planningEnd}). Prolonge la période pour l’inclure.`);
      continue;
    }
    if (task.latest < task.earliest) {
      fail("exam_window", `Aucun jour dans le planning avant l’examen du ${task.examDate}.`);
      continue;
    }
    if (blocked.has(key)) {
      fail("previous_unplaced", "Une répétition précédente de cette séance de cours n’a pas pu être placée. Elle doit être planifiée d’abord.");
      continue;
    }
    const prior = previous.get(key);
    const earliest = Math.max(task.earliest, prior ? prior.day + 1 : task.earliest);
    const latest = task.latest - task.remaining;
    if (earliest > latest) {
      const limit = task.examDate && day(task.examDate) - 1 <= pe ? `l’examen du ${task.examDate}` : `la fin du planning (${input.planningEnd})`;
      fail("spacing", `Pas assez de jours distincts pour espacer les répétitions avant ${limit}.`);
      continue;
    }
    // En rattrapage, reporter les écarts souhaités à partir de la répétition précédente.
    const target = Math.max(task.target, prior ? prior.day + task.intervalDays - prior.intervalDays : earliest);
    const candidates: number[] = [];
    for (let d = Math.max(earliest, target); d <= latest; d++) candidates.push(d);
    for (let d = Math.min(target - 1, latest); d >= earliest; d--) candidates.push(d);
    let placed = false;
    let blockedByLater = false;
    for (const d of candidates) {
      const slots = free.get(d)!;
      const available = slots.find((s) => s.end - s.start >= task.durationMinutes);
      if (!available) continue;
      if (!leavesRoomForLater(task, d)) { blockedByLater = true; continue; }
      const start = available.start;
      const end = start + task.durationMinutes;
      const occupied = withBreak({ start, end });
      free.set(d, findAvailableSlots(slots, [occupied]));
      if (occupied.start < 0 && free.has(d - 1)) free.set(d - 1, findAvailableSlots(free.get(d - 1)!, [{ start: 1440 + occupied.start, end: 1440 }]));
      if (occupied.end > 1440 && free.has(d + 1)) free.set(d + 1, findAvailableSlots(free.get(d + 1)!, [{ start: 0, end: occupied.end - 1440 }]));
      previous.set(key, { day: d, intervalDays: task.intervalDays });
      planned.push({ courseId: task.courseId, sourceId: task.sourceId, courseDate: task.courseDate, stage: task.stage, durationMinutes: task.durationMinutes, desiredDate: task.desiredDate, scheduledDate: date(d), startTime: time(start), endTime: time(end) });
      placed = true; break;
    }
    if (!placed) {
      const limit = task.examDate && day(task.examDate) - 1 <= pe ? `avant l’examen du ${task.examDate}` : `jusqu’à la fin du planning (${input.planningEnd})`;
      if (blockedByLater) fail("series_capacity", `Les créneaux libres ne permettent pas de placer cette répétition et les suivantes sur des jours distincts, avec les pauses de ${breakMinutes} min, ${limit}.`);
      else fail("capacity", `Aucun créneau libre de ${task.durationMinutes} min, avec une pause de ${breakMinutes} min entre révisions, du ${date(earliest)} au ${date(latest)} (${limit}).`);
    }
  }
  planned.sort((a,b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime));
  return { planned, unscheduled, excludedMinutes, occurrences };
}
