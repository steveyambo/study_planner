import type { Course, CourseSession } from "@/types/course";
import type { Exam } from "@/types/exam";
import type { Availability } from "@/types/availability";
import { sessionMinutes, timeToMinutes } from "@/lib/courses/session-time";
import { calculateStudyTime } from "./calculateStudyTime";
import { calculatePriority } from "./calculatePriority";
import { generateRevisionDates } from "./generateRevisionDates";
import { findAvailableSlots, type MinuteSlot } from "./findAvailableSlots";

export type PlannerCourse = Course & { course_sessions: CourseSession[]; exams: Exam[] };
export type ExistingStudy = { scheduled_date: string; start_time: string; end_time: string; status: string; id?: string; course_id?: string; source_course_session_id?: string | null; source_course_session_key?: string | null; source_course_date?: string | null; revision_stage?: number; revision_interval_days?: number | null; duration_minutes?: number; source_start_time?: string | null; source_end_time?: string | null; cancellation_reason?: string | null };
export type CourseOccurrence = { course_id: string; source_course_session_key: string; source_course_date: string; source_start_time: string | null; source_end_time: string | null; is_obsolete: boolean };
export type ScheduleInput = { courses: PlannerCourse[]; availability: Availability[]; existing: ExistingStudy[]; occurrences?: CourseOccurrence[]; intervals: number[]; courseStart: string; courseEnd: string; planningStart: string; planningEnd: string; includeOverdue: boolean; breakMinutes?: number; today?: string };
export type PlannedRevision = { courseId: string; sourceId: string; courseDate: string; stage: number; intervalDays: number; durationMinutes: number; desiredDate: string; scheduledDate: string; startTime: string; endTime: string };
export type UnscheduledReason = "exam_window" | "planning_end" | "spacing" | "capacity" | "previous_unplaced";
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
  const activeCourses = input.courses.filter((course) => !course.archived_at);
  const periods = new Map(activeCourses.map((course) => {
    const start = course.starts_on ? day(course.starts_on) : cs;
    const end = course.ends_on ? day(course.ends_on) : ce;
    if (course.starts_on && course.ends_on && end < start) throw new Error("La fin d’une matière doit suivre son début.");
    return [course.id, { start: Math.max(cs, start), end: Math.min(ce, end) }];
  }));
  const sourceKey = (study: ExistingStudy) => study.source_course_session_key ?? study.source_course_session_id;
  const knownIdentity = (study: ExistingStudy) => !!(sourceKey(study) && study.source_course_date && study.course_id && study.revision_stage);
  const archivedIds = new Set(input.courses.filter((course) => course.archived_at).map((course) => course.id));
  const isFixed = (study: ExistingStudy) => {
    if (study.status === "completed") return true;
    if (study.status !== "planned") return false;
    if (input.today && study.scheduled_date < input.today) return false;
    if (input.today && study.course_id && archivedIds.has(study.course_id) && study.scheduled_date >= input.today) return false;
    // Anciennes séances sans identité : conserver leurs créneaux sans leur attribuer de charge.
    if (!knownIdentity(study)) return true;
    return study.scheduled_date < input.planningStart || study.scheduled_date > input.planningEnd;
  };
  const fixedStudies = input.existing.filter(isFixed);
  const existingStudies = fixedStudies.map((s) => ({ day: day(s.scheduled_date), slot: withBreak(slot(s.start_time, s.end_time)) }));
  const free = new Map<number, MinuteSlot[]>();
  for (let d = ps; d <= pe; d++) {
    const weekday = new Date(d * DAY).getUTCDay() || 7;
    const availability = input.availability.filter((a) => a.day_of_week === weekday).map((a) => slot(a.start_time, a.end_time));
    const busy = activeCourses.flatMap((c) => [
      ...(d >= periods.get(c.id)!.start && d <= periods.get(c.id)!.end ? c.course_sessions.filter((s) => s.day_of_week === weekday && (!s.effective_from || date(d) >= s.effective_from)).map((s) => slot(s.start_time, s.end_time)) : []),
      ...c.exams.filter((e) => e.exam_date === date(d)).map((e) => slot(e.start_time, e.end_time)),
    ]);
    for (const study of existingStudies) {
      if (study.day === d) busy.push(study.slot);
      if (study.day === d - 1 && study.slot.end > 1440) busy.push({ start: 0, end: study.slot.end - 1440 });
      if (study.day === d + 1 && study.slot.start < 0) busy.push({ start: 1440 + study.slot.start, end: 1440 });
    }
    free.set(d, findAvailableSlots(availability, busy));
  }
  type Task = Omit<PlannedRevision, "scheduledDate" | "startTime" | "endTime"> & { earliest: number; latest: number; target: number; preferredTarget: number; intervalDays: number; examDate: string | null };
  const tasks: Task[] = [];
  const unscheduled: UnscheduledRevision[] = [];
  let excludedMinutes = 0, occurrences = 0;
  const historical = new Map<string, ExistingStudy[]>();
  const trackedOccurrences = new Map((input.occurrences ?? []).filter((entry) => !entry.is_obsolete).map((entry) => [JSON.stringify([entry.course_id, entry.source_course_session_key, entry.source_course_date]), entry]));
  for (const study of input.existing) if (knownIdentity(study) && !(study.status === "cancelled" && study.cancellation_reason === "source_changed")) {
    const key = JSON.stringify([study.course_id, sourceKey(study), study.source_course_date]);
    const group = historical.get(key) ?? [];
    group.push(study); historical.set(key, group);
  }
  for (let d = cs; d <= Math.min(ce, pe); d++) {
    const weekday = new Date(d * DAY).getUTCDay() || 7;
    for (const course of activeCourses) for (const source of course.course_sessions) {
      const period = periods.get(course.id)!;
      if (d < period.start || d > period.end) continue;
      const key = JSON.stringify([course.id, source.id, date(d)]);
      const history = historical.get(key) ?? [];
      const occurrence = trackedOccurrences.get(key);
      const currentOccurrence = source.day_of_week === weekday && (!source.effective_from || date(d) >= source.effective_from);
      const historicalOccurrence = (!!occurrence || history.length > 0) && (!source.effective_from || date(d) < source.effective_from);
      if (!currentOccurrence && !historicalOccurrence) continue;
      occurrences++;
      const snapshot = historicalOccurrence ? occurrence ?? history.find((study) => study.source_start_time && study.source_end_time) : undefined;
      const minutes = calculateStudyTime(sessionMinutes(snapshot?.source_start_time ?? source.start_time, snapshot?.source_end_time ?? source.end_time) ?? 0, course.revision_multiplier);
      if (minutes === null) throw new Error("Charge de révision invalide.");
      const fixed = history.filter(isFixed);
      const retainedMinutes = fixed.reduce((sum, study) => sum + (study.duration_minutes ?? sessionMinutes(study.start_time, study.end_time) ?? 0), 0);
      const remainingMinutes = Math.max(0, minutes - retainedMinutes);
      if (!remainingMinutes) continue;
      const orderedIntervals = [...input.intervals].sort((a,b) => a-b);
      let stages = orderedIntervals.map((intervalDays, index) => ({ intervalDays, stage: index + 1 })).filter((entry) => !fixed.some((study) => study.revision_stage === entry.stage));
      const lastCompletedStage = Math.max(0, ...fixed.filter((study) => study.status === "completed").map((study) => study.revision_stage ?? 0));
      // Une répétition réalisée après des séances manquées reste acquise : rattraper la charge après elle.
      if (stages.some((entry) => entry.stage < lastCompletedStage)) {
        const lastRetainedStage = Math.max(orderedIntervals.length, ...fixed.map((study) => study.revision_stage ?? 0));
        stages = stages.map((entry, index) => ({ ...entry, stage: lastRetainedStage + index + 1 }));
      }
      // Si la charge augmente après toutes les répétitions terminées, ajouter une révision complémentaire.
      if (!stages.length && orderedIntervals.length) stages.push({ intervalDays: orderedIntervals.at(-1)!, stage: Math.max(orderedIntervals.length, ...fixed.map((s) => s.revision_stage ?? 0)) + 1 });
      const generated = generateRevisionDates(date(d), remainingMinutes, stages.map((entry) => entry.intervalDays), course.exams.map((e) => e.exam_date));
      if (generated.reason === "invalid") throw new Error("Intervalles ou dates de révision invalides.");
      if (generated.reason === "no_window") { unscheduled.push({ courseId: course.id, courseDate: date(d), durationMinutes: remainingMinutes, reasonCode: "exam_window", reason: `Aucun jour entre le cours et l’examen du ${generated.examDate}` }); continue; }
      for (const revision of generated.revisions) {
        const target = day(revision.scheduledDate);
        const stage = stages.find((entry) => entry.intervalDays === revision.intervalDays)!.stage;
        const previouslyPending = !!occurrence || history.some((study) => study.status === "planned" || study.status === "completed" || study.status === "missed" || study.cancellation_reason === "replanned");
        if (target < ps && !input.includeOverdue && !previouslyPending) { excludedMinutes += revision.durationMinutes; continue; }
        const earlierFixed = fixed.filter((study) => study.revision_stage! < stage).map((study) => day(study.scheduled_date) + 1);
        const laterFixed = fixed.filter((study) => study.revision_stage! > stage).map((study) => day(study.scheduled_date) - 1);
        const anchor = [...fixed].filter((study) => study.revision_stage! < stage).sort((a,b) => b.revision_stage! - a.revision_stage!)[0];
        const preferredTarget = anchor ? Math.max(target, day(anchor.scheduled_date) + Math.max(1, revision.intervalDays - (anchor.revision_interval_days ?? orderedIntervals[anchor.revision_stage! - 1] ?? revision.intervalDays))) : target;
        const latest = Math.min(pe, generated.examDate ? day(generated.examDate) - 1 : pe, ...laterFixed);
        tasks.push({ courseId: course.id, sourceId: source.id, courseDate: date(d), stage, durationMinutes: revision.durationMinutes, desiredDate: revision.scheduledDate, earliest: Math.max(ps, d + 1, ...earlierFixed), latest, target, preferredTarget, intervalDays: revision.intervalDays, examDate: generated.examDate });
      }
    }
  }
  const priorityKey = (task: Task) => JSON.stringify([task.courseId, task.examDate]);
  const loads = new Map<string, number>();
  for (const task of tasks) if (task.target <= pe && task.latest >= task.earliest) {
    const key = priorityKey(task);
    loads.set(key, (loads.get(key) ?? 0) + task.durationMinutes);
  }
  const priorities = new Map<string, number>();
  for (const task of tasks) {
    const key = priorityKey(task);
    if (priorities.has(key)) continue;
    const exams = input.courses.find((course) => course.id === task.courseId)!.exams.filter((exam) => exam.exam_date === task.examDate);
    const importance = exams.length ? Math.max(...exams.map((exam) => exam.importance)) : 1;
    const priority = calculatePriority(loads.get(key) ?? 0, task.examDate ? day(task.examDate) - ps : null, importance);
    if (priority === null) throw new Error("Charge ou importance d’examen invalide.");
    priorities.set(key, priority);
  }
  // Un score commun par cours/examen conserve l'ordre des répétitions d'une occurrence.
  tasks.sort((a,b) => priorities.get(priorityKey(b))! - priorities.get(priorityKey(a))! || a.latest - b.latest || a.target - b.target || a.courseId.localeCompare(b.courseId) || a.sourceId.localeCompare(b.sourceId) || a.courseDate.localeCompare(b.courseDate) || a.stage - b.stage);
  const planned: PlannedRevision[] = [];
  const occurrenceKey = (task: Task) => JSON.stringify([task.courseId, task.sourceId, task.courseDate]);
  const series = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = occurrenceKey(task);
    const group = series.get(key) ?? [];
    group.push(task);
    series.set(key, group);
  }
  // Favoriser la plus longue suite réalisable, sans exiger qu'elle soit complète.
  const countLaterThatFit = (task: Task, scheduledDay: number, endMinute: number) => {
    let last = scheduledDay;
    let end = endMinute;
    let count = 0;
    for (const later of series.get(occurrenceKey(task))!) {
      if (later.stage <= task.stage || later.target > pe) continue;
      let found = false;
      for (let d = Math.max(last + 1, later.earliest); d <= later.latest; d++) {
        let slots = free.get(d) ?? [];
        if (d === last + 1 && end + breakMinutes > 1440) slots = findAvailableSlots(slots, [{ start: 0, end: end + breakMinutes - 1440 }]);
        const available = slots.find((s) => s.end - s.start >= later.durationMinutes);
        if (available) {
          last = d; end = available.start + later.durationMinutes; count++; found = true; break;
        }
      }
      if (!found) break;
    }
    return count;
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
      if (task.examDate && day(task.examDate) - 1 < task.earliest) fail("exam_window", `Aucun jour dans le planning avant l’examen du ${task.examDate}.`);
      else fail("spacing", "Les séances conservées ne laissent aucun jour pour placer cette répétition dans l’ordre. Élargis la période à replanifier.");
      continue;
    }
    if (blocked.has(key)) {
      fail("previous_unplaced", "Une répétition précédente de cette séance de cours n’a pas pu être placée. Elle doit être planifiée d’abord.");
      continue;
    }
    const prior = previous.get(key);
    const earliest = Math.max(task.earliest, prior ? prior.day + 1 : task.earliest);
    const latest = task.latest;
    if (earliest > latest) {
      const limit = task.examDate && day(task.examDate) - 1 <= pe ? `l’examen du ${task.examDate}` : `la fin du planning (${input.planningEnd})`;
      fail("spacing", `Pas assez de jours distincts pour espacer les répétitions avant ${limit}.`);
      continue;
    }
    // En rattrapage, reporter les écarts souhaités à partir de la répétition précédente.
    const target = Math.max(task.preferredTarget, prior ? prior.day + task.intervalDays - prior.intervalDays : earliest);
    const candidates: number[] = [];
    for (let d = Math.max(earliest, target); d <= latest; d++) candidates.push(d);
    for (let d = Math.min(target - 1, latest); d >= earliest; d--) candidates.push(d);
    const maxLaterCount = series.get(key)!.filter((later) => later.stage > task.stage && later.target <= pe).length;
    let chosen: { day: number; start: number; end: number; laterCount: number } | undefined;
    for (const d of candidates) {
      const slots = free.get(d)!;
      const available = slots.find((s) => s.end - s.start >= task.durationMinutes);
      if (!available) continue;
      const start = available.start;
      const end = start + task.durationMinutes;
      const laterCount = countLaterThatFit(task, d, end);
      // Les candidats sont déjà ordonnés selon la date souhaitée : garder le premier en cas d'égalité.
      if (!chosen || laterCount > chosen.laterCount) chosen = { day: d, start, end, laterCount };
      if (laterCount === maxLaterCount) break;
    }
    if (chosen) {
      const { day: d, start, end } = chosen;
      const slots = free.get(d)!;
      const occupied = withBreak({ start, end });
      free.set(d, findAvailableSlots(slots, [occupied]));
      if (occupied.start < 0 && free.has(d - 1)) free.set(d - 1, findAvailableSlots(free.get(d - 1)!, [{ start: 1440 + occupied.start, end: 1440 }]));
      if (occupied.end > 1440 && free.has(d + 1)) free.set(d + 1, findAvailableSlots(free.get(d + 1)!, [{ start: 0, end: occupied.end - 1440 }]));
      previous.set(key, { day: d, intervalDays: task.intervalDays });
      planned.push({ courseId: task.courseId, sourceId: task.sourceId, courseDate: task.courseDate, stage: task.stage, intervalDays: task.intervalDays, durationMinutes: task.durationMinutes, desiredDate: task.desiredDate, scheduledDate: date(d), startTime: time(start), endTime: time(end) });
    } else {
      const limit = task.examDate && day(task.examDate) - 1 <= pe ? `avant l’examen du ${task.examDate}` : `jusqu’à la fin du planning (${input.planningEnd})`;
      fail("capacity", `Aucun créneau libre de ${task.durationMinutes} min, avec une pause de ${breakMinutes} min entre révisions, du ${date(earliest)} au ${date(latest)} (${limit}).`);
    }
  }
  planned.sort((a,b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime));
  return { planned, unscheduled, excludedMinutes, occurrences };
}
