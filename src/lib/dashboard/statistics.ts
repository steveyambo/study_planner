import type { DashboardStudy } from "./study-summary";

export type StatisticsCourse = { id: string; code: string; name: string; archived_at?: string | null };
export function studyTotals(studies: DashboardStudy[]) {
  const totals = { plannedMinutes: 0, completedMinutes: 0, missedMinutes: 0, plannedCount: 0, completedCount: 0, missedCount: 0 };
  for (const study of studies) {
    if (study.status === "planned") { totals.plannedMinutes += study.duration_minutes; totals.plannedCount++; }
    if (study.status === "completed") { totals.completedMinutes += study.duration_minutes; totals.completedCount++; }
    if (study.status === "missed") { totals.missedMinutes += study.duration_minutes; totals.missedCount++; }
  }
  const totalMinutes = totals.plannedMinutes + totals.completedMinutes;
  return { ...totals, totalMinutes, percentage: totalMinutes ? Math.round(totals.completedMinutes * 100 / totalMinutes) : 0 };
}

export function studyStatistics(studies: DashboardStudy[], courses: StatisticsCourse[], today: string) {
  const known = new Map(courses.map((course) => [course.id, course]));
  const groups = new Map<string, { id: string; code: string; name: string; archived: boolean; studies: DashboardStudy[] }>();
  for (const study of studies) {
    if (!["planned", "completed", "missed"].includes(study.status)) continue;
    const id = study.course_id ?? "unknown", course = known.get(id);
    let group = groups.get(id);
    if (!group) {
      group = { id, code: course?.code ?? study.course_code_snapshot ?? "Cours archivé", name: course?.name ?? study.course_name_snapshot ?? "", archived: !!course?.archived_at || !course, studies: [] };
      groups.set(id, group);
    }
    group.studies.push(study);
  }
  const monday = new Date(`${today}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const weeks = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(monday); start.setUTCDate(start.getUTCDate() - (5 - index) * 7);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
    const from = start.toISOString().slice(0, 10), to = end.toISOString().slice(0, 10);
    return { from, to, ...studyTotals(studies.filter((study) => study.scheduled_date >= from && study.scheduled_date <= to)) };
  });
  return { total: studyTotals(studies), courses: [...groups.values()].map(({ studies: rows, ...course }) => ({ ...course, ...studyTotals(rows) })).sort((a, b) => a.code.localeCompare(b.code)), weeks };
}

export const studyTimeLabel = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
