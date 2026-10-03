import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExistingStudy } from "@/lib/scheduler/generateSchedule";

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
