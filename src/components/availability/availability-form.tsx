"use client";

import { Button } from "@/components/ui/button";

import { useState } from "react";
import type { Availability } from "@/types/availability";
import { sessionMinutes, formatMinutes, weekDays } from "@/lib/courses/session-time";

export function AvailabilityForm({ slot }: { slot?: Availability }) {
  const prefix = slot?.id ?? "new-availability";
  const [start, setStart] = useState(slot?.start_time.slice(0, 5) ?? "");
  const [end, setEnd] = useState(slot?.end_time.slice(0, 5) ?? "");
  const [pending, setPending] = useState(false);
  const minutes = sessionMinutes(start, end);
  const style = "field-input mt-2";
  return (
    <form action="/availability/manage" method="post" onSubmit={() => setPending(true)} className="space-y-4">
      <input type="hidden" name="action" value="save" />{slot && <input type="hidden" name="id" value={slot.id} />}
      <div><label htmlFor={`${prefix}-day`} className="text-sm font-medium text-slate-700">Jour</label><select id={`${prefix}-day`} name="day_of_week" defaultValue={slot?.day_of_week ?? 1} className={style}>{weekDays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></div>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        <div><label htmlFor={`${prefix}-start`} className="text-sm font-medium text-slate-700">Début</label><input id={`${prefix}-start`} name="start_time" type="time" required value={start} onChange={(event) => setStart(event.target.value)} className={style} /></div>
        <div><label htmlFor={`${prefix}-end`} className="text-sm font-medium text-slate-700">Fin</label><input id={`${prefix}-end`} name="end_time" type="time" required value={end} onChange={(event) => setEnd(event.target.value)} className={style} /></div>
      </div>
      <p aria-live="polite" className="text-sm text-slate-600">{minutes !== null ? `${formatMinutes(minutes)} disponibles` : "La fin doit être après le début, dans la même journée."}</p>
      <Button disabled={pending || minutes === null} className="w-full">{pending ? "Enregistrement…" : slot ? "Enregistrer" : "Ajouter le créneau"}</Button>
    </form>
  );
}

export function DeleteAvailabilityForm({ id }: { id: string }) {
  return <form action="/availability/manage" method="post" className="mt-1" onSubmit={(event) => { if (!window.confirm("Supprimer cette disponibilité ?")) event.preventDefault(); }}>
    <input type="hidden" name="action" value="delete" /><input type="hidden" name="id" value={id} />
    <Button variant="ghost" className="-ml-3 text-xs text-red-700 hover:bg-red-50 hover:text-red-800">Supprimer le créneau</Button>
  </form>;
}
