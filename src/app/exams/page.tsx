import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronDown, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AddPanel } from "@/components/courses/add-panel";
import { requireUser } from "@/lib/supabase/require-user";
import { ExamForm } from "@/components/exams/exam-form";
import { DeleteExamForm } from "@/components/exams/delete-exam-form";
import { daysUntil, formatCalendarDate, remainingDaysLabel, todayInTimezone } from "@/lib/utils/calendar-date";
import type { Exam } from "@/types/exam";

export const metadata: Metadata = { title: "Examens | Study Planner" };
const messages: Record<string, string> = { created: "Examen ajouté.", updated: "Examen modifié.", deleted: "Examen supprimé.", invalid: "Vérifie le cours, le nom, la date et les heures. La fin doit être après le début.", missing: "Ce cours ou cet examen n’est plus disponible.", failed: "L’enregistrement a échoué. Réessaie." };

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ result?: string | string[] }> }) {
  const { supabase, userId } = await requireUser();
  const [{ data: courses, error: coursesError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("courses").select("*").eq("user_id", userId).order("code"),
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
  ]);
  if (coursesError || profileError) throw new Error("Impossible de charger les cours et le profil.");
  const ownedCourses = (courses ?? []).filter((course) => !course.archived_at);
  const today = todayInTimezone(profile?.timezone ?? "America/New_York");
  let exams: Exam[] = [];
  if (ownedCourses.length) {
    const { data, error } = await supabase.from("exams").select("id,course_id,title,exam_date,start_time,end_time,importance,notes").in("course_id", ownedCourses.map((course) => course.id)).order("exam_date").order("start_time");
    if (error) throw new Error("Impossible de charger les examens.");
    exams = (data ?? []) as Exam[];
  }
  const ordered = [...exams.filter((exam) => exam.exam_date >= today), ...exams.filter((exam) => exam.exam_date < today).reverse()];
  const { result } = await searchParams;
  const message = typeof result === "string" && Object.hasOwn(messages, result) ? messages[result] : "";
  return (
    <>
      <header className="page-header flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="min-w-0"><p className="page-eyebrow">Mes échéances</p><h1 className="page-title">Mes examens</h1><p className="page-description">Garde tes prochaines échéances en vue.</p></div>
        {ownedCourses.length > 0 && <AddPanel title="Ajouter un examen" description="Le planning tiendra compte de cette date et de l’importance de l’examen."><ExamForm courses={ownedCourses} /></AddPanel>}
      </header>
      {message && <p role="status" className="mt-6 rounded-lg bg-indigo-50 p-4 text-sm text-indigo-950">{message}</p>}
      {!ownedCourses.length ? <p className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8">Ajoute d’abord un cours dans <Link href="/courses" className="font-semibold text-indigo-700 underline">Mes cours</Link>.</p> :
        <div className="mt-6">
          <p className="mb-3 text-sm font-medium text-slate-500">{exams.filter((exam) => exam.exam_date >= today).length} examens à venir</p>
          <section aria-label="Liste des examens" className="grid items-start gap-4 lg:grid-cols-2">
            {!ordered.length && <div className="surface-card p-6 sm:p-8"><GraduationCap aria-hidden="true" className="size-7 text-slate-400" /><h2 className="mt-4 font-semibold">Aucun examen ajouté</h2><p className="mt-2 text-sm leading-6 text-slate-500">Ajoute une échéance pour que tes révisions soient placées avant l’examen.</p></div>}
            {ordered.map((exam) => {
              const course = ownedCourses.find((course) => course.id === exam.course_id)!;
              return <article key={exam.id} className="surface-card min-w-0 p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3"><p className="flex min-w-0 items-center gap-2 break-words text-xs font-semibold text-slate-600"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: course.color }} /><span className="min-w-0 break-words">{course.code}</span></p><Badge variant={exam.exam_date < today ? "secondary" : "outline"}>{remainingDaysLabel(daysUntil(exam.exam_date, today))}</Badge></div>
                <h2 className="mt-3 min-w-0 break-words text-lg font-semibold tracking-tight">{exam.title}</h2>
                <div className="mt-4 flex items-start gap-2.5"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" /><div><p className="text-sm font-medium text-slate-700">{formatCalendarDate(exam.exam_date)}</p><p className="mt-1 text-sm tabular-nums text-slate-500">{exam.start_time.slice(0, 5)}–{exam.end_time.slice(0, 5)}</p></div></div>
                <p className="mt-2 text-sm text-slate-600">Importance : {exam.importance === 3 ? "élevée" : exam.importance === 1 ? "faible" : "normale"}</p>
                {exam.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{exam.notes}</p>}
                <details className="group mt-4 border-t border-slate-100"><summary className="flex min-h-12 cursor-pointer items-center justify-between text-sm font-medium text-slate-700">Modifier l’examen<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 text-slate-400" /></summary><div className="mt-4"><ExamForm courses={ownedCourses} exam={exam} /></div></details>
                <DeleteExamForm id={exam.id} title={exam.title} />
              </article>;
            })}
          </section>
        </div>}
    </>
  );
}
