import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseOccurrence, ExistingStudy } from "@/lib/scheduler/generateSchedule";

// PostgREST peut plafonner une page en dessous de la taille demandée.
export async function loadStudySessions(supabase: SupabaseClient, userId: string): Promise<ExistingStudy[]> {
  const studies: ExistingStudy[] = [];
  let offset = 0;
  while (true) {
    const page = await supabase.from("study_sessions").select("*").eq("user_id", userId)
      .order("scheduled_date").order("start_time").order("id").range(offset, offset + 999);
    if (page.error || page.data === null) throw new Error("Impossible de charger toutes les séances enregistrées.");
    if (page.data.length === 0) return studies;
    studies.push(...page.data as ExistingStudy[]);
    offset += page.data.length;
  }
}

export async function loadCourseOccurrences(supabase: SupabaseClient, userId: string): Promise<CourseOccurrence[] | null> {
  const occurrences: CourseOccurrence[] = [];
  let offset = 0;
  while (true) {
    const page = await supabase.from("course_occurrences").select("*").eq("user_id", userId)
      .order("source_course_date").order("id").range(offset, offset + 999);
    if (page.error?.code === "PGRST205" || page.error?.code === "42P01") return null;
    if (page.error || page.data === null) throw new Error("Impossible de charger les séances de cours d’origine.");
    if (page.data.length === 0) return occurrences;
    occurrences.push(...page.data as CourseOccurrence[]);
    offset += page.data.length;
  }
}
