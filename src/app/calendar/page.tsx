import { requireUser } from "@/lib/supabase/require-user";
import { AppShell } from "@/components/layout/app-shell";
import { Planner } from "@/components/calendar/planner";
import { DEFAULT_REVISION_INTERVALS } from "@/lib/scheduler/revision-intervals";
import { todayInTimezone } from "@/lib/utils/calendar-date";
import type { PlannerCourse, ExistingStudy } from "@/lib/scheduler/generateSchedule";
import type { Availability } from "@/types/availability";
import { formatCalendarDate } from "@/lib/utils/calendar-date";

export const metadata = { title: "Planification | Study Planner" };
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { supabase, userId } = await requireUser();
  const [profile, courses, availability, rules, existing] = await Promise.all([
    supabase.from("profiles").select("full_name,timezone").eq("id", userId).maybeSingle(),
    supabase.from("courses").select("id,code,name,color,revision_multiplier,course_sessions(*),exams(*)").eq("user_id", userId),
    supabase.from("availabilities").select("id,day_of_week,start_time,end_time").eq("user_id", userId),
    supabase.from("revision_rules").select("intervals").eq("user_id", userId).maybeSingle(),
    supabase.from("study_sessions").select("*").eq("user_id", userId).order("scheduled_date").order("start_time"),
  ]);
  if ([profile, courses, availability, rules, existing].some((response) => response.error)) throw new Error("Impossible de charger les données de planification.");
  const { result } = await searchParams;
  const messages: Record<string, string> = {
    saved: "Planning enregistré. Les séances restent disponibles après rechargement.",
    migration: "Applique la migration 202610030001_save_schedule.sql dans Supabase avant de sauvegarder.",
    exists: "Un planning existe déjà. Cette version conserve le planning enregistré et empêche une seconde génération.",
    changed: "Tes données ont changé depuis cet aperçu. Recalcule le planning avant de l’enregistrer.",
    empty: "Aucune séance à enregistrer.", invalid: "Choisis une période de planning à partir de demain.",
    conflict: "Enregistrement refusé : vérifie les horaires et recalcule l’aperçu. Aucune sauvegarde partielle n’a été effectuée.",
    failed: "Impossible d’enregistrer le planning. Vérifie les paramètres et réessaie.",
  };
  return <AppShell fullName={profile.data?.full_name ?? ""} activePage="calendar">
    <h1 className="text-3xl font-bold">Planification</h1>
    <p className="mt-3 text-slate-600">Réunis les séances de tous tes cours et calcule un planning dans tes disponibilités.</p>
    {result && Object.hasOwn(messages, result) && <p role="status" className="mt-5 rounded-lg bg-indigo-50 p-4 text-indigo-950">{messages[result]}</p>}
    {!!existing.data?.length && <section className="mt-8 space-y-3"><h2 className="text-xl font-semibold">Séances enregistrées</h2>
      <ul className="space-y-3">{existing.data.map((study) => <li key={study.id} className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="font-semibold">{courses.data?.find((course) => course.id === study.course_id)?.code ?? "Cours"} · {formatCalendarDate(study.scheduled_date)} · {study.start_time.slice(0,5)}–{study.end_time.slice(0,5)}</p>
        <p className="mt-1 text-sm text-slate-600">{study.source_course_date && `Cours du ${formatCalendarDate(study.source_course_date)} · `}Révision {study.revision_stage} · {study.duration_minutes} min · {study.status === "planned" ? "Planifiée" : study.status === "completed" ? "Terminée" : study.status === "missed" ? "Manquée" : "Annulée"}</p>
      </li>)}</ul></section>}
    <Planner today={todayInTimezone(profile.data?.timezone ?? "America/New_York")} data={{ courses: (courses.data ?? []) as PlannerCourse[], availability: (availability.data ?? []) as Availability[], existing: (existing.data ?? []) as ExistingStudy[], intervals: rules.data?.intervals ?? DEFAULT_REVISION_INTERVALS }} />
  </AppShell>;
}
