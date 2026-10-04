"use client";

import { Button } from "@/components/ui/button";

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
        <input id="revision-intervals" name="intervals" value={input} onChange={(event) => setInput(event.target.value)} required maxLength={512} aria-describedby="intervals-help intervals-preview" className="field-input" />
        <p id="intervals-help" className="text-sm leading-6 text-slate-600">Sépare les jours par des virgules, par exemple 1, 3, 7, 14. Utilise des jours entiers positifs, sans doublon. Ils seront enregistrés dans l’ordre croissant.</p>
        <p id="intervals-preview" aria-live="polite" className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{parsed ? parsed.map((day) => `J+${day}`).join(" · ") : "Vérifie la liste : chaque intervalle doit être un entier positif et unique."}</p>
        <Button disabled={pending || !parsed} className="w-full sm:w-auto">{pending ? "Enregistrement…" : "Enregistrer les intervalles"}</Button>
      </form>
      <form action="/settings/revision/save" method="post" className="mt-5">
        <input type="hidden" name="intervals" value={DEFAULT_REVISION_INTERVALS.join(",")} />
        <Button variant="ghost" disabled={pending} className="h-auto min-h-11 w-full whitespace-normal sm:w-auto">Rétablir J+1, J+3, J+7 et J+14</Button>
      </form>
    </>
  );
}
