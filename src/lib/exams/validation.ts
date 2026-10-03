import { isCourseId } from "@/lib/courses/validation";
import { sessionMinutes } from "@/lib/courses/session-time";

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseExam(fields: FormData) {
  const course_id = String(fields.get("course_id") ?? "");
  const title = String(fields.get("title") ?? "").trim();
  const exam_date = String(fields.get("exam_date") ?? "");
  const start_time = String(fields.get("start_time") ?? "");
  const end_time = String(fields.get("end_time") ?? "");
  const importance = Number(fields.get("importance"));
  const notes = String(fields.get("notes") ?? "").trim();
  if (!isCourseId(course_id) || !title || title.length > 160 || !isCalendarDate(exam_date) ||
    sessionMinutes(start_time, end_time) === null || !Number.isInteger(importance) || importance < 1 || importance > 3 || notes.length > 2000) return null;
  return { course_id, title, exam_date, start_time, end_time, importance, notes };
}
