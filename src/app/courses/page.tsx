import type { Metadata } from "next";
import { BookOpen, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AddPanel } from "@/components/courses/add-panel";
import { requireUser } from "@/lib/supabase/require-user";
import { CourseForm } from "@/components/courses/course-form";
import { DeleteCourseForm } from "@/components/courses/delete-course-form";
import type { Course, CourseSession } from "@/types/course";
import { SessionList } from "@/components/courses/session-list";
import { DEFAULT_REVISION_INTERVALS } from "@/lib/scheduler/revision-intervals";
import { formatCalendarDate } from "@/lib/utils/calendar-date";

export const metadata: Metadata = { title: "Mes cours | Study Planner" };
const messages: Record<string, string> = {
  created: "Cours ajouté.", updated: "Cours modifié.", archived: "Cours archivé. Son historique est conservé. Recalcule le planning pour utiliser les créneaux libérés.",
  invalid: "Vérifie les champs : code et nom requis, couleur et multiplicateur valides, dates existantes avec une fin égale ou postérieure au début.",
  period_migration: "Applique la migration 202610030005_course_periods.sql dans Supabase, après la 004, avant d’enregistrer les périodes des matières.",
  duplicate: "Tu as déjà un cours avec ce code.", missing: "Ce cours n’est plus disponible.", failed: "L’enregistrement a échoué. Réessaie.",
  session_created: "Horaire ajouté.", session_updated: "Horaire modifié.", session_deleted: "Horaire supprimé.",
  session_invalid: "Vérifie le jour et les heures : la fin doit être après le début, dans la même journée.",
  session_overlap: "Ce créneau chevauche déjà un horaire de ce cours.",
  migration: "L’archivage nécessite la migration de replanification. Exécute-la dans Supabase avant de réessayer.",
};

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ result?: string | string[] }> }) {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.from("courses").select("*,course_sessions(id,course_id,day_of_week,start_time,end_time),exams(exam_date)").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error("Impossible de charger les cours.");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (profileError) throw new Error("Impossible de charger les paramètres des cours.");
  const periodsReady = profile?.course_period_version === 1;
  const { data: rule, error: ruleError } = await supabase.from("revision_rules").select("intervals").eq("user_id", userId).maybeSingle();
  if (ruleError) throw new Error("Impossible de charger les intervalles de révision.");
  const intervals = (rule?.intervals ?? DEFAULT_REVISION_INTERVALS) as number[];
  const allCourses = (data ?? []) as (Course & { course_sessions: CourseSession[]; exams: { exam_date: string }[] })[];
  const courses = allCourses.filter((course) => !course.archived_at);
  const archivedCourses = allCourses.filter((course) => course.archived_at);
  const { result } = await searchParams;
  const message = typeof result === "string" && Object.hasOwn(messages, result) ? messages[result] : "";
  return (
    <>
      <header className="page-header flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="min-w-0"><p className="page-eyebrow">Mes matières</p><h1 className="page-title">Mes cours</h1><p className="page-description">Horaires, périodes et temps de révision, matière par matière.</p></div>
        <AddPanel title="Ajouter un cours" description="Commence par la matière. Tu pourras ensuite ajouter ses horaires hebdomadaires."><CourseForm periodsReady={periodsReady} /></AddPanel>
      </header>
      {message && <p role="status" className="mt-6 rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">{message}</p>}
      {!periodsReady && <p role="status" className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-950">Pour enregistrer les périodes propres à chaque matière, applique la migration 202610030005_course_periods.sql dans Supabase après la 004.</p>}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-slate-500">{courses.length} {courses.length === 1 ? "matière active" : "matières actives"}</h2><span className="text-xs text-slate-500">Horaires chaque semaine</span></div>
        <section aria-label="Liste des cours" className="grid items-start gap-4 xl:grid-cols-2">
          {courses.length === 0 && <div className="surface-card p-6 sm:p-8"><BookOpen aria-hidden="true" className="size-7 text-slate-400" /><h2 className="mt-4 font-semibold text-slate-900">Ajoute ta première matière</h2><p className="mt-2 text-sm leading-6 text-slate-500">Le bouton « Ajouter un cours » te permet de renseigner son nom, sa période et le temps que tu souhaites lui consacrer.</p></div>}
          {courses.map((course) => (
            <article key={`${course.id}-${course.code}-${course.name}-${course.color}-${course.revision_multiplier}-${course.starts_on}-${course.ends_on}`} className="surface-card min-w-0 p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
                <div className="min-w-0">
                  <h2 className="min-w-0 break-words text-lg font-semibold tracking-tight">{course.code}</h2><p className="mt-0.5 break-words text-sm text-slate-500">{course.name}</p>
                  <Badge variant="secondary" className="mt-3">1 h de cours → {course.revision_multiplier} h de révision</Badge>
                  <p className="mt-2 text-sm text-slate-600">{course.starts_on ? `Premier cours : ${formatCalendarDate(course.starts_on)}.` : "Début selon la période de planification."} {course.ends_on ? `Dernier cours : ${formatCalendarDate(course.ends_on)}.` : "Fin selon la période de planification."}</p>
                </div>
              </div>
              <details className="group mt-4 border-t border-slate-100">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-sm font-medium text-slate-700">Modifier le cours<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 text-slate-400" /></summary>
                <div className="mt-4"><CourseForm course={course} periodsReady={periodsReady} /></div>
              </details>
              <SessionList startsOn={course.starts_on} endsOn={course.ends_on} courseId={course.id} multiplier={course.revision_multiplier} sessions={course.course_sessions} intervals={intervals} examDates={course.exams.map((exam) => exam.exam_date)} />
              <DeleteCourseForm id={course.id} code={course.code} />
            </article>
          ))}
        </section>
      </div>
      {archivedCourses.length > 0 && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-xl font-semibold">Cours archivés</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Ces cours ne participent plus au planning. Leurs séances terminées et leur historique restent conservés. Leur code reste réservé.</p>
        <ul className="mt-4 space-y-3">{archivedCourses.map((course) => <li key={course.id} className="flex min-w-0 items-center gap-3 text-sm text-slate-600">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
          <span className="min-w-0 break-words">{course.code} — {course.name}</span>
        </li>)}</ul>
      </section>}
    </>
  );
}
