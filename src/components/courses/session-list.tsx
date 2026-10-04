"use client";

import { calculateStudyTime } from "@/lib/scheduler/calculateStudyTime";
import { distributeStudyTime } from "@/lib/scheduler/distributeStudyTime";
import type { CourseSession } from "@/types/course";
import { formatMinutes, sessionMinutes, weekDays } from "@/lib/courses/session-time";
import { RevisionPreview } from "./revision-preview";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionForm } from "./session-form";

export function SessionList({ courseId, multiplier, sessions, intervals, examDates, startsOn, endsOn }: { courseId: string; multiplier: number; sessions: CourseSession[]; intervals: number[]; examDates: string[]; startsOn?: string | null; endsOn?: string | null }) {
  const sorted = [...sessions].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
  const total = sorted.reduce((sum, session) => sum + (sessionMinutes(session.start_time, session.end_time) ?? 0), 0);
  return (
    <section className="mt-3 border-t border-slate-100 pt-4">
      <h3 className="font-semibold">Horaires hebdomadaires</h3>
      <details className="group mt-1"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-xs text-slate-500">À propos des modifications<ChevronDown aria-hidden="true" className="disclosure-chevron size-3.5" /></summary><p className="pb-3 text-xs leading-5 text-slate-500">Après la première sauvegarde du planning, un horaire ajouté ou modifié s’applique à partir d’aujourd’hui. Les séances passées conservent leur historique.</p></details>
      {sorted.length === 0 ? <p className="mt-3 text-sm text-slate-600">Aucun horaire ajouté.</p> : <>
        <p className="mt-1 text-xs leading-5 text-slate-500">Total par semaine : {formatMinutes(total)} de cours · {formatMinutes(sorted.reduce((sum, session) => sum + (calculateStudyTime(sessionMinutes(session.start_time, session.end_time) ?? 0, multiplier) ?? 0), 0))} de révision recommandée.</p>
        <ul className="mt-3 space-y-3">{sorted.map((session) => <li key={`${session.id}-${session.start_time}-${session.end_time}-${session.day_of_week}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
          <p className="text-sm font-semibold tabular-nums text-slate-800">{weekDays[session.day_of_week - 1]} · {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Durée : {formatMinutes(sessionMinutes(session.start_time, session.end_time) ?? 0)} · Révision recommandée : {formatMinutes(calculateStudyTime(sessionMinutes(session.start_time, session.end_time) ?? 0, multiplier) ?? 0)}</p>
          <details className="group mt-1">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-medium text-slate-600">Répartition des révisions<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 text-slate-400" /></summary>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {(distributeStudyTime(calculateStudyTime(sessionMinutes(session.start_time, session.end_time) ?? 0, multiplier) ?? 0, intervals) ?? []).map((revision) => (
                <li key={revision.intervalDays}>J+{revision.intervalDays} : {revision.durationMinutes === 0 ? "Aucune minute attribuée" : formatMinutes(revision.durationMinutes)}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-600">Aperçu par occurrence selon tes paramètres. Les dates et créneaux seront calculés lors de la planification.</p>
          </details>
          <details className="group mt-1"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-medium text-slate-600">Dates et examens<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 text-slate-400" /></summary><RevisionPreview startsOn={startsOn} endsOn={endsOn} sessionId={session.id} dayOfWeek={session.day_of_week} minutes={calculateStudyTime(sessionMinutes(session.start_time, session.end_time) ?? 0, multiplier) ?? 0} intervals={intervals} examDates={examDates} /></details>
          <details className="group mt-1"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-medium text-slate-600">Modifier l’horaire<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 text-slate-400" /></summary><div className="mt-4"><SessionForm courseId={courseId} multiplier={multiplier} session={session} /></div></details>
          <form action="/courses/sessions/delete" method="post" className="group mt-1" onSubmit={(event) => { if (!window.confirm("Supprimer cet horaire de cours ?")) event.preventDefault(); }}>
            <input type="hidden" name="course_id" value={courseId} /><input type="hidden" name="id" value={session.id} />
            <Button variant="ghost" className="-ml-3 text-xs text-red-700 hover:bg-red-50 hover:text-red-800">Supprimer cet horaire</Button>
          </form>
        </li>)}</ul>
      </>}
      <details className="group mt-4 rounded-xl border border-dashed border-slate-300 px-3"><summary className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-semibold text-indigo-700"><Plus aria-hidden="true" className="size-4" />Ajouter un horaire</summary><div className="pb-4 pt-2"><SessionForm courseId={courseId} multiplier={multiplier} /></div></details>
    </section>
  );
}
