"use client";

import { useState } from "react";
import type { Exam } from "@/types/exam";

export function ExamForm({ courses, exam }: { courses: { id: string; code: string; name: string }[]; exam?: Exam }) {
  const [pending, setPending] = useState(false);
  const prefix = exam?.id ?? "new-exam";
  const style = "mt-2 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-2 focus:outline-indigo-600";
  return (
    <form action="/exams/manage" method="post" onSubmit={() => setPending(true)} className="space-y-4">
      <input type="hidden" name="action" value="save" />
      {exam && <input type="hidden" name="id" value={exam.id} />}
      <div><label htmlFor={`${prefix}-course`} className="text-sm font-medium">Cours</label><select id={`${prefix}-course`} name="course_id" required defaultValue={exam?.course_id ?? ""} className={style}><option value="" disabled>Choisir un cours</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.name}</option>)}</select></div>
      <div><label htmlFor={`${prefix}-title`} className="text-sm font-medium">Nom de l’examen</label><input id={`${prefix}-title`} name="title" required maxLength={160} defaultValue={exam?.title ?? ""} placeholder="Examen final" className={style} /></div>
      <div><label htmlFor={`${prefix}-date`} className="text-sm font-medium">Date</label><input id={`${prefix}-date`} name="exam_date" type="date" required defaultValue={exam?.exam_date ?? ""} className={style} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor={`${prefix}-start`} className="text-sm font-medium">Début</label><input id={`${prefix}-start`} name="start_time" type="time" required defaultValue={exam?.start_time.slice(0, 5) ?? ""} className={style} /></div>
        <div><label htmlFor={`${prefix}-end`} className="text-sm font-medium">Fin</label><input id={`${prefix}-end`} name="end_time" type="time" required defaultValue={exam?.end_time.slice(0, 5) ?? ""} className={style} /></div>
      </div>
      <p className="text-xs text-slate-600">La fin doit être après le début, dans la même journée.</p>
      <div><label htmlFor={`${prefix}-importance`} className="text-sm font-medium">Importance</label><select id={`${prefix}-importance`} name="importance" defaultValue={exam?.importance ?? 2} className={style}><option value={1}>Faible</option><option value={2}>Normale</option><option value={3}>Élevée</option></select></div>
      <div><label htmlFor={`${prefix}-notes`} className="text-sm font-medium">Notes (facultatif)</label><textarea id={`${prefix}-notes`} name="notes" maxLength={2000} rows={3} defaultValue={exam?.notes ?? ""} className={style} /></div>
      <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{pending ? "Enregistrement…" : exam ? "Enregistrer les modifications" : "Ajouter l’examen"}</button>
    </form>
  );
}
