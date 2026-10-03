import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { loadCourseOccurrences, loadStudySessions } from "@/lib/supabase/load-study-sessions";
import { generateSchedule, type PlannerCourse } from "@/lib/scheduler/generateSchedule";
import { DEFAULT_REVISION_INTERVALS } from "@/lib/scheduler/revision-intervals";
import { todayInTimezone } from "@/lib/utils/calendar-date";
import type { Availability } from "@/types/availability";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase, userId } = await requireUser();
  let result = "failed";
  try {
    const fields = await request.formData();
    const [profile, courses, availability, rules, existing, occurrences] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("courses").select("*,course_sessions(*),exams(*)").eq("user_id", userId),
      supabase.from("availabilities").select("id,day_of_week,start_time,end_time").eq("user_id", userId),
      supabase.from("revision_rules").select("intervals").eq("user_id", userId).maybeSingle(),
      loadStudySessions(supabase, userId),
      loadCourseOccurrences(supabase, userId),
    ]);
    if ([profile, courses, availability, rules].some((r) => r.error)) throw new Error("read_failed");
    const planningStart = String(fields.get("planningStart") ?? "");
    const today = todayInTimezone(profile.data?.timezone ?? "America/New_York");
    const revision = profile.data?.planning_revision;
    const expectedRevision = String(fields.get("expectedRevision") ?? "");
    if (revision === undefined || revision === null || profile.data?.planning_history_version !== 1 || profile.data?.course_period_version !== 1 || occurrences === null) result = "migration";
    else if (!/^\d+$/.test(expectedRevision) || expectedRevision !== String(revision)) result = "changed";
    else if (planningStart <= today) result = "invalid";
    else {
      const courseStart = String(fields.get("courseStart") ?? "");
      const courseEnd = String(fields.get("courseEnd") ?? "");
      const breakMinutes = Number(fields.get("breakMinutes"));
      const planningEnd = String(fields.get("planningEnd") ?? "");
      const includeOverdue = fields.get("includeOverdue") === "on";
      const schedule = generateSchedule({ courses: (courses.data ?? []) as PlannerCourse[], availability: (availability.data ?? []) as Availability[], existing, occurrences, intervals: rules.data?.intervals ?? DEFAULT_REVISION_INTERVALS,
        today, courseStart, courseEnd, planningStart, planningEnd, includeOverdue, breakMinutes });
      if (String(fields.get("preview") ?? "") !== JSON.stringify(schedule.planned)) result = "changed";
      else {
        const rows = schedule.planned.map((s) => ({ course_id: s.courseId, source_course_session_id: s.sourceId, source_course_date: s.courseDate,
          scheduled_date: s.scheduledDate, start_time: s.startTime, end_time: s.endTime, duration_minutes: s.durationMinutes, revision_stage: s.stage, revision_interval_days: s.intervalDays }));
        const { error } = await supabase.rpc("replace_schedule", { p_sessions: rows, p_break_minutes: breakMinutes, p_course_start: courseStart, p_course_end: courseEnd,
          p_planning_start: planningStart, p_planning_end: planningEnd, p_expected_revision: expectedRevision, p_include_overdue: includeOverdue });
        result = !error ? "saved" : error.code === "PGRST202" ? "migration" : error.message?.includes("stale_revision") ? "changed" : "conflict";
      }
    }
  } catch { result = "failed"; }
  const response = NextResponse.redirect(new URL(`/calendar?result=${result}`, request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
