import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/supabase/require-user";
import { sessionMinutes } from "@/lib/courses/session-time";
import { todayInTimezone } from "@/lib/utils/calendar-date";
import type { SetupProgress } from "./setup-progress";

type SetupCourse = { id: string; code: string; name: string; archived_at: string | null; course_sessions: { id: string }[]; exams: { exam_date: string }[] };
type SetupAvailability = { id: string; start_time: string; end_time: string };

async function readAll<T>(supabase: SupabaseClient, table: "courses" | "availabilities", columns: string, userId: string): Promise<T[]> {
  const rows: T[] = [];
  while (true) {
    const page = await supabase.from(table).select(columns).eq("user_id", userId).order("id").range(rows.length, rows.length + 999);
    if (page.error || page.data === null) throw new Error("Impossible de vérifier les étapes du guide.");
    if (!page.data.length) return rows;
    rows.push(...page.data as unknown as T[]);
  }
}

export async function fetchSetupProgress(supabase: SupabaseClient, userId: string): Promise<{ fullName: string; progress: SetupProgress }> {
  const [profile, courses, availability, planned] = await Promise.all([
    supabase.from("profiles").select("full_name,timezone,planning_revision,saved_planning_revision").eq("id", userId).maybeSingle(),
    readAll<SetupCourse>(supabase, "courses", "id,code,name,archived_at,course_sessions(id),exams(exam_date)", userId),
    readAll<SetupAvailability>(supabase, "availabilities", "id,start_time,end_time", userId),
    supabase.from("study_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "planned"),
  ]);
  if (profile.error || !profile.data || planned.error || planned.count === null) throw new Error("Impossible de vérifier les étapes du guide.");
  const activeCourses = courses.filter((course) => !course.archived_at);
  const today = todayInTimezone(profile.data.timezone ?? "America/New_York");
  const hasSavedPlanning = profile.data.saved_planning_revision != null;
  return {
    fullName: profile.data.full_name ?? "",
    progress: {
      courseCount: activeCourses.length,
      coursesWithoutHours: activeCourses.filter((course) => !course.course_sessions.length).map(({ id, code, name }) => ({ id, code, name })),
      weeklySessionCount: activeCourses.reduce((count, course) => count + course.course_sessions.length, 0),
      availabilityCount: availability.length,
      weeklyAvailableMinutes: availability.reduce((minutes, slot) => minutes + (sessionMinutes(slot.start_time, slot.end_time) ?? 0), 0),
      upcomingExamCount: activeCourses.reduce((count, course) => count + course.exams.filter((exam) => exam.exam_date >= today).length, 0),
      hasSavedPlanning,
      planningIsCurrent: hasSavedPlanning && profile.data.planning_revision != null && String(profile.data.saved_planning_revision) === String(profile.data.planning_revision),
      plannedSessionCount: planned.count,
    },
  };
}

// React cache ne partage ces données qu'au sein du rendu de la même requête.
export const loadSetupProgress = cache(async () => {
  const { supabase, userId } = await requireUser();
  return { userId, ...await fetchSetupProgress(supabase, userId) };
});
