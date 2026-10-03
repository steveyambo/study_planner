import { requireUser } from "@/lib/supabase/require-user";
import { AppShell } from "@/components/layout/app-shell";
import { Planner } from "@/components/calendar/planner";
import { DEFAULT_REVISION_INTERVALS } from "@/lib/scheduler/revision-intervals";
import { todayInTimezone } from "@/lib/utils/calendar-date";
import type { PlannerCourse, ExistingStudy } from "@/lib/scheduler/generateSchedule";
import type { Availability } from "@/types/availability";

export const metadata = { title: "Planification | Study Planner" };
export default async function CalendarPage() {
  const { supabase, userId } = await requireUser();
  const [profile, courses, availability, rules, existing] = await Promise.all([
    supabase.from("profiles").select("full_name,timezone").eq("id", userId).maybeSingle(),
    supabase.from("courses").select("id,code,name,color,revision_multiplier,course_sessions(*),exams(*)").eq("user_id", userId),
    supabase.from("availabilities").select("id,day_of_week,start_time,end_time").eq("user_id", userId),
    supabase.from("revision_rules").select("intervals").eq("user_id", userId).maybeSingle(),
    supabase.from("study_sessions").select("scheduled_date,start_time,end_time,status").eq("user_id", userId),
  ]);
  if ([profile, courses, availability, rules, existing].some((response) => response.error)) throw new Error("Impossible de charger les données de planification.");
  return <AppShell fullName={profile.data?.full_name ?? ""} activePage="calendar">
    <h1 className="text-3xl font-bold">Planification</h1>
    <p className="mt-3 text-slate-600">Réunis les séances de tous tes cours et calcule un planning dans tes disponibilités.</p>
    <Planner today={todayInTimezone(profile.data?.timezone ?? "America/New_York")} data={{ courses: (courses.data ?? []) as PlannerCourse[], availability: (availability.data ?? []) as Availability[], existing: (existing.data ?? []) as ExistingStudy[], intervals: rules.data?.intervals ?? DEFAULT_REVISION_INTERVALS }} />
  </AppShell>;
}
