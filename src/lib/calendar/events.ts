import type { CourseOccurrence, ExistingStudy, PlannerCourse } from "@/lib/scheduler/generateSchedule";

export type CalendarStudy = ExistingStudy & { id: string; course_code_snapshot?: string | null; course_name_snapshot?: string | null };
export type CalendarEvent = {
  id: string; kind: "course" | "revision" | "exam"; date: string; start: string; end: string;
  code: string; name: string; title: string; color: string; status?: string; sourceDate?: string | null;
};
export type CalendarData = {
  courses: PlannerCourse[]; studies: CalendarStudy[]; occurrences: CourseOccurrence[];
  courseStart?: string; courseEnd?: string;
};
export const calendarDate = (date: string) => new Date(`${date}T00:00:00Z`);
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
export function addDays(date: string, amount: number) {
  const value = calendarDate(date); value.setUTCDate(value.getUTCDate() + amount); return isoDate(value);
}
export function shiftMonth(date: string, amount: number) {
  const value = calendarDate(date), day = value.getUTCDate();
  value.setUTCDate(1); value.setUTCMonth(value.getUTCMonth() + amount);
  const last = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, last)); return isoDate(value);
}
export function calendarDays(anchor: string, view: "week" | "month") {
  const first = view === "month" ? `${anchor.slice(0, 7)}-01` : anchor;
  const start = addDays(first, -((calendarDate(first).getUTCDay() + 6) % 7));
  const end = view === "week" ? addDays(start, 6) : isoDate(new Date(Date.UTC(calendarDate(first).getUTCFullYear(), calendarDate(first).getUTCMonth() + 1, 0)));
  const count = view === "week" ? 7 : Math.ceil((Math.round((calendarDate(end).getTime() - calendarDate(start).getTime()) / 86400000) + 1) / 7) * 7;
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}
export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// Only expand recurring classes in the visible window; saved revisions keep their actual dates.
export function calendarEvents(data: CalendarData, days: string[]): CalendarEvent[] {
  if (!days.length) return [];
  const visible = new Set(days), events: CalendarEvent[] = [], known = new Set<string>();
  const courses = new Map(data.courses.map((course) => [course.id, course]));
  for (const study of data.studies) {
    if (!visible.has(study.scheduled_date) || !["planned", "completed", "missed"].includes(study.status)) continue;
    const course = courses.get(study.course_id ?? "");
    events.push({ id: `revision:${study.id}`, kind: "revision", date: study.scheduled_date,
      start: study.start_time, end: study.end_time, code: study.course_code_snapshot ?? course?.code ?? "Cours archivé",
      name: study.course_name_snapshot ?? course?.name ?? "", color: course?.color ?? "#6366f1",
      title: `Révision ${study.revision_stage ?? ""}`.trim(), status: study.status, sourceDate: study.source_course_date });
  }
  for (const occurrence of data.occurrences) {
    if (occurrence.is_obsolete || !visible.has(occurrence.source_course_date) || !occurrence.source_start_time || !occurrence.source_end_time) continue;
    const course = courses.get(occurrence.course_id);
    if (!course) continue;
    const key = `${occurrence.source_course_session_key}:${occurrence.source_course_date}`;
    known.add(key);
    events.push({ id: `course:${key}`, kind: "course", date: occurrence.source_course_date,
      start: occurrence.source_start_time, end: occurrence.source_end_time, code: course.code, name: course.name,
      color: course.color, title: "Cours" });
  }
  for (const course of data.courses) {
    if (course.archived_at) continue;
    const start = [data.courseStart, course.starts_on].filter((date): date is string => !!date).sort().at(-1);
    const end = [data.courseEnd, course.ends_on].filter((date): date is string => !!date).sort().at(0);
    if (start && end) for (const date of days) {
      if (date < start || date > end) continue;
      for (const session of course.course_sessions) {
        const key = `${session.id}:${date}`;
        if (known.has(key) || (session.effective_from && date < session.effective_from) || session.day_of_week !== (calendarDate(date).getUTCDay() || 7)) continue;
        events.push({ id: `course:${key}`, kind: "course", date, start: session.start_time, end: session.end_time,
          code: course.code, name: course.name, color: course.color, title: "Cours" });
      }
    }
    for (const exam of course.exams) if (visible.has(exam.exam_date)) events.push({
      id: `exam:${exam.id}`, kind: "exam", date: exam.exam_date, start: exam.start_time, end: exam.end_time,
      code: course.code, name: course.name, color: course.color, title: exam.title,
    });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

// Give simultaneous events separate columns, including short events with a minimum visual height.
export function eventColumns(events: CalendarEvent[]) {
  const groups: { event: CalendarEvent; lane: number; columns: number }[][] = [];
  let group: { event: CalendarEvent; lane: number; columns: number }[] = [], ends: number[] = [], groupEnd = -1;
  for (const event of [...events].sort((a, b) => a.start.localeCompare(b.start))) {
    const start = minutes(event.start), end = Math.max(minutes(event.end), start + 30);
    if (start >= groupEnd) { if (group.length) groups.push(group); group = []; ends = []; }
    let lane = ends.findIndex((value) => value <= start);
    if (lane === -1) lane = ends.length;
    ends[lane] = end; groupEnd = Math.max(...ends);
    group.push({ event, lane, columns: 1 });
  }
  if (group.length) groups.push(group);
  return groups.flatMap((items) => { const columns = Math.max(...items.map((item) => item.lane)) + 1; return items.map((item) => ({ ...item, columns })); });
}
