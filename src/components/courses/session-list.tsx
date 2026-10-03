"use client";

import { calculateStudyTime } from "@/lib/scheduler/calculateStudyTime";
import { distributeStudyTime } from "@/lib/scheduler/distributeStudyTime";
import type { CourseSession } from "@/types/course";
import { formatMinutes, sessionMinutes, weekDays } from "@/lib/courses/session-time";
import { RevisionPreview } from "./revision-preview";
import { SessionForm } from "./session-form";

export function SessionList({ courseId, multiplier, sessions, intervals, examDates, startsOn, endsOn }: { courseId: string; multiplier: number; sessions: CourseSession[]; intervals: number[]; examDates: string[]; startsOn?: string | null; endsOn?: string | null }) {
  const sorted = [...sessions].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
  const total = sorted.reduce((sum, session) => sum + (sessionMinutes(session.start_time, session.end_time) ?? 0), 0);
  return (
    <section className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="font-semibold">Horaires hebdomadaires</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">Après la première sauvegarde du planning, un horaire ajouté ou modifié s’applique à partir d’aujourd’hui. Les séances passées conservent leur historique.</p>
      {sorted.length === 0 ? <p className="mt-3 text-sm text-slate-600">Aucun horaire ajouté.</p> : <>
        <p className="mt-3 text-sm leading-6 text-slate-600">Total par semaine : {formatMinutes(total)} de cours · {formatMinutes(sorted.reduce((sum, session) => sum + (calculateStudyTime(sessionMinutes(session.start_time, session.end_time) ?? 0, multiplier) ?? 0), 0))} de révision recommandée.</p>
        <ul className="mt-4 space-y-4">{sorted.map((session) => <li key={`${session.id}-${session.start_time}-${session.end_time}-${session.day_of_week}`} className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm font-medium">{weekDays[session.day_of_week - 1]} · {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}</p>
          <p className="mt-1 text-sm text-slate-600">Durée : {formatMinutes(sessionMinutes(session.start_time, session.end_time) ?? 0)} · Révision recommandée : {formatMinutes(calculateStudyTime(sessionMinutes(session.start_time, session.end_time) ?? 0, multiplier) ?? 0)}</p>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-indigo-700">Répartition des révisions</summary>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {(distributeStudyTime(calculateStudyTime(sessionMinutes(session.start_time, session.end_time) ?? 0, multiplier) ?? 0, intervals) ?? []).map((revision) => (
                <li key={revision.intervalDays}>J+{revision.intervalDays} : {revision.durationMinutes === 0 ? "Aucune minute attribuée" : formatMinutes(revision.durationMinutes)}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-600">Aperçu par occurrence selon tes paramètres. Les dates et créneaux seront calculés lors de la planification.</p>
          </details>
          <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-indigo-700">Dates et examens</summary><RevisionPreview startsOn={startsOn} endsOn={endsOn} sessionId={session.id} dayOfWeek={session.day_of_week} minutes={calculateStudyTime(sessionMinutes(session.start_time, session.end_time) ?? 0, multiplier) ?? 0} intervals={intervals} examDates={examDates} /></details>
          <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-indigo-700">Modifier l’horaire</summary><div className="mt-4"><SessionForm courseId={courseId} multiplier={multiplier} session={session} /></div></details>
          <form action="/courses/sessions/delete" method="post" className="mt-3" onSubmit={(event) => { if (!window.confirm("Supprimer cet horaire de cours ?")) event.preventDefault(); }}>
            <input type="hidden" name="course_id" value={courseId} /><input type="hidden" name="id" value={session.id} />
            <button className="text-sm font-medium text-red-700 underline">Supprimer cet horaire</button>
          </form>
        </li>)}</ul>
      </>}
      <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-indigo-700">Ajouter un horaire</summary><div className="mt-4"><SessionForm courseId={courseId} multiplier={multiplier} /></div></details>
    </section>
  );
}
