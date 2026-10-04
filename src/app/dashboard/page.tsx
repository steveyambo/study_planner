import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
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
const minutesLabel = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;

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
  const renderStudy = (study: DashboardStudy, className = "") => {
    const course = courses.data?.find((course) => course.id === study.course_id);
    const code = study.course_code_snapshot ?? course?.code ?? "Cours archivé";
    const isToday = study.scheduled_date === today;
    return <li key={study.id} className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{isToday ? "Aujourd’hui" : formatCalendarDate(study.scheduled_date)} · {study.start_time.slice(0, 5)}–{study.end_time.slice(0, 5)}</p>
          <p className="mt-1.5 break-words text-base font-semibold text-slate-950">{code}</p>
          <p className="mt-0.5 break-words text-sm text-slate-500">{study.course_name_snapshot ?? course?.name}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium tabular-nums text-slate-600">{minutesLabel(study.duration_minutes)}</span>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600">
        <span className="font-medium text-slate-800">Révision {study.revision_stage}</span>
        {study.source_course_date && <span> · À revoir : le cours du {formatCalendarDate(study.source_course_date)}</span>}
      </div>
      {study.status === "completed" ? <p className="mt-3 text-sm font-medium text-emerald-700">✓ Terminée{study.completed_at && ` le ${formatCalendarDate(todayInTimezone(timezone, new Date(study.completed_at)))}`}</p>
        : study.status === "missed" ? <p className="mt-3 text-sm text-amber-800">Manquée · Le temps reste à faire, sauf s’il a déjà été rattrapé.</p>
        : study.scheduled_date <= today ? <form action="/dashboard/complete" method="post" className="mt-4">
          <input type="hidden" name="id" value={study.id} />
          <Button type="submit" aria-label={`Terminer la révision ${study.revision_stage} de ${code}, prévue le ${formatCalendarDate(study.scheduled_date)} à ${study.start_time.slice(0, 5)}`} className="w-full sm:w-auto"><Check aria-hidden="true" className="size-4" /> Marquer comme terminée</Button>
        </form> : <p className="mt-3 text-xs text-slate-500">Planifiée · À valider à partir du jour prévu.</p>}
      {study.status === "planned" && study.source_course_date && (study.source_course_session_key ?? study.source_course_session_id) && !course?.archived_at && sessionHasElapsed(study, today, localTime) && <form action="/dashboard/missed" method="post" className="mt-3">
        <input type="hidden" name="id" value={study.id} />
        <p className="mb-2 text-xs leading-5 text-amber-800">Horaire dépassé. Si tu n’as pas fait cette révision :</p>
        <Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-2.5 text-left text-amber-800 sm:w-auto">Séance manquée · Préparer le rattrapage</Button>
      </form>}
    </li>;
  };
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Mon suivi</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Tableau de bord</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Tes révisions du jour, et ce qui vient ensuite.</p>
      </div>
      <Button asChild variant="outline" className="hidden sm:inline-flex"><Link href="/calendar"><CalendarDays aria-hidden="true" className="size-4" /> Mon calendrier</Link></Button>
    </div>
    {result && Object.hasOwn(messages, result) && <p role="status" className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">{messages[result]}</p>}
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Clock3 aria-hidden="true" className="size-4" /><h2>Aujourd’hui</h2></div>
        <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{minutesLabel(summary.dayCompletedMinutes)}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">terminées sur {minutesLabel(summary.dayMinutes)} enregistrées</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-xs font-medium text-slate-500">Cette semaine</h2>
        <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{percentage} <span className="text-base text-slate-500">%</span></p>
        <progress aria-label="Part du temps enregistré cette semaine déjà réalisée" className="mt-2 block h-1.5 w-full accent-indigo-600" value={percentage} max={100} />
        <p className="mt-2 text-xs leading-5 text-slate-500">{minutesLabel(summary.weekCompletedMinutes)} sur {minutesLabel(summary.weekMinutes)}</p>
      </section>
    </div>
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <section aria-labelledby="today-title">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 id="today-title" className="text-lg font-semibold tracking-tight">Mon programme du jour</h2><span className="text-xs text-slate-500">{new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`))}</span></div>
        {summary.day.length ? <ul className="space-y-3">{summary.day.map((study) => renderStudy(study))}</ul> : <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <CalendarDays aria-hidden="true" className="size-6 text-slate-400" /><p className="mt-3 font-medium text-slate-800">Aucune révision prévue aujourd’hui</p><p className="mt-1 text-sm leading-6 text-slate-500">Retrouve les prochains créneaux dans ton calendrier.</p><Link href="/calendar" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-indigo-700">Voir mon calendrier <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </div>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="next-exam-title">
        <div className="flex items-center gap-2 text-slate-500"><GraduationCap aria-hidden="true" className="size-4" /><h2 id="next-exam-title" className="text-xs font-semibold uppercase tracking-wider">Prochain examen</h2></div>
        {exam ? <><p className="mt-4 min-w-0 break-words text-lg font-semibold">{exam.code}</p><p className="mt-1 min-w-0 break-words text-sm text-slate-600">{exam.title}</p><p className="mt-3 text-sm font-medium text-slate-800">{formatCalendarDate(exam.exam_date)}</p><p className="mt-1 text-sm tabular-nums text-slate-500">{exam.start_time.slice(0, 5)}–{exam.end_time.slice(0, 5)}</p></> : <p className="mt-4 text-sm leading-6 text-slate-500">Aucun examen à venir enregistré.</p>}
        <Link className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-indigo-700" href="/exams">Consulter mes examens <ArrowRight aria-hidden="true" className="size-4" /></Link>
      </section>
    </div>
    {!!summary.overdue.length && <section className="mt-7"><h2 className="text-lg font-semibold tracking-tight">Séances passées encore à valider</h2><p className="mt-1 text-sm leading-6 text-slate-500">Marque uniquement les révisions que tu as réellement faites.</p><ul className="mt-3 grid gap-3 lg:grid-cols-2">{summary.overdue.map((study) => renderStudy(study))}</ul></section>}
    <section className="mt-7" aria-labelledby="upcoming-title">
      <div className="flex items-center justify-between gap-3"><h2 id="upcoming-title" className="text-lg font-semibold tracking-tight">Prochaines révisions</h2><Link href="/calendar" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-indigo-700">Tout voir <ArrowRight aria-hidden="true" className="size-4" /></Link></div>
      {summary.upcoming.length ? <ul className="mt-3 grid gap-3 lg:grid-cols-2">{summary.upcoming.slice(0, 10).map((study, index) => renderStudy(study, index >= 4 ? "hidden lg:block" : ""))}</ul> : <p className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Aucune prochaine révision enregistrée.</p>}
      <Link href="/calendar" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-indigo-700">Voir toutes les séances et recalculer le planning</Link>
    </section>
    <StudyStatistics studies={studies as DashboardStudy[]} courses={courses.data ?? []} today={today} />
    {!!summary.completed.length && <details className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 sm:px-5"><summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 text-sm font-semibold">Dernières séances terminées ({summary.completed.length} au total)<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 shrink-0 text-slate-400" /></summary><ul className="space-y-3 pb-5">{summary.completed.slice(0, 10).map((study) => renderStudy(study))}</ul></details>}
    {!!summary.missedCount && <details className="mt-4 rounded-2xl border border-amber-200 bg-white px-4 sm:px-5"><summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-amber-800">Séances manquées ({summary.missedCount})<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 shrink-0 text-slate-400" /></summary>
      <p className="mb-4 text-sm leading-6 text-slate-600">Cet historique reste conservé après le rattrapage. Le recalcul déduit les révisions terminées et déjà planifiées ; il n’ajoute pas une copie pour chaque ligne manquée.</p>
      <ul className="space-y-3">{summary.missed.slice(-10).reverse().map((study) => renderStudy(study))}</ul>
      <Link href="/calendar" className="my-3 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700">Préparer un planning de rattrapage</Link>
    </details>}
    <p className="mt-5 text-xs leading-5 text-slate-500">Progression selon les dates prévues, du {formatCalendarDate(summary.weekStart)} au {formatCalendarDate(summary.weekEnd)}. Les séances manquées ou annulées sont exclues du total de la semaine.</p>
  </>;
}
