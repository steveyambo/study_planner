"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, CalendarRange, Check, ChevronDown, Save, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateSchedule, type PlannedRevision, type ScheduleInput, type UnscheduledRevision } from "@/lib/scheduler/generateSchedule";
import { formatMinutes } from "@/lib/courses/session-time";
import { formatCalendarDate } from "@/lib/utils/calendar-date";

export type PlanningPreferences = { courseStart?: string; courseEnd?: string; planningStart?: string; planningEnd?: string; includeOverdue?: boolean; breakMinutes?: number; maxDailyMinutes?: number | null; dailyLimitEnabled?: boolean };
const addDays = (value: string, count: number) => new Date(Date.parse(`${value}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const inputClassName = "mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-950 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400";
function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const value = key(item);
    (groups[value] ??= []).push(item);
    return groups;
  }, {});
}

export function Planner({ data, today, planningRevision, defaults }: { data: Pick<ScheduleInput, "courses" | "availability" | "existing" | "intervals" | "occurrences">; today: string; planningRevision: string | null; defaults?: PlanningPreferences | null }) {
  const [result, setResult] = useState<ReturnType<typeof generateSchedule> | null>(null);
  const [error, setError] = useState("");
  const [saveFields, setSaveFields] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [dailyLimitEnabled, setDailyLimitEnabled] = useState(defaults?.dailyLimitEnabled === true);
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
      setResult(generateSchedule({ ...data, today, courseStart: String(fields.get("courseStart")), courseEnd: String(fields.get("courseEnd")), planningStart, planningEnd: String(fields.get("planningEnd")), includeOverdue: fields.get("includeOverdue") === "on", breakMinutes: Number(fields.get("breakMinutes")), maxDailyMinutes: fields.get("dailyLimitEnabled") === "on" ? Number(fields.get("maxDailyMinutes")) : null }));
      setSaveFields(Object.fromEntries([...fields.entries()].map(([key, value]) => [key, String(value)])));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de calculer le planning."); }
  }
  const replacing = saveFields ? data.existing.filter((study) => study.status === "planned" && (study.source_course_session_key ?? study.source_course_session_id) && study.source_course_date && study.course_id && study.revision_stage && study.scheduled_date >= saveFields.planningStart && study.scheduled_date <= saveFields.planningEnd).length : 0;
  function save(event: FormEvent<HTMLFormElement>) {
    if (replacing > 0 && !window.confirm(`Remplacer les ${replacing} révisions encore planifiées du ${formatCalendarDate(saveFields!.planningStart)} au ${formatCalendarDate(saveFields!.planningEnd)} ? Les séances terminées et les séances en dehors de cette période sont conservées.`)) { event.preventDefault(); return; }
    setSaving(true);
  }
  const name = (id: string) => data.courses.find((course) => course.id === id)?.code ?? "Cours";
  const plannedDays = groupBy<PlannedRevision>(result?.planned ?? [], (revision) => revision.scheduledDate);
  const unplacedCourses = groupBy<UnscheduledRevision>(result?.unscheduled ?? [], (revision) => revision.courseId);
  const plannedMinutes = result?.planned.reduce((total, revision) => total + revision.durationMinutes, 0) ?? 0;
  const unplacedMinutes = result?.unscheduled.reduce((total, revision) => total + revision.durationMinutes, 0) ?? 0;
  return <>
    <form onSubmit={preview} onChange={() => { setResult(null); setError(""); setSaveFields(null); }} className="space-y-6 border-t border-slate-100 px-4 py-5 sm:px-6 sm:py-6">
      <fieldset className="space-y-4">
        <legend className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-950"><CalendarRange aria-hidden="true" className="size-4 text-slate-500" /> Période des révisions</legend>
        <p className="text-sm leading-6 text-slate-500">Les nouveaux créneaux commencent au plus tôt demain.</p>
        <div className="grid gap-4 sm:grid-cols-2">{[
          ["planningStart", "À partir du"], ["planningEnd", "Jusqu’au"],
        ].map(([id, label]) => <div key={id}><label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label><input required id={id} name={id} type="date" min={id === "planningStart" ? tomorrow : "0001-01-01"} max="9999-12-31" defaultValue={dateDefaults[id]} className={inputClassName} /></div>)}</div>
      </fieldset>
      <fieldset className="space-y-4 border-t border-slate-100 pt-5">
        <legend className="px-0 pt-5 text-sm font-semibold text-slate-950">Séances de cours à inclure</legend>
        <p className="text-sm leading-6 text-slate-500">Inclue les cours dont tu veux réviser le contenu. Les dates de chaque matière s’appliquent aussi.</p>
        <div className="grid gap-4 sm:grid-cols-2">{[
          ["courseStart", "Premier cours"], ["courseEnd", "Dernier cours"],
        ].map(([id, label]) => <div key={id}><label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label><input required id={id} name={id} type="date" min="0001-01-01" max="9999-12-31" defaultValue={dateDefaults[id]} className={inputClassName} /></div>)}</div>
        <p className="text-xs leading-5 text-slate-500">Les révisions peuvent continuer après le dernier cours, jusqu’à la fin du planning et avant l’examen.</p>
      </fieldset>
      <details className="group rounded-xl border border-slate-200">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2"><SlidersHorizontal aria-hidden="true" className="size-4" /> Pauses et rattrapage</span><ChevronDown aria-hidden="true" className="disclosure-chevron size-4 shrink-0" /></summary>
        <div className="space-y-5 border-t border-slate-100 p-4">
          <div className="max-w-sm">
            <label htmlFor="breakMinutes" className="block text-sm font-medium text-slate-700">Pause entre deux révisions (minutes)</label>
            <input required id="breakMinutes" name="breakMinutes" type="number" min={0} max={60} step={1} defaultValue={typeof defaults?.breakMinutes === "number" && Number.isInteger(defaults.breakMinutes) && defaults.breakMinutes >= 0 && defaults.breakMinutes <= 60 ? defaults.breakMinutes : 15} aria-describedby="breakMinutesHelp" className={inputClassName} />
            <p id="breakMinutesHelp" className="mt-2 text-xs leading-5 text-slate-500">De 0 à 60 minutes. Les pauses réservent du temps sans augmenter la durée de travail affichée.</p>
          </div>
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm leading-6"><input name="includeOverdue" type="checkbox" defaultChecked={defaults?.includeOverdue === true} className="mt-1 size-5 shrink-0 accent-indigo-600" /><span><span className="block font-medium text-slate-800">Rattraper les révisions déjà échues</span><span className="mt-1 block text-slate-500">Coche si elles restent à faire. Les révisions réalisées en dehors de l’application ne sont pas connues.</span></span></label>
          <div className="border-t border-slate-100 pt-4">
            <label className="flex min-h-12 cursor-pointer items-start gap-3 text-sm leading-6"><input name="dailyLimitEnabled" type="checkbox" checked={dailyLimitEnabled} onChange={(event) => setDailyLimitEnabled(event.target.checked)} className="mt-1 size-5 shrink-0 accent-indigo-600" /><span><span className="block font-medium text-slate-800">Ajouter un maximum quotidien</span><span className="block text-slate-500">Facultatif : tes disponibilités définissent déjà ton temps de travail.</span></span></label>
            <div className={dailyLimitEnabled ? "mt-3 max-w-sm" : "hidden"}>
              <label htmlFor="maxDailyMinutes" className="block text-sm font-medium text-slate-700">Maximum par jour (minutes)</label>
              <input required={dailyLimitEnabled} disabled={!dailyLimitEnabled} id="maxDailyMinutes" name="maxDailyMinutes" type="number" min={15} max={1440} step={1} defaultValue={defaults?.maxDailyMinutes ?? 240} aria-describedby="dailyLimitHelp" className={inputClassName} />
              <p id="dailyLimitHelp" className="mt-2 text-xs leading-5 text-slate-500">240 minutes = 4 h. Toutes les matières et les séances conservées sont comptées, sans les pauses ni les cours.</p>
            </div>
          </div>
        </div>
      </details>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-500 [&::-webkit-details-marker]:hidden">Ce qui change lors du recalcul<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 shrink-0" /></summary>
        <div className="space-y-2 pb-3 text-sm leading-6 text-slate-500">
          <p>Les révisions terminées sont déduites de la charge restante. Les révisions encore planifiées dans la période choisie sont remplacées ; les séances en dehors de cette période gardent leurs créneaux. Les cours archivés et les horaires supprimés ne génèrent plus de nouvelles révisions.</p>
          <p>À l’enregistrement, les anciennes propositions remplacées sont supprimées. Les révisions terminées et manquées restent dans le suivi ; les séances de cours d’origine restent connues pour le rattrapage.</p>
        </div>
      </details>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">Tu pourras vérifier les créneaux avant de les enregistrer.</p>
        <Button type="submit" className="min-h-12 w-full gap-2 rounded-xl sm:w-auto">Calculer l’aperçu<ArrowRight aria-hidden="true" className="size-4" /></Button>
      </div>
    </form>
    {error && <p role="alert" className="mx-4 mb-5 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-800 sm:mx-6"><AlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0" />{error}</p>}
    {result && <section aria-live="polite" className="space-y-5 border-t border-slate-200 px-4 py-5 sm:px-6 sm:py-6">
      <div><span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">Aperçu · non enregistré</span><h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">Ton planning proposé</h3><p className="mt-1 text-sm text-slate-500">À partir de {result.occurrences} séances de cours.</p></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Check aria-hidden="true" className="size-3.5 text-indigo-600" /> Temps placé</p><p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{formatMinutes(plannedMinutes)}</p><p className="mt-1 text-xs text-slate-500">{result.planned.length} révisions</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><AlertCircle aria-hidden="true" className="size-3.5" /> Non placé</p><p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{formatMinutes(unplacedMinutes)}</p><p className="mt-1 text-xs text-slate-500">{Object.keys(unplacedCourses).length} matières concernées</p></div>
      </div>
      {result.retainedOverLimitDays.length > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Des séances conservées dépassent déjà le maximum quotidien sur {result.retainedOverLimitDays.length} jours. Elles restent conservées ; aucune nouvelle révision n’est ajoutée sur ces jours.</p>}
      {result.excludedMinutes > 0 && <p className="text-sm leading-6 text-slate-500">{formatMinutes(result.excludedMinutes)} déjà échues exclues. Cela ne signifie pas qu’elles ont été effectuées.</p>}
      {saveFields && planningRevision !== null && <form action="/calendar/save" method="post" onSubmit={save} className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
        {Object.entries(saveFields).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
        <input type="hidden" name="preview" value={JSON.stringify(result.planned)} />
        <input type="hidden" name="expectedRevision" value={planningRevision} />
        <p className="text-sm leading-6 text-slate-700">{replacing > 0 ? `Remplace les ${replacing} révisions encore planifiées de cette période par les ${result.planned.length} révisions proposées.` : result.planned.length > 0 ? `Enregistre les ${result.planned.length} révisions proposées.` : "Enregistre les paramètres et la version actuelle des données, sans ajouter de révision."}</p>
        <p className="text-xs leading-5 text-slate-500">Les séances terminées, l’historique et les créneaux en dehors de la période sont conservés. Le travail non placé ne sera pas enregistré. Le serveur vérifiera que cet aperçu est toujours à jour.</p>
        {replacing > 0 && result.planned.length === 0 && <p className="text-sm font-medium text-amber-900">Aucune nouvelle révision ne trouve de place : enregistrer cet aperçu retirera les révisions encore planifiées de cette période.</p>}
        <Button type="submit" disabled={saving} className="min-h-12 w-full gap-2 rounded-xl sm:w-auto"><Save aria-hidden="true" className="size-4" />{saving ? "Enregistrement…" : replacing > 0 ? "Remplacer ce planning" : result.planned.length > 0 ? "Enregistrer ce planning" : "Enregistrer ce planning vide"}</Button>
      </form>}
      {!result.planned.length && <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Aucune révision placée. Vérifie les périodes et tes disponibilités.</p>}
      {!!result.planned.length && <details open={result.planned.length <= 8} className="rounded-xl border border-slate-200">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden">Voir les créneaux proposés ({result.planned.length})<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 shrink-0 text-slate-500" /></summary>
        <div className="space-y-5 border-t border-slate-100 p-4">{Object.entries(plannedDays).sort(([left], [right]) => left.localeCompare(right)).map(([date, revisions]) => <section key={date} aria-label={`Révisions du ${formatCalendarDate(date)}`}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h4 className="text-sm font-semibold text-slate-800">{formatCalendarDate(date)}</h4><span className="text-xs text-slate-500">{formatMinutes(revisions.reduce((total, revision) => total + revision.durationMinutes, 0))}</span></div>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">{revisions.map((revision) => <li key={`${revision.sourceId}-${revision.courseDate}-${revision.stage}`} className="p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-950">{name(revision.courseId)}</p><p className="mt-1 text-xs font-medium text-indigo-700">Révision {revision.stage}</p></div><div className="shrink-0 text-right"><p className="text-sm font-medium tabular-nums text-slate-800">{revision.startTime}–{revision.endTime}</p><p className="mt-1 text-xs text-slate-500">{formatMinutes(revision.durationMinutes)}</p></div></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">À revoir : le cours du {formatCalendarDate(revision.courseDate)}.</p>
          {revision.scheduledDate !== revision.desiredDate && <p className="mt-1 text-xs leading-5 text-slate-500">Date initialement prévue : {formatCalendarDate(revision.desiredDate)}.</p>}
        </li>)}</ul>
        </section>)}</div>
      </details>}
      {!!result.unscheduled.length && <section className="space-y-3">
        <div><h4 className="text-sm font-semibold text-slate-950">Révisions non placées</h4><p className="mt-1 text-xs leading-5 text-slate-500">Ouvre une matière pour comprendre ce qui bloque.</p></div>
        {Object.entries(unplacedCourses).map(([courseId, revisions]) => <details key={courseId} className="group rounded-xl border border-amber-200 bg-amber-50/40">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden"><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-900">{name(courseId)}</p><p className="mt-1 text-xs text-slate-500">{formatMinutes(revisions.reduce((total, revision) => total + revision.durationMinutes, 0))} à placer</p></div><ChevronDown aria-hidden="true" className="disclosure-chevron size-4 shrink-0 text-amber-700" /></summary>
          <ul className="divide-y divide-amber-100 border-t border-amber-100">{revisions.map((revision, index) => <li key={index} className="p-4 text-sm"><p className="font-medium text-slate-800">Cours du {formatCalendarDate(revision.courseDate)}{revision.stage !== undefined && ` · révision ${revision.stage}`}</p><p className="mt-1 text-xs text-slate-500">{formatMinutes(revision.durationMinutes)}</p><p className="mt-2 leading-6 text-amber-900">{revision.reason}</p></li>)}</ul>
        </details>)}
      </section>}
      <details className="group border-t border-slate-100 pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-500 [&::-webkit-details-marker]:hidden">Comment les révisions sont réparties<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 shrink-0" /></summary>
        <div className="space-y-2 text-sm leading-6 text-slate-500"><p>Les créneaux sont attribués en priorité selon la charge à placer, la proximité et l’importance de l’examen de chaque cours.</p><p>Les répétitions d’une même séance de cours se suivent sur des jours distincts. Les écarts configurés sont conservés lorsque c’est possible ; ils peuvent être réduits avant l’examen, avec au moins un jour entre deux répétitions. Même si toute la série ne tient pas, les premières révisions possibles sont conservées. Chaque répétition reste entière et les pauses sont réservées entre les révisions.</p></div>
      </details>
    </section>}
  </>;
}
