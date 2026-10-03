import type { Metadata } from "next";
import Link from "next/link";
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
    supabase.from("courses").select("id,code,name,color").eq("user_id", userId).order("code"),
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
  ]);
  if (coursesError || profileError) throw new Error("Impossible de charger les cours et le profil.");
  const ownedCourses = courses ?? [];
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
      <h1 className="text-3xl font-bold">Mes examens</h1>
      <p className="mt-3 text-slate-600">Renseigne tes examens pour préparer tes prochaines échéances.</p>
      {message && <p role="status" className="mt-6 rounded-lg bg-indigo-50 p-4 text-sm text-indigo-950">{message}</p>}
      {!ownedCourses.length ? <p className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8">Ajoute d’abord un cours dans <Link href="/courses" className="font-semibold text-indigo-700 underline">Mes cours</Link>.</p> :
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <section className="self-start rounded-2xl border border-slate-200 bg-white p-6"><h2 className="mb-5 text-xl font-semibold">Ajouter un examen</h2><ExamForm courses={ownedCourses} /></section>
          <section aria-label="Liste des examens" className="space-y-4">
            {!ordered.length && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-slate-600">Aucun examen ajouté.</p>}
            {ordered.map((exam) => {
              const course = ownedCourses.find((course) => course.id === exam.course_id)!;
              return <article key={exam.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: course.color }} />{course.code}</p>
                <h2 className="mt-2 break-words text-xl font-semibold">{exam.title}</h2>
                <p className="mt-3 text-sm text-slate-600">{formatCalendarDate(exam.exam_date)} · {exam.start_time.slice(0, 5)}–{exam.end_time.slice(0, 5)}</p>
                <p className="mt-2 font-semibold text-indigo-700">{remainingDaysLabel(daysUntil(exam.exam_date, today))}</p>
                <p className="mt-2 text-sm text-slate-600">Importance : {exam.importance === 3 ? "élevée" : exam.importance === 1 ? "faible" : "normale"}</p>
                {exam.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{exam.notes}</p>}
                <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-indigo-700">Modifier l’examen</summary><div className="mt-4"><ExamForm courses={ownedCourses} exam={exam} /></div></details>
                <DeleteExamForm id={exam.id} title={exam.title} />
              </article>;
            })}
          </section>
        </div>}
    </>
  );
}
