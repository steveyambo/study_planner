"use client";

import { Button } from "@/components/ui/button";

import { useState } from "react";
import { calculateStudyTime } from "@/lib/scheduler/calculateStudyTime";
import type { CourseSession } from "@/types/course";
import { formatMinutes, sessionMinutes, weekDays } from "@/lib/courses/session-time";

export function SessionForm({ courseId, multiplier, session }: { courseId: string; multiplier: number; session?: CourseSession }) {
  const prefix = session?.id ?? `${courseId}-new-session`;
  const [start, setStart] = useState(session?.start_time.slice(0, 5) ?? "");
  const [end, setEnd] = useState(session?.end_time.slice(0, 5) ?? "");
  const [pending, setPending] = useState(false);
  const minutes = sessionMinutes(start, end);
  const studyMinutes = minutes === null ? null : calculateStudyTime(minutes, multiplier);
  const style = "field-input mt-2";
  return (
    <form action="/courses/sessions/save" method="post" className="space-y-4" onSubmit={() => setPending(true)}>
      <input type="hidden" name="course_id" value={courseId} />
      {session && <input type="hidden" name="id" value={session.id} />}
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3">
        <div className="min-[360px]:col-span-2 sm:col-span-1"><label htmlFor={`${prefix}-day`} className="text-sm font-medium text-slate-700">Jour</label>
          <select id={`${prefix}-day`} name="day_of_week" defaultValue={session?.day_of_week ?? 1} className={style}>{weekDays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select>
        </div>
        <div><label htmlFor={`${prefix}-start`} className="text-sm font-medium text-slate-700">Début</label><input id={`${prefix}-start`} name="start_time" type="time" value={start} onChange={(event) => setStart(event.target.value)} required className={style} /></div>
        <div><label htmlFor={`${prefix}-end`} className="text-sm font-medium text-slate-700">Fin</label><input id={`${prefix}-end`} name="end_time" type="time" value={end} onChange={(event) => setEnd(event.target.value)} required className={style} /></div>
      </div>
      <p aria-live="polite" className="text-sm leading-6 text-slate-600">{minutes !== null && studyMinutes !== null ? `Durée : ${formatMinutes(minutes)} · Révision recommandée : ${formatMinutes(studyMinutes)}` : start && end ? "La fin doit être après le début, dans la même journée." : "Renseigne les heures pour calculer la durée et la révision recommandée."}</p>
      <Button disabled={pending || minutes === null} className="w-full">{pending ? "Enregistrement…" : session ? "Enregistrer l’horaire" : "Ajouter l’horaire"}</Button>
    </form>
  );
}
