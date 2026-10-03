"use client";

import { useState } from "react";
import { DEFAULT_REVISION_INTERVALS, parseRevisionIntervals } from "@/lib/scheduler/revision-intervals";

export function RevisionRulesForm({ intervals }: { intervals: number[] }) {
  const [input, setInput] = useState(intervals.join(", "));
  const [pending, setPending] = useState(false);
  const parsed = parseRevisionIntervals(input);
  return (
    <>
      <form action="/settings/revision/save" method="post" onSubmit={() => setPending(true)} className="mt-6 space-y-4">
        <label htmlFor="revision-intervals" className="block text-sm font-medium">Jours après chaque séance de cours</label>
        <input id="revision-intervals" name="intervals" value={input} onChange={(event) => setInput(event.target.value)} required maxLength={512} aria-describedby="intervals-help intervals-preview" className="w-full rounded-lg border border-slate-300 px-3 py-3 focus:outline-2 focus:outline-indigo-600" />
        <p id="intervals-help" className="text-sm leading-6 text-slate-600">Sépare les jours par des virgules, par exemple 1, 3, 7, 14. Utilise des jours entiers positifs, sans doublon. Ils seront enregistrés dans l’ordre croissant.</p>
        <p id="intervals-preview" aria-live="polite" className="rounded-lg bg-indigo-50 p-4 text-sm text-indigo-950">{parsed ? parsed.map((day) => `J+${day}`).join(" · ") : "Vérifie la liste : chaque intervalle doit être un entier positif et unique."}</p>
        <button disabled={pending || !parsed} className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? "Enregistrement…" : "Enregistrer les intervalles"}</button>
      </form>
      <form action="/settings/revision/save" method="post" className="mt-5">
        <input type="hidden" name="intervals" value={DEFAULT_REVISION_INTERVALS.join(",")} />
        <button disabled={pending} className="text-sm font-semibold text-indigo-700 underline">Rétablir J+1, J+3, J+7 et J+14</button>
      </form>
    </>
  );
}
