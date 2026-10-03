import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";
import { generateSchedule, type PlannerCourse, type ExistingStudy } from "@/lib/scheduler/generateSchedule";
import { DEFAULT_REVISION_INTERVALS } from "@/lib/scheduler/revision-intervals";
import { todayInTimezone } from "@/lib/utils/calendar-date";
import type { Availability } from "@/types/availability";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return new NextResponse("Requête non autorisée", { status: 403 });
  const { supabase, userId } = await requireUser();
  let result = "failed";
  try {
    const fields = await request.formData();
    const [profile, courses, availability, rules, existing] = await Promise.all([
      supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
      supabase.from("courses").select("id,code,name,color,revision_multiplier,course_sessions(*),exams(*)").eq("user_id", userId),
      supabase.from("availabilities").select("id,day_of_week,start_time,end_time").eq("user_id", userId),
      supabase.from("revision_rules").select("intervals").eq("user_id", userId).maybeSingle(),
      supabase.from("study_sessions").select("scheduled_date,start_time,end_time,status").eq("user_id", userId),
    ]);
    if ([profile, courses, availability, rules, existing].some((r) => r.error)) throw new Error("read_failed");
    const planningStart = String(fields.get("planningStart") ?? "");
    if (planningStart <= todayInTimezone(profile.data?.timezone ?? "America/New_York")) result = "invalid";
    else if (existing.data?.some((s) => s.status !== "cancelled")) result = "exists";
    else {
      const courseStart = String(fields.get("courseStart") ?? "");
      const courseEnd = String(fields.get("courseEnd") ?? "");
      const breakMinutes = Number(fields.get("breakMinutes"));
      const schedule = generateSchedule({ courses: (courses.data ?? []) as PlannerCourse[], availability: (availability.data ?? []) as Availability[], existing: (existing.data ?? []) as ExistingStudy[], intervals: rules.data?.intervals ?? DEFAULT_REVISION_INTERVALS,
        courseStart, courseEnd, planningStart, planningEnd: String(fields.get("planningEnd") ?? ""), includeOverdue: fields.get("includeOverdue") === "on", breakMinutes });
      if (!schedule.planned.length) result = "empty";
      else if (String(fields.get("preview") ?? "") !== JSON.stringify(schedule.planned)) result = "changed";
      else {
        const rows = schedule.planned.map((s) => ({ course_id: s.courseId, source_course_session_id: s.sourceId, source_course_date: s.courseDate,
          scheduled_date: s.scheduledDate, start_time: s.startTime, end_time: s.endTime, duration_minutes: s.durationMinutes, revision_stage: s.stage }));
        const { error } = await supabase.rpc("save_initial_schedule", { p_sessions: rows, p_break_minutes: breakMinutes, p_course_start: courseStart, p_course_end: courseEnd });
        result = !error ? "saved" : error.code === "PGRST202" ? "migration" : error.message?.includes("schedule_exists") ? "exists" : "conflict";
      }
    }
  } catch { result = "failed"; }
  const response = NextResponse.redirect(new URL(`/calendar?result=${result}`, request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
