export function todayInTimezone(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function daysUntil(date: string, today: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function timeInTimezone(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(now);
}

export function sessionHasElapsed(study: { scheduled_date: string; end_time: string }, today: string, localTime: string) {
  return study.scheduled_date < today || (study.scheduled_date === today && study.end_time <= localTime);
}

export function remainingDaysLabel(days: number) {
  return days < 0 ? "Examen passé" : days === 0 ? "Aujourd’hui" : days === 1 ? "Demain" : `Dans ${days} jours`;
}

export function formatCalendarDate(date: string) {
  return new Intl.DateTimeFormat("fr", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00Z`));
}
