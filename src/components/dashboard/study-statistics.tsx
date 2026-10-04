import { studyStatistics, studyTimeLabel, type StatisticsCourse } from "@/lib/dashboard/statistics";
import type { DashboardStudy } from "@/lib/dashboard/study-summary";
import { formatCalendarDate } from "@/lib/utils/calendar-date";

export function StudyStatistics({ studies, courses, today }: { studies: DashboardStudy[]; courses: StatisticsCourse[]; today: string }) {
  const stats = studyStatistics(studies, courses, today);
  const cell = "px-4 py-3 text-left";
  return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="statistics-title">
    <h2 id="statistics-title" className="text-xl font-semibold">Mes statistiques de révision</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Toutes les périodes enregistrées, y compris les révisions futures. La progression mesure le temps terminé parmi les séances encore planifiées ou terminées.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm font-medium text-emerald-900">Temps terminé</p><p className="mt-1 text-2xl font-bold text-emerald-950">{studyTimeLabel(stats.total.completedMinutes)}</p><p className="mt-2 text-sm text-emerald-900">{stats.total.completedCount} séances terminées</p></div>
      <div className="rounded-xl bg-indigo-50 p-4"><p className="text-sm font-medium text-indigo-900">Temps encore planifié</p><p className="mt-1 text-2xl font-bold text-indigo-950">{studyTimeLabel(stats.total.plannedMinutes)}</p><p className="mt-2 text-sm text-indigo-900">{stats.total.plannedCount} séances à valider</p></div>
      <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-medium text-slate-700">Progression du planning enregistré</p><p className="mt-1 text-2xl font-bold">{stats.total.totalMinutes ? `${stats.total.percentage} %` : "—"}</p><p className="mt-2 text-sm text-slate-600">{studyTimeLabel(stats.total.completedMinutes)} sur {studyTimeLabel(stats.total.totalMinutes)}</p></div>
    </div>
    <p className="mt-4 text-sm text-amber-900">Historique : {stats.total.missedCount} séances manquées ({studyTimeLabel(stats.total.missedMinutes)}). Ces heures peuvent avoir été rattrapées ; elles ne sont pas ajoutées au temps encore planifié.</p>
    {!stats.total.totalMinutes && <p className="mt-3 text-sm text-slate-600">Aucune séance planifiée ou terminée à mesurer. Enregistre un planning pour commencer le suivi.</p>}
    <p className="mt-3 text-xs leading-5 text-slate-500">Les séances annulées sont exclues. Le travail non placé et les révisions faites hors de l’application ne sont pas inclus. Un recalcul peut modifier le total prévu sans effacer le temps déjà terminé.</p>
    <h3 className="mt-6 font-semibold">Progression par matière</h3>
    {stats.courses.length ? <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200" role="region" aria-label="Statistiques par matière" tabIndex={0}>
      <table className="w-full min-w-[680px] text-sm"><caption className="sr-only">Temps de révision enregistré pour chaque matière, toutes périodes</caption>
        <thead className="bg-slate-50 text-slate-600"><tr>{["Matière", "Terminé", "Encore planifié", "Progression", "Séances manquées"].map((title) => <th key={title} scope="col" className={cell}>{title}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-200">{stats.courses.map((course) => <tr key={course.id}>
          <th scope="row" className={cell}><span className="block font-semibold">{course.code}{course.archived ? " · Archivé" : ""}</span><span className="block font-normal text-slate-600">{course.name}</span></th>
          <td className={cell}>{studyTimeLabel(course.completedMinutes)}<span className="block text-xs text-slate-500">{course.completedCount} séances</span></td>
          <td className={cell}>{studyTimeLabel(course.plannedMinutes)}<span className="block text-xs text-slate-500">{course.plannedCount} séances</span></td>
          <td className={cell}>{course.totalMinutes ? <><span>{course.percentage} %</span><progress aria-label={`Progression de ${course.code}`} value={course.percentage} max={100} className="mt-1 block h-2 w-24 accent-indigo-600" /></> : "—"}</td>
          <td className={cell}>{course.missedCount}<span className="block text-xs text-slate-500">Historique</span></td>
        </tr>)}</tbody>
      </table>
    </div> : <p className="mt-3 text-sm text-slate-600">Aucune matière avec des révisions enregistrées.</p>}
    <details className="mt-6 rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer font-medium text-indigo-700">Suivi des six dernières semaines</summary>
      <p className="mt-3 text-xs leading-5 text-slate-500">Selon les dates prévues des séances, même si elles ont été validées plus tard. La dernière ligne représente la semaine en cours. Les propositions supprimées lors d’un recalcul ne font pas partie de ce suivi.</p>
      <ul className="mt-4 space-y-4">{stats.weeks.map((week) => <li key={week.from}>
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span>Du {formatCalendarDate(week.from)} au {formatCalendarDate(week.to)}</span><span>{studyTimeLabel(week.completedMinutes)} terminées / {studyTimeLabel(week.totalMinutes)} enregistrées{week.totalMinutes > 0 ? ` · ${week.percentage} %` : ""}</span></div>
        <progress aria-label={`Progression de la semaine du ${formatCalendarDate(week.from)}`} value={week.percentage} max={100} className="mt-2 h-2 w-full accent-indigo-600" />
        {week.missedCount > 0 && <p className="mt-1 text-xs text-amber-800">{week.missedCount} séances manquées dans l’historique</p>}
      </li>)}</ul>
    </details>
  </section>;
}
