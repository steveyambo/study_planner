import { requireUser } from "@/lib/supabase/require-user";
import { loadCourseOccurrences, loadStudySessions } from "@/lib/supabase/load-study-sessions";
import { AppShell } from "@/components/layout/app-shell";
import { Planner, type PlanningPreferences } from "@/components/calendar/planner";
import { DEFAULT_REVISION_INTERVALS } from "@/lib/scheduler/revision-intervals";
import { todayInTimezone } from "@/lib/utils/calendar-date";
import type { PlannerCourse, ExistingStudy } from "@/lib/scheduler/generateSchedule";
import type { Availability } from "@/types/availability";
import { formatCalendarDate } from "@/lib/utils/calendar-date";

type SavedStudy = ExistingStudy & { id: string; course_code_snapshot?: string | null; duration_minutes: number; revision_stage: number };

export const metadata = { title: "Planification | Study Planner" };
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { supabase, userId } = await requireUser();
  const [profile, courses, availability, rules, existing, occurrences] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("courses").select("*,course_sessions(*),exams(*)").eq("user_id", userId),
    supabase.from("availabilities").select("id,day_of_week,start_time,end_time").eq("user_id", userId),
    supabase.from("revision_rules").select("intervals").eq("user_id", userId).maybeSingle(),
    loadStudySessions(supabase, userId),
    loadCourseOccurrences(supabase, userId),
  ]);
  if ([profile, courses, availability, rules].some((response) => response.error)) throw new Error("Impossible de charger les données de planification.");
  const { result } = await searchParams;
  const messages: Record<string, string> = {
    saved: "Planning enregistré. Les anciennes propositions ont été remplacées sans s’accumuler. Les séances terminées et manquées sont conservées.",
    migration: "Applique la migration 202610030003_clean_schedule_history.sql dans Supabase, après les trois migrations précédentes, avant de sauvegarder.",
    changed: "Tes données ont changé depuis cet aperçu. Recalcule le planning avant de l’enregistrer.",
    invalid: "Choisis une période de planning à partir de demain.",
    conflict: "Enregistrement refusé : vérifie les horaires et recalcule l’aperçu. Aucune sauvegarde partielle n’a été effectuée.",
    failed: "Impossible d’enregistrer le planning. Vérifie les paramètres et réessaie.",
  };
  const planningRevision = profile.data?.planning_revision == null || profile.data?.planning_history_version !== 1 || occurrences === null ? null : String(profile.data.planning_revision);
  const hasSavedPlanning = profile.data?.saved_planning_revision != null || !!existing.length;
  const isOutdated = hasSavedPlanning && planningRevision !== String(profile.data?.saved_planning_revision);
  const studies = existing as SavedStudy[];
  const today = todayInTimezone(profile.data?.timezone ?? "America/New_York");
  const preferences = profile.data?.planning_preferences as PlanningPreferences | null;
  const savedStart = preferences?.planningStart;
  const savedEnd = preferences?.planningEnd;
  const hasSavedWindow = typeof savedStart === "string" && typeof savedEnd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(savedStart) && /^\d{4}-\d{2}-\d{2}$/.test(savedEnd);
  const savedPeriodLabel = hasSavedWindow ? ` du ${formatCalendarDate(savedStart)} au ${formatCalendarDate(savedEnd)}` : "";
  const outsideWindow = hasSavedWindow ? studies.filter((study) => study.status === "planned" && study.scheduled_date > today && (study.scheduled_date < savedStart || study.scheduled_date > savedEnd)).length : 0;
  const currentStudies = studies.filter((study) => study.status === "planned" || study.status === "completed");
  const historicalStudies = studies.filter((study) => study.status === "cancelled" || study.status === "missed");
  const renderStudy = (study: SavedStudy) => <li key={study.id} className="rounded-lg border border-slate-200 bg-white p-4">
    <p className="font-semibold">{study.course_code_snapshot ?? courses.data?.find((course) => course.id === study.course_id)?.code ?? "Cours archivé"} · {formatCalendarDate(study.scheduled_date)} · {study.start_time.slice(0,5)}–{study.end_time.slice(0,5)}</p>
    <p className="mt-1 text-sm text-slate-600">{study.source_course_date && `Cours du ${formatCalendarDate(study.source_course_date)} · `}Révision {study.revision_stage} · {study.duration_minutes} min · {study.status === "planned" ? "Planifiée" : study.status === "completed" ? "Terminée" : study.status === "missed" ? "Manquée" : study.cancellation_reason === "replanned" ? "Annulée après replanification" : study.cancellation_reason === "course_archived" ? "Annulée : cours archivé" : "Annulée"}</p>
  </li>;
  return <AppShell fullName={profile.data?.full_name ?? ""} activePage="calendar">
    <h1 className="text-3xl font-bold">Planification</h1>
    <p className="mt-3 text-slate-600">Réunis les séances de tous tes cours et calcule un planning dans tes disponibilités.</p>
    {result && Object.hasOwn(messages, result) && <p role="status" className="mt-5 rounded-lg bg-indigo-50 p-4 text-indigo-950">{messages[result]}</p>}
    {planningRevision === null ? <p role="status" className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-950">La replanification nécessite la migration 202610030003_clean_schedule_history.sql. Tu peux calculer un aperçu ; applique cette migration dans Supabase avant de l’enregistrer.</p> : isOutdated ? <p role="status" className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-950">Planning à recalculer : tes cours, horaires, examens, disponibilités, paramètres ou séances ont changé depuis la dernière sauvegarde. Calcule un aperçu puis enregistre-le pour mettre à jour les révisions futures de la période choisie.</p> : hasSavedPlanning ? <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-950">Les données n’ont pas changé depuis la dernière sauvegarde{savedPeriodLabel}. Tu peux choisir une autre période ou recalculer le planning.</p> : null}
    {outsideWindow > 0 && <p role="status" className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-950">{outsideWindow} révisions futures sont conservées hors de la dernière période mise à jour{savedPeriodLabel}. Vérifie leurs créneaux ou élargis la prochaine replanification après une modification des données.</p>}
    {!!studies.length && <section className="mt-8 space-y-3"><h2 className="text-xl font-semibold">Séances enregistrées</h2>
      {currentStudies.length > 0 ? <ul className="space-y-3">{currentStudies.map(renderStudy)}</ul> : <p className="text-sm text-slate-600">Aucune séance encore planifiée ou terminée à afficher.</p>}
      {historicalStudies.length > 0 && <details className="rounded-lg border border-slate-200 bg-slate-50 p-4"><summary className="cursor-pointer font-medium text-indigo-700">Historique ({historicalStudies.length})</summary><p className="mt-3 text-sm text-slate-600">Séances manquées ou annulées, conservées pour le suivi.</p><ul className="mt-3 space-y-3">{historicalStudies.map(renderStudy)}</ul></details>}
    </section>}
    <Planner today={today} planningRevision={planningRevision} defaults={preferences} data={{ courses: (courses.data ?? []) as PlannerCourse[], availability: (availability.data ?? []) as Availability[], existing, occurrences: occurrences ?? [], intervals: rules.data?.intervals ?? DEFAULT_REVISION_INTERVALS }} />
  </AppShell>;
}
