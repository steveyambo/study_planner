import type { ExistingStudy } from "@/lib/scheduler/generateSchedule";

export type DashboardStudy = ExistingStudy & {
  id: string;
  duration_minutes: number;
  revision_stage: number;
  course_code_snapshot?: string | null;
  course_name_snapshot?: string | null;
  completed_at?: string | null;
};

export function studySummary(studies: DashboardStudy[], today: string) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const weekStart = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  const weekEnd = date.toISOString().slice(0, 10);
  const active = studies.filter((study) => study.status === "planned" || study.status === "completed");
  const day = active.filter((study) => study.scheduled_date === today);
  const week = active.filter((study) => study.scheduled_date >= weekStart && study.scheduled_date <= weekEnd);
  const minutes = (rows: DashboardStudy[]) => rows.reduce((sum, row) => sum + row.duration_minutes, 0);
  return {
    day,
    overdue: studies.filter((study) => study.status === "planned" && study.scheduled_date < today),
    upcoming: studies.filter((study) => study.status === "planned" && study.scheduled_date > today),
    completed: studies.filter((study) => study.status === "completed").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    missedCount: studies.filter((study) => study.status === "missed").length,
    missed: studies.filter((study) => study.status === "missed"),
    dayMinutes: minutes(day), dayCompletedMinutes: minutes(day.filter((study) => study.status === "completed")),
    weekMinutes: minutes(week), weekCompletedMinutes: minutes(week.filter((study) => study.status === "completed")),
    weekStart, weekEnd,
  };
}
