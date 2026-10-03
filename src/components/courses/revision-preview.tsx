"use client";

import { useState } from "react";
import { generateRevisionDates } from "@/lib/scheduler/generateRevisionDates";
import { formatCalendarDate, daysUntil } from "@/lib/utils/calendar-date";
import { formatMinutes } from "@/lib/courses/session-time";

export function RevisionPreview({ sessionId, dayOfWeek, minutes, intervals, examDates, startsOn, endsOn }: { sessionId: string; dayOfWeek: number; minutes: number; intervals: number[]; examDates: string[]; startsOn?: string | null; endsOn?: string | null }) {
  const [date, setDate] = useState("");
  const weekdayMatches = date && (new Date(`${date}T00:00:00Z`).getUTCDay() || 7) === dayOfWeek;
  const outsidePeriod = date && ((startsOn && date < startsOn) || (endsOn && date > endsOn));
  const result = date ? generateRevisionDates(date, minutes, intervals, examDates) : null;
  return <div className="mt-4 space-y-3">
    <label htmlFor={`occurrence-${sessionId}`} className="block text-sm font-medium">Date d’une occurrence de ce cours</label>
    <input id={`occurrence-${sessionId}`} type="date" min={startsOn ?? "0001-01-01"} max={endsOn ?? "9999-12-31"} value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2" />
    <div aria-live="polite" className="space-y-3 text-sm text-slate-600">
      {!date ? <p>Choisis une date pour voir l’effet des examens de ce cours.</p> : outsidePeriod ? <p>Cette date est en dehors de la période de cette matière.</p> : !weekdayMatches ? <p>Choisis une date correspondant au jour de cet horaire.</p> : result?.reason === "invalid" ? <p>Impossible de calculer ces dates. Vérifie la date et les intervalles.</p> : result?.reason === "no_window" ? <p>Aucun jour de révision entre le cours et l’examen du {formatCalendarDate(result.examDate!)}. La charge devra être signalée comme non planifiable.</p> : <>
        {result?.examDate && <p>Examen limite : {formatCalendarDate(result.examDate)}.</p>}
        <ul className="space-y-2">{result?.revisions.map((revision) => <li key={revision.intervalDays}>J+{revision.intervalDays} → {formatCalendarDate(revision.scheduledDate)} · {formatMinutes(revision.durationMinutes)}{revision.adjusted && ` (avancée à J+${daysUntil(revision.scheduledDate, date)} avant l’examen)`}</li>)}</ul>
        {result?.revisions.length === 0 && <p>Aucune minute à planifier.</p>}
        <p>Dates souhaitées uniquement. Plusieurs répétitions peuvent tomber le même jour ; le moteur vérifiera les disponibilités avant de créer les séances.</p>
      </>}
    </div>
  </div>;
}
