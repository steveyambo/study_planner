"use client";

import { useState, type FormEvent } from "react";
import { generateSchedule, type ScheduleInput } from "@/lib/scheduler/generateSchedule";
import { formatMinutes } from "@/lib/courses/session-time";
import { formatCalendarDate } from "@/lib/utils/calendar-date";

export type PlanningPreferences = { courseStart?: string; courseEnd?: string; planningStart?: string; planningEnd?: string; includeOverdue?: boolean; breakMinutes?: number };
const addDays = (value: string, count: number) => new Date(Date.parse(`${value}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));

export function Planner({ data, today, planningRevision, defaults }: { data: Pick<ScheduleInput, "courses" | "availability" | "existing" | "intervals" | "occurrences">; today: string; planningRevision: string | null; defaults?: PlanningPreferences | null }) {
  const [result, setResult] = useState<ReturnType<typeof generateSchedule> | null>(null);
  const [error, setError] = useState("");
  const [saveFields, setSaveFields] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const tomorrow = addDays(today, 1);
  const defaultStart = validDate(defaults?.planningStart) && defaults.planningStart >= tomorrow ? defaults.planningStart : tomorrow;
  const defaultEnd = validDate(defaults?.planningEnd) && defaults.planningEnd >= defaultStart ? defaults.planningEnd : addDays(defaultStart, 30);
  const dateDefaults: Record<string, string> = { courseStart: validDate(defaults?.courseStart) ? defaults.courseStart : today, courseEnd: validDate(defaults?.courseEnd) ? defaults.courseEnd : defaultEnd, planningStart: defaultStart, planningEnd: defaultEnd };
  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setResult(null); setError(""); setSaveFields(null);
    try {
      const planningStart = String(fields.get("planningStart"));
      if (planningStart <= today) throw new Error("Choisis un début de planning à partir de demain, pour éviter les heures déjà passées aujourd’hui.");
      setResult(generateSchedule({ ...data, today, courseStart: String(fields.get("courseStart")), courseEnd: String(fields.get("courseEnd")), planningStart, planningEnd: String(fields.get("planningEnd")), includeOverdue: fields.get("includeOverdue") === "on", breakMinutes: Number(fields.get("breakMinutes")) }));
      setSaveFields(Object.fromEntries([...fields.entries()].map(([key, value]) => [key, String(value)])));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de calculer le planning."); }
  }
  const replacing = saveFields ? data.existing.filter((study) => study.status === "planned" && (study.source_course_session_key ?? study.source_course_session_id) && study.source_course_date && study.course_id && study.revision_stage && study.scheduled_date >= saveFields.planningStart && study.scheduled_date <= saveFields.planningEnd).length : 0;
  function save(event: FormEvent<HTMLFormElement>) {
    if (replacing > 0 && !window.confirm(`Remplacer les ${replacing} révisions encore planifiées du ${formatCalendarDate(saveFields!.planningStart)} au ${formatCalendarDate(saveFields!.planningEnd)} ? Les séances terminées et les séances en dehors de cette période sont conservées.`)) { event.preventDefault(); return; }
    setSaving(true);
  }
  const name = (id: string) => data.courses.find((course) => course.id === id)?.code ?? "Cours";
  return <>
    <form onSubmit={preview} onChange={() => { setResult(null); setError(""); setSaveFields(null); }} className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-sm leading-6 text-slate-600">Les horaires hebdomadaires seront répétés sur toute la période des cours. Exemple : début des cours le 14 septembre, puis planning à partir de demain. Cette première version utilise la même période pour tous les cours.</p>
      <div className="grid gap-4 sm:grid-cols-2">{[
        ["courseStart", "Début des cours"], ["courseEnd", "Fin des cours à inclure"],
        ["planningStart", "Début du planning (à partir de demain)"], ["planningEnd", "Fin du planning"],
      ].map(([id, label]) => <div key={id}><label htmlFor={id} className="block text-sm font-medium">{label}</label><input required id={id} name={id} type="date" min={id === "planningStart" ? tomorrow : "0001-01-01"} max="9999-12-31" defaultValue={dateDefaults[id]} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></div>)}</div>
      <div className="max-w-sm">
        <label htmlFor="breakMinutes" className="block text-sm font-medium">Pause entre deux révisions (minutes)</label>
        <input required id="breakMinutes" name="breakMinutes" type="number" min={0} max={60} step={1} defaultValue={typeof defaults?.breakMinutes === "number" && Number.isInteger(defaults.breakMinutes) && defaults.breakMinutes >= 0 && defaults.breakMinutes <= 60 ? defaults.breakMinutes : 15} aria-describedby="breakMinutesHelp" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" />
        <p id="breakMinutesHelp" className="mt-2 text-sm leading-6 text-slate-600">De 0 à 60 minutes. La pause réserve du temps entre les révisions, sans augmenter les heures de travail affichées.</p>
      </div>
      <label className="flex items-start gap-3 text-sm leading-6"><input name="includeOverdue" type="checkbox" defaultChecked={defaults?.includeOverdue === true} className="mt-1" /><span>Inclure les révisions déjà échues comme restant à faire. Coche seulement si tu veux simuler leur rattrapage : l’application ne connaît pas encore les révisions que tu as faites en dehors d’elle.</span></label>
      <p className="text-sm leading-6 text-slate-600">Les révisions terminées sont déduites de la charge restante. Le calcul remplace les révisions encore planifiées dans la période choisie et réserve les séances conservées en dehors de cette période. Les cours archivés et les horaires supprimés ne génèrent plus de nouvelles révisions.</p>
      <p className="text-sm leading-6 text-slate-600">À l’enregistrement, les anciennes propositions remplacées sont supprimées. Les révisions terminées et manquées restent dans le suivi ; les séances de cours d’origine restent connues pour le rattrapage.</p>
      <button className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">Calculer l’aperçu</button>
    </form>
    {error && <p role="alert" className="mt-5 text-red-700">{error}</p>}
    {result && <section aria-live="polite" className="mt-8 space-y-5">
      <h2 className="text-xl font-semibold">Planning proposé</h2>
      <p className="text-sm text-slate-600">Les créneaux sont attribués en priorité selon la charge à placer, la proximité et l’importance de l’examen de chaque cours.</p>
      <p>{result.occurrences} séances de cours · {formatMinutes(result.planned.reduce((n, revision) => n + revision.durationMinutes, 0))} placées · {formatMinutes(result.unscheduled.reduce((n, revision) => n + revision.durationMinutes, 0))} non placées.</p>
      {result.excludedMinutes > 0 && <p className="text-sm text-slate-600">{formatMinutes(result.excludedMinutes)} déjà échues exclues. Cela ne signifie pas qu’elles ont été effectuées.</p>}
      <p className="text-sm leading-6 text-slate-600">Simulation sans enregistrement. Les répétitions d’une même séance de cours se suivent sur des jours distincts. Le moteur conserve les écarts configurés lorsque c’est possible ; ils peuvent être réduits avant l’examen, avec au moins un jour entre deux répétitions. Même si toute la série ne tient pas, les premières révisions possibles sont conservées. Chaque répétition reste entière et les pauses sont réservées entre les révisions.</p>
      {!result.planned.length && <p>Aucune révision placée. Vérifie les périodes et tes disponibilités.</p>}
      {saveFields && planningRevision !== null && <form action="/calendar/save" method="post" onSubmit={save} className="space-y-3 rounded-lg bg-indigo-50 p-4">
        {Object.entries(saveFields).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
        <input type="hidden" name="preview" value={JSON.stringify(result.planned)} />
        <input type="hidden" name="expectedRevision" value={planningRevision} />
        <p className="text-sm leading-6 text-slate-600">{replacing > 0 ? `Remplace les ${replacing} révisions encore planifiées de cette période par les ${result.planned.length} révisions proposées.` : result.planned.length > 0 ? `Enregistre les ${result.planned.length} révisions proposées.` : "Enregistre les paramètres et la version actuelle des données, sans ajouter de révision."} Les séances terminées, l’historique et les séances en dehors de la période sont conservés. Les charges non placées ne deviennent pas des séances enregistrées. Le serveur vérifiera que cet aperçu est toujours à jour.</p>
        {replacing > 0 && result.planned.length === 0 && <p className="text-sm font-medium text-amber-900">Aucune nouvelle révision ne trouve de place : enregistrer cet aperçu retirera les révisions encore planifiées de cette période.</p>}
        <button disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Enregistrement…" : replacing > 0 ? "Remplacer ce planning" : result.planned.length > 0 ? "Enregistrer ce planning" : "Enregistrer ce planning vide"}</button>
      </form>}
      <ul className="space-y-3">{result.planned.map((revision, index) => <li key={index} className="rounded-lg border border-slate-200 bg-white p-4"><p className="font-semibold">{name(revision.courseId)} · {formatCalendarDate(revision.scheduledDate)} · {revision.startTime}–{revision.endTime}</p><p className="mt-1 text-sm text-slate-600">Cours du {formatCalendarDate(revision.courseDate)} · répétition {revision.stage} · {formatMinutes(revision.durationMinutes)}{revision.scheduledDate !== revision.desiredDate && ` · déplacée depuis le ${formatCalendarDate(revision.desiredDate)}`}</p></li>)}</ul>
      {!!result.unscheduled.length && <><h3 className="font-semibold">Révisions non placées</h3><ul className="space-y-2 text-sm text-amber-800">{result.unscheduled.map((revision, index) => <li key={index}>{name(revision.courseId)} · cours du {formatCalendarDate(revision.courseDate)}{revision.stage !== undefined && ` · répétition ${revision.stage}`} · {formatMinutes(revision.durationMinutes)} : {revision.reason}</li>)}</ul></>}
    </section>}
  </>;
}
