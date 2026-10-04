import { requireUser } from "@/lib/supabase/require-user";
import { loadCourseOccurrences, loadStudySessions } from "@/lib/supabase/load-study-sessions";
import { AppShell } from "@/components/layout/app-shell";
import { Planner, type PlanningPreferences } from "@/components/calendar/planner";
import { VisualCalendar } from "@/components/calendar/visual-calendar";
import { DEFAULT_REVISION_INTERVALS } from "@/lib/scheduler/revision-intervals";
import { todayInTimezone } from "@/lib/utils/calendar-date";
import type { PlannerCourse, ExistingStudy } from "@/lib/scheduler/generateSchedule";
import type { Availability } from "@/types/availability";
import { formatCalendarDate } from "@/lib/utils/calendar-date";
import { AlertCircle, CheckCircle2, ChevronDown, History, List, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMinutes } from "@/lib/courses/session-time";

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
    missed: "Séance signalée comme manquée. Calcule un nouvel aperçu puis enregistre-le pour préparer le rattrapage des cours concernés. Le travail terminé reste acquis ; aucun créneau de rattrapage n’a encore été enregistré.",
    daily_limit: "Enregistrement refusé : le maximum quotidien est dépassé. Recalcule l’aperçu avec une limite adaptée. L’ancien planning reste conservé.",
    saved: "Planning enregistré. Les anciennes propositions ont été remplacées sans s’accumuler. Les séances terminées et manquées sont conservées.",
    migration: "Applique les migrations jusqu’à 202610030007_optional_daily_limit.sql dans Supabase, dans l’ordre, avant de sauvegarder.",
    changed: "Tes données ont changé depuis cet aperçu. Recalcule le planning avant de l’enregistrer.",
    invalid: "Choisis une période de planning à partir de demain.",
    conflict: "Enregistrement refusé : vérifie les horaires et recalcule l’aperçu. Aucune sauvegarde partielle n’a été effectuée.",
    failed: "Impossible d’enregistrer le planning. Vérifie les paramètres et réessaie.",
  };
  const planningRevision = profile.data?.planning_revision == null || profile.data?.planning_history_version !== 1 || profile.data?.course_period_version !== 1 || profile.data?.missed_sessions_version !== 1 || profile.data?.optional_daily_limit_version !== 1 || occurrences === null ? null : String(profile.data.planning_revision);
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
  const renderStudy = (study: SavedStudy) => <li key={study.id} className="p-4">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-950">{study.course_code_snapshot ?? courses.data?.find((course) => course.id === study.course_id)?.code ?? "Cours archivé"}</p><p className="mt-1 text-xs leading-5 text-slate-500">{formatCalendarDate(study.scheduled_date)}</p></div><p className="shrink-0 text-sm font-medium tabular-nums text-slate-700">{study.start_time.slice(0,5)}–{study.end_time.slice(0,5)}</p></div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant={study.status === "completed" ? "success" : study.status === "missed" ? "warning" : "secondary"}>{study.status === "planned" ? "Planifiée" : study.status === "completed" ? "Terminée" : study.status === "missed" ? "Manquée" : study.cancellation_reason === "replanned" ? "Annulée après replanification" : study.cancellation_reason === "course_archived" ? "Annulée : cours archivé" : "Annulée"}</Badge><span className="text-xs text-slate-500">Révision {study.revision_stage} · {formatMinutes(study.duration_minutes)}</span></div>
    {study.source_course_date && <p className="mt-2 text-xs leading-5 text-slate-500">À revoir : le cours du {formatCalendarDate(study.source_course_date)}.</p>}
  </li>;
  return <AppShell fullName={profile.data?.full_name ?? ""} activePage="calendar">
    <div className="page-header"><p className="page-eyebrow">Organiser mes révisions</p><h1 className="page-title">Planification</h1><p className="page-description">Tes cours, examens et révisions, au même endroit.</p></div>
    {result && Object.hasOwn(messages, result) && <p role="status" className="mt-5 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950"><AlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0" /><span className="min-w-0 break-words">{messages[result]}</span></p>}
    {planningRevision === null ? <p role="status" className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><AlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0" /><span className="min-w-0 break-words">La planification nécessite les migrations jusqu’à 202610030007_optional_daily_limit.sql, dans l’ordre. Tu peux calculer un aperçu ; applique cette migration dans Supabase avant de l’enregistrer.</span></p> : isOutdated ? <div role="status" className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-700" /><div><p className="text-sm font-semibold text-amber-950">Planning à recalculer</p><p className="mt-1 text-sm leading-6 text-amber-900">Tes données ont changé. Calcule un nouvel aperçu puis enregistre-le pour mettre à jour tes révisions futures.</p></div></div> : hasSavedPlanning ? <div role="status" className="mt-5 flex items-start gap-2 text-sm leading-6 text-slate-500"><CheckCircle2 aria-hidden="true" className="mt-1 size-4 shrink-0 text-emerald-600" /><span>Planning à jour{savedPeriodLabel}. Tu peux choisir une autre période ou le recalculer.</span></div> : null}
    {outsideWindow > 0 && <p role="status" className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><AlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0" /><span>{outsideWindow} révisions futures sont conservées hors de la dernière période mise à jour{savedPeriodLabel}. Vérifie leurs créneaux ou élargis la prochaine replanification après une modification des données.</span></p>}
    <VisualCalendar today={today} data={{ courses: (courses.data ?? []) as PlannerCourse[], studies, occurrences: occurrences ?? [], courseStart: preferences?.courseStart, courseEnd: preferences?.courseEnd }} />
    <details id="replanning" open={!hasSavedPlanning || isOutdated || result === "missed"} className="group mt-5 scroll-mt-24 rounded-2xl border border-slate-200 bg-white">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden"><div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><SlidersHorizontal aria-hidden="true" className="size-4" /></span><div><h2 className="text-sm font-semibold text-slate-950">{hasSavedPlanning ? "Recalculer le planning" : "Créer mon premier planning"}</h2><p className="mt-1 text-xs leading-5 text-slate-500">Choisir la période et préparer un aperçu</p></div></div><ChevronDown aria-hidden="true" className="disclosure-chevron size-4 shrink-0 text-slate-500" /></summary>
      <Planner today={today} planningRevision={planningRevision} defaults={preferences} data={{ courses: (courses.data ?? []) as PlannerCourse[], availability: (availability.data ?? []) as Availability[], existing, occurrences: occurrences ?? [], intervals: rules.data?.intervals ?? DEFAULT_REVISION_INTERVALS }} />
    </details>
    {!!studies.length && <section aria-label="Séances enregistrées et historique" className="mt-5 space-y-3">
      {currentStudies.length > 0 && <details className="group rounded-2xl border border-slate-200 bg-white"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2"><List aria-hidden="true" className="size-4 text-slate-400" /> Séances enregistrées<span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{currentStudies.length}</span></span><ChevronDown aria-hidden="true" className="disclosure-chevron size-4 shrink-0 text-slate-500" /></summary><ul className="divide-y divide-slate-100 border-t border-slate-100">{currentStudies.map(renderStudy)}</ul></details>}
      {historicalStudies.length > 0 && <details className="group rounded-2xl border border-slate-200 bg-white"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2"><History aria-hidden="true" className="size-4 text-slate-400" /> Historique<span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{historicalStudies.length}</span></span><ChevronDown aria-hidden="true" className="disclosure-chevron size-4 shrink-0 text-slate-500" /></summary><p className="border-t border-slate-100 px-4 pt-4 text-xs leading-5 text-slate-500">Séances manquées ou annulées, conservées pour le suivi.</p><ul className="divide-y divide-slate-100">{historicalStudies.map(renderStudy)}</ul></details>}
    </section>}
  </AppShell>;
}
