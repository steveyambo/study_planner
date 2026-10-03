"use client";

import { useState } from "react";
import type { Availability } from "@/types/availability";
import { sessionMinutes, formatMinutes, weekDays } from "@/lib/courses/session-time";

export function AvailabilityForm({ slot }: { slot?: Availability }) {
  const prefix = slot?.id ?? "new-availability";
  const [start, setStart] = useState(slot?.start_time.slice(0, 5) ?? "");
  const [end, setEnd] = useState(slot?.end_time.slice(0, 5) ?? "");
  const [pending, setPending] = useState(false);
  const minutes = sessionMinutes(start, end);
  const style = "mt-2 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-2 focus:outline-indigo-600";
  return (
    <form action="/availability/manage" method="post" onSubmit={() => setPending(true)} className="space-y-4">
      <input type="hidden" name="action" value="save" />{slot && <input type="hidden" name="id" value={slot.id} />}
      <div><label htmlFor={`${prefix}-day`} className="text-sm font-medium">Jour</label><select id={`${prefix}-day`} name="day_of_week" defaultValue={slot?.day_of_week ?? 1} className={style}>{weekDays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor={`${prefix}-start`} className="text-sm font-medium">Début</label><input id={`${prefix}-start`} name="start_time" type="time" required value={start} onChange={(event) => setStart(event.target.value)} className={style} /></div>
        <div><label htmlFor={`${prefix}-end`} className="text-sm font-medium">Fin</label><input id={`${prefix}-end`} name="end_time" type="time" required value={end} onChange={(event) => setEnd(event.target.value)} className={style} /></div>
      </div>
      <p aria-live="polite" className="text-sm text-slate-600">{minutes !== null ? `${formatMinutes(minutes)} disponibles` : "La fin doit être après le début, dans la même journée."}</p>
      <button disabled={pending || minutes === null} className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? "Enregistrement…" : slot ? "Enregistrer" : "Ajouter le créneau"}</button>
    </form>
  );
}

export function DeleteAvailabilityForm({ id }: { id: string }) {
  return <form action="/availability/manage" method="post" className="mt-3" onSubmit={(event) => { if (!window.confirm("Supprimer cette disponibilité ?")) event.preventDefault(); }}>
    <input type="hidden" name="action" value="delete" /><input type="hidden" name="id" value={id} />
    <button className="text-sm font-semibold text-red-700 underline">Supprimer le créneau</button>
  </form>;
}
