import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { CourseForm } from "@/components/courses/course-form";
import { DeleteCourseForm } from "@/components/courses/delete-course-form";
import type { Course, CourseSession } from "@/types/course";
import { SessionList } from "@/components/courses/session-list";
import { DEFAULT_REVISION_INTERVALS } from "@/lib/scheduler/revision-intervals";

export const metadata: Metadata = { title: "Mes cours | Study Planner" };
const messages: Record<string, string> = {
  created: "Cours ajouté.", updated: "Cours modifié.", deleted: "Cours supprimé.",
  invalid: "Vérifie les champs : code et nom requis, couleur valide et multiplicateur entre 0,01 et 99,99 avec deux décimales maximum.",
  duplicate: "Tu as déjà un cours avec ce code.", missing: "Ce cours n’est plus disponible.", failed: "L’enregistrement a échoué. Réessaie.",
  session_created: "Horaire ajouté.", session_updated: "Horaire modifié.", session_deleted: "Horaire supprimé.",
  session_invalid: "Vérifie le jour et les heures : la fin doit être après le début, dans la même journée.",
  session_overlap: "Ce créneau chevauche déjà un horaire de ce cours.",
};

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ result?: string | string[] }> }) {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.from("courses").select("id,code,name,color,revision_multiplier,course_sessions(id,course_id,day_of_week,start_time,end_time)").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error("Impossible de charger les cours.");
  const { data: rule, error: ruleError } = await supabase.from("revision_rules").select("intervals").eq("user_id", userId).maybeSingle();
  if (ruleError) throw new Error("Impossible de charger les intervalles de révision.");
  const intervals = (rule?.intervals ?? DEFAULT_REVISION_INTERVALS) as number[];
  const courses = (data ?? []) as (Course & { course_sessions: CourseSession[] })[];
  const { result } = await searchParams;
  const message = typeof result === "string" && Object.hasOwn(messages, result) ? messages[result] : "";
  return (
    <>
      <h1 className="text-3xl font-bold">Mes cours</h1>
      <p className="mt-3 text-slate-600">Ajoute tes cours et choisis le temps de révision recommandé pour chacun.</p>
      {message && <p role="status" className="mt-6 rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">{message}</p>}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="self-start rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-5 text-xl font-semibold">Ajouter un cours</h2>
          <CourseForm />
        </section>
        <section aria-label="Liste des cours" className="space-y-4">
          {courses.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-slate-600">Aucun cours pour le moment. Ajoute ton premier cours avec le formulaire.</p>}
          {courses.map((course) => (
            <article key={`${course.id}-${course.code}-${course.name}-${course.color}-${course.revision_multiplier}`} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-semibold">{course.code} — {course.name}</h2>
                  <p className="mt-2 text-sm text-slate-600">1 h de cours → {course.revision_multiplier} h de révision</p>
                </div>
              </div>
              <details className="mt-5">
                <summary className="cursor-pointer text-sm font-semibold text-indigo-700">Modifier le cours</summary>
                <div className="mt-4"><CourseForm course={course} /></div>
              </details>
              <SessionList courseId={course.id} multiplier={course.revision_multiplier} sessions={course.course_sessions} intervals={intervals} />
              <DeleteCourseForm id={course.id} code={course.code} />
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
