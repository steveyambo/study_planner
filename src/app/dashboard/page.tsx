import type { Metadata } from "next";
import Link from "next/link";
import { StudyStatistics } from "@/components/dashboard/study-statistics";
import { requireUser } from "@/lib/supabase/require-user";
import { loadStudySessions } from "@/lib/supabase/load-study-sessions";
import { studySummary, type DashboardStudy } from "@/lib/dashboard/study-summary";
import { formatCalendarDate, todayInTimezone, timeInTimezone, sessionHasElapsed } from "@/lib/utils/calendar-date";

export const metadata: Metadata = { title: "Tableau de bord | Study Planner" };
const messages: Record<string, string> = {
  completed: "Séance terminée. Ce travail sera pris en compte lors de ta prochaine planification.",
  migration: "Applique la migration 202610030004_complete_study_session.sql dans Supabase, après la migration 003, puis réessaie.",
  missing: "Cette séance n’existe plus. Elle a peut-être été remplacée par une nouvelle planification.",
  unavailable: "Cette séance n’est plus planifiée. Consulte son état dans la planification.",
  future: "Tu peux terminer une séance à partir du jour prévu.",
  invalid: "La séance sélectionnée n’est pas valide.",
  failed: "Impossible de valider cette séance. Réessaie ; aucune réussite n’a été confirmée.",
  missed_migration: "Applique la migration 202610030006_missed_sessions.sql dans Supabase après la 005, puis réessaie.",
  missed_future: "L’heure de fin de cette séance n’est pas encore passée. Elle ne peut pas être signalée comme manquée.",
};
const minutesLabel = (minutes: number) => `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { supabase, userId } = await requireUser();
  const [profile, studies, courses] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
    loadStudySessions(supabase, userId),
    supabase.from("courses").select("id,code,name,archived_at,exams(*)").eq("user_id", userId),
  ]);
  if (profile.error || courses.error) throw new Error("Impossible de charger le tableau de bord.");
  const timezone = profile.data?.timezone ?? "America/New_York";
  const today = todayInTimezone(timezone);
  const localTime = timeInTimezone(timezone);
  const summary = studySummary(studies as DashboardStudy[], today);
  const { result } = await searchParams;
  const exam = (courses.data ?? []).filter((course) => !course.archived_at)
    .flatMap((course) => course.exams.map((exam) => ({ ...exam, code: course.code })))
    .filter((exam) => exam.exam_date >= today)
    .sort((a, b) => `${a.exam_date}${a.start_time}`.localeCompare(`${b.exam_date}${b.start_time}`))[0];
  const percentage = summary.weekMinutes ? Math.round(summary.weekCompletedMinutes * 100 / summary.weekMinutes) : 0;
  const renderStudy = (study: DashboardStudy) => {
    const course = courses.data?.find((course) => course.id === study.course_id);
    const code = study.course_code_snapshot ?? course?.code ?? "Cours archivé";
    return <li key={study.id} className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-semibold">{code} · {formatCalendarDate(study.scheduled_date)} · {study.start_time.slice(0, 5)}–{study.end_time.slice(0, 5)}</p>
      <p className="mt-1 text-sm text-slate-600">{study.course_name_snapshot ?? course?.name}{study.source_course_date && ` · Séance de cours du ${formatCalendarDate(study.source_course_date)}`} · Révision {study.revision_stage} · {minutesLabel(study.duration_minutes)}</p>
      {study.status === "completed" ? <p className="mt-2 text-sm font-medium text-emerald-700">✓ Terminée{study.completed_at && ` le ${formatCalendarDate(todayInTimezone(timezone, new Date(study.completed_at)))}`}</p>
        : study.status === "missed" ? <p className="mt-2 text-sm font-medium text-amber-800">Manquée · Le temps reste à faire, sauf s’il a déjà été rattrapé.</p>
        : study.scheduled_date <= today ? <form action="/dashboard/complete" method="post" className="mt-3">
          <input type="hidden" name="id" value={study.id} />
          <button type="submit" aria-label={`Terminer la révision ${study.revision_stage} de ${code}, prévue le ${formatCalendarDate(study.scheduled_date)} à ${study.start_time.slice(0, 5)}`} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">✓ Terminé</button>
        </form> : <p className="mt-2 text-sm text-slate-600">Planifiée · À valider à partir du jour prévu.</p>}
      {study.status === "planned" && study.source_course_date && (study.source_course_session_key ?? study.source_course_session_id) && !course?.archived_at && sessionHasElapsed(study, today, localTime) && <form action="/dashboard/missed" method="post" className="mt-3">
        <input type="hidden" name="id" value={study.id} />
        <p className="mb-2 text-sm text-amber-800">Horaire dépassé. Si tu n’as pas fait cette révision :</p>
        <button className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900">Séance manquée · Préparer le rattrapage</button>
      </form>}
    </li>;
  };
  const cardClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
  return <>
    <p className="text-sm font-semibold text-indigo-600">Ton espace de révision</p>
    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Tableau de bord</h1>
    <p className="mt-4 leading-7 text-slate-600">Retrouve tes séances enregistrées et marque tes révisions comme terminées une fois réalisées.</p>
    {result && Object.hasOwn(messages, result) && <p role="status" className="mt-5 rounded-lg bg-indigo-50 p-4 text-indigo-950">{messages[result]}</p>}
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Aujourd’hui · {formatCalendarDate(today)}</h2>
        {summary.day.length ? <ul className="mt-4 space-y-3">{summary.day.map(renderStudy)}</ul> : <p className="mt-4 text-sm text-slate-600">Aucune révision enregistrée pour aujourd’hui.</p>}
      </section>
      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Prochain examen</h2>
        <p className="mt-4 text-slate-600">{exam ? `${exam.code} · ${exam.title} · ${formatCalendarDate(exam.exam_date)} · ${exam.start_time.slice(0, 5)}–${exam.end_time.slice(0, 5)}` : "Aucun examen à venir enregistré."}</p>
        <Link className="mt-4 inline-block text-sm font-medium text-indigo-700" href="/exams">Consulter mes examens</Link>
      </section>
      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Temps de révision du jour</h2>
        <p className="mt-4 text-slate-600">{minutesLabel(summary.dayCompletedMinutes)} terminées sur {minutesLabel(summary.dayMinutes)} enregistrées pour aujourd’hui.</p>
      </section>
      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Progression hebdomadaire</h2>
        <p className="mt-4 text-slate-600">{minutesLabel(summary.weekCompletedMinutes)} terminées sur {minutesLabel(summary.weekMinutes)} planifiées ou terminées cette semaine ({percentage} %).</p>
        <progress aria-label="Part du temps enregistré cette semaine déjà réalisée" className="mt-3 h-3 w-full accent-indigo-600" value={percentage} max={100} />
        <p className="mt-2 text-xs text-slate-500">Selon les dates prévues, du {formatCalendarDate(summary.weekStart)} au {formatCalendarDate(summary.weekEnd)}. Les séances manquées ou annulées sont exclues de ce total.</p>
      </section>
    </div>
    {!!summary.overdue.length && <section className="mt-8"><h2 className="text-xl font-semibold">Séances passées encore à valider</h2><p className="mt-2 text-sm text-slate-600">Marque uniquement les révisions que tu as réellement faites.</p><ul className="mt-4 space-y-3">{summary.overdue.map(renderStudy)}</ul></section>}
    <StudyStatistics studies={studies as DashboardStudy[]} courses={courses.data ?? []} today={today} />
    <section className="mt-8"><h2 className="text-xl font-semibold">Prochaines révisions</h2>
      {summary.upcoming.length ? <ul className="mt-4 space-y-3">{summary.upcoming.slice(0, 10).map(renderStudy)}</ul> : <p className="mt-3 text-sm text-slate-600">Aucune prochaine révision enregistrée.</p>}
      <Link href="/calendar" className="mt-4 inline-block font-medium text-indigo-700">Voir toutes les séances et recalculer le planning</Link>
    </section>
    {!!summary.completed.length && <details className="mt-8 rounded-xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-semibold">Dernières séances terminées ({summary.completed.length} au total)</summary><ul className="mt-4 space-y-3">{summary.completed.slice(0, 10).map(renderStudy)}</ul></details>}
    {!!summary.missedCount && <details className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5"><summary className="cursor-pointer font-semibold">Séances manquées ({summary.missedCount})</summary>
      <p className="mt-3 text-sm text-slate-600">Cet historique reste conservé après le rattrapage. Le recalcul déduit les révisions terminées et déjà planifiées ; il n’ajoute pas une copie pour chaque ligne manquée.</p>
      <ul className="mt-4 space-y-3">{summary.missed.slice(-10).reverse().map(renderStudy)}</ul>
      <Link href="/calendar" className="mt-4 inline-block font-semibold text-indigo-700">Préparer un planning de rattrapage</Link>
    </details>}
  </>;
}
