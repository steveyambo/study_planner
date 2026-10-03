"use client";

import { useState, type FormEvent } from "react";
import { generateSchedule, type ScheduleInput } from "@/lib/scheduler/generateSchedule";
import { formatMinutes } from "@/lib/courses/session-time";
import { formatCalendarDate } from "@/lib/utils/calendar-date";

export function Planner({ data, today }: { data: Pick<ScheduleInput, "courses" | "availability" | "existing" | "intervals">; today: string }) {
  const [result, setResult] = useState<ReturnType<typeof generateSchedule> | null>(null);
  const [error, setError] = useState("");
  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setResult(null); setError("");
    try {
      const planningStart = String(fields.get("planningStart"));
      if (planningStart <= today) throw new Error("Choisis un début de planning à partir de demain, pour éviter les heures déjà passées aujourd’hui.");
      setResult(generateSchedule({ ...data, courseStart: String(fields.get("courseStart")), courseEnd: String(fields.get("courseEnd")), planningStart, planningEnd: String(fields.get("planningEnd")), includeOverdue: fields.get("includeOverdue") === "on" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de calculer le planning."); }
  }
  const name = (id: string) => data.courses.find((course) => course.id === id)?.code ?? "Cours";
  return <>
    <form onSubmit={preview} onChange={() => { setResult(null); setError(""); }} className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-sm leading-6 text-slate-600">Les horaires hebdomadaires seront répétés sur toute la période des cours. Exemple : début des cours le 14 septembre, puis planning à partir de demain. Cette première version utilise la même période pour tous les cours.</p>
      <div className="grid gap-4 sm:grid-cols-2">{[
        ["courseStart", "Début des cours"], ["courseEnd", "Fin des cours à inclure"],
        ["planningStart", "Début du planning (à partir de demain)"], ["planningEnd", "Fin du planning"],
      ].map(([id, label]) => <div key={id}><label htmlFor={id} className="block text-sm font-medium">{label}</label><input required id={id} name={id} type="date" min="0001-01-01" max="9999-12-31" defaultValue={id === "courseStart" || id === "courseEnd" ? today : undefined} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></div>)}</div>
      <label className="flex items-start gap-3 text-sm leading-6"><input name="includeOverdue" type="checkbox" className="mt-1" /><span>Inclure les révisions déjà échues comme restant à faire. Coche seulement si tu veux simuler leur rattrapage : l’application ne connaît pas encore les révisions que tu as faites en dehors d’elle.</span></label>
      {data.existing.length > 0 && <p className="text-sm text-amber-800">Des révisions existent déjà : leurs heures sont réservées. Cet aperçu recalcule les charges sans déduire les séances terminées ; il ne doit pas servir à enregistrer un second planning.</p>}
      <button className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">Calculer l’aperçu</button>
    </form>
    {error && <p role="alert" className="mt-5 text-red-700">{error}</p>}
    {result && <section aria-live="polite" className="mt-8 space-y-5">
      <h2 className="text-xl font-semibold">Planning proposé</h2>
      <p>{result.occurrences} séances de cours · {formatMinutes(result.planned.reduce((n, revision) => n + revision.durationMinutes, 0))} placées · {formatMinutes(result.unscheduled.reduce((n, revision) => n + revision.durationMinutes, 0))} non placées.</p>
      {result.excludedMinutes > 0 && <p className="text-sm text-slate-600">{formatMinutes(result.excludedMinutes)} déjà échues exclues. Cela ne signifie pas qu’elles ont été effectuées.</p>}
      <p className="text-sm text-slate-600">Simulation sans enregistrement. Chaque répétition reste entière ; si aucun créneau n’est assez long, elle est signalée. Les pauses configurables et la priorité selon l’importance seront ajoutées aux étapes suivantes.</p>
      {!result.planned.length && <p>Aucune révision placée. Vérifie les périodes et tes disponibilités.</p>}
      <ul className="space-y-3">{result.planned.map((revision, index) => <li key={index} className="rounded-lg border border-slate-200 bg-white p-4"><p className="font-semibold">{name(revision.courseId)} · {formatCalendarDate(revision.scheduledDate)} · {revision.startTime}–{revision.endTime}</p><p className="mt-1 text-sm text-slate-600">Cours du {formatCalendarDate(revision.courseDate)} · répétition {revision.stage} · {formatMinutes(revision.durationMinutes)}{revision.scheduledDate !== revision.desiredDate && ` · déplacée depuis le ${formatCalendarDate(revision.desiredDate)}`}</p></li>)}</ul>
      {!!result.unscheduled.length && <><h3 className="font-semibold">Révisions non placées</h3><ul className="space-y-2 text-sm text-amber-800">{result.unscheduled.map((revision, index) => <li key={index}>{name(revision.courseId)} · cours du {formatCalendarDate(revision.courseDate)} · {formatMinutes(revision.durationMinutes)} : {revision.reason}</li>)}</ul></>}
    </section>}
  </>;
}
