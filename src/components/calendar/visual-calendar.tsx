"use client";

import { useMemo, useState } from "react";
import { addDays, calendarDate, calendarDays, calendarEvents, eventColumns, minutes, shiftMonth, type CalendarData, type CalendarEvent } from "@/lib/calendar/events";
import { formatCalendarDate } from "@/lib/utils/calendar-date";

const styles = {
  course: "border-sky-300 bg-sky-50 text-sky-950",
  revision: "border-indigo-300 bg-indigo-50 text-indigo-950",
  exam: "border-amber-400 bg-amber-50 text-amber-950",
};
const kinds = { course: "Cours", revision: "Révision", exam: "Examen" };
const statuses: Record<string, string> = { planned: "Planifiée", completed: "Terminée", missed: "Manquée" };
const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr", { timeZone: "UTC", ...options }).format(calendarDate(date));
const clock = (value: string) => value.slice(0, 5);
const control = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export function VisualCalendar({ today, data }: { today: string; data: CalendarData }) {
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const days = useMemo(() => calendarDays(anchor, view), [anchor, view]);
  const events = useMemo(() => calendarEvents(data, days), [data, days]);
  const firstHour = Math.max(0, Math.min(8, ...events.map((event) => Math.floor(minutes(event.start) / 60))));
  const lastHour = Math.min(24, Math.max(20, ...events.map((event) => Math.ceil(Math.max(minutes(event.end), minutes(event.start) + 30) / 60))));
  const height = (lastHour - firstHour) * 64;
  const navigate = (amount: number) => { setAnchor(view === "week" ? addDays(anchor, amount * 7) : shiftMonth(anchor, amount)); setSelected(null); setSelectedDay(null); };
  const choose = (event: CalendarEvent) => { setSelected(event); setSelectedDay(null); };
  const eventLabel = (event: CalendarEvent) => `${kinds[event.kind]} · ${event.code} · ${formatCalendarDate(event.date)} · ${clock(event.start)}–${clock(event.end)} · ${event.title}${event.status ? ` · ${statuses[event.status]}` : ""}`;
  const monthEvent = (event: CalendarEvent) => <button key={event.id} type="button" onClick={() => choose(event)} aria-label={eventLabel(event)} className={`block w-full truncate rounded border px-1.5 py-1 text-left text-xs hover:brightness-95 focus-visible:outline-2 focus-visible:outline-indigo-600 ${styles[event.kind]}`}>
    {clock(event.start)} · {event.code} · {kinds[event.kind]}{event.status === "completed" ? " ✓" : event.status === "missed" ? " · Manquée" : ""}
  </button>;

  return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="calendar-title">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 id="calendar-title" className="text-xl font-semibold">Mon calendrier</h2><p className="mt-1 text-sm text-slate-600">Cours, examens et révisions enregistrées. Clique sur une séance pour voir le détail.</p></div>
      <div className="flex gap-2" aria-label="Vue du calendrier">{(["week", "month"] as const).map((mode) => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => { setView(mode); setSelected(null); setSelectedDay(null); }} className={`${control} ${view === mode ? "border-indigo-500 bg-indigo-50 text-indigo-700" : ""}`}>{mode === "week" ? "Semaine" : "Mois"}</button>)}</div>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <button type="button" className={control} aria-label={view === "week" ? "Semaine précédente" : "Mois précédent"} onClick={() => navigate(-1)}>←</button>
      <button type="button" className={control} onClick={() => { setAnchor(today); setSelected(null); setSelectedDay(null); }}>Aujourd’hui</button>
      <button type="button" className={control} aria-label={view === "week" ? "Semaine suivante" : "Mois suivant"} onClick={() => navigate(1)}>→</button>
      <p className="ml-2 font-semibold" aria-live="polite">{view === "week" ? `${dateLabel(days[0], { day: "numeric", month: "short" })} – ${dateLabel(days[6], { day: "numeric", month: "short", year: "numeric" })}` : dateLabel(anchor, { month: "long", year: "numeric" })}</p>
    </div>
    <div className="mt-4 flex flex-wrap gap-3 text-xs">{(["course", "revision", "exam"] as const).map((kind) => <span key={kind} className={`rounded border px-2 py-1 ${styles[kind]}`}>{kinds[kind]}</span>)}<span className="py-1 text-slate-600">✓ Terminée · Manquée : à rattraper</span></div>
    {!data.courseStart && !data.courseEnd && data.courses.some((course) => !course.archived_at && (!course.starts_on || !course.ends_on)) && <p className="mt-3 text-sm text-slate-600">Renseigne les dates des matières ou enregistre un planning pour afficher tous les cours hebdomadaires.</p>}
    {!events.length && <p role="status" className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Aucune séance dans cette période. Change de semaine ou de mois, ou prépare ton planning ci-dessous.</p>}
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200" tabIndex={0} role="region" aria-label={view === "week" ? "Calendrier hebdomadaire, défilement horizontal sur petit écran" : "Calendrier mensuel, défilement horizontal sur petit écran"}>
      {view === "week" ? <div className="min-w-[850px]">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-slate-200"><div /><>{days.map((date) => <div key={date} className={`border-l border-slate-200 py-3 text-center text-sm ${date === today ? "bg-indigo-50 font-bold text-indigo-700" : ""}`}><span>{dateLabel(date, { weekday: "short" })}</span><br /><time dateTime={date}>{dateLabel(date, { day: "numeric", month: "short" })}</time></div>)}</></div>
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]" style={{ height }}>
          <div className="relative text-xs text-slate-500">{Array.from({ length: lastHour - firstHour }, (_, i) => <span key={i} className="absolute right-2" style={{ top: i * 64 + 2 }}>{String(firstHour + i).padStart(2, "0")}:00</span>)}</div>
          {days.map((date) => <div key={date} className={`relative border-l border-slate-200 ${date === today ? "bg-indigo-50/30" : ""}`} style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 63px, #e2e8f0 63px, #e2e8f0 64px)" }}>
            {eventColumns(events.filter((event) => event.date === date)).map(({ event, lane, columns }) => <button key={event.id} type="button" aria-label={eventLabel(event)} onClick={() => choose(event)} className={`absolute overflow-hidden rounded border p-1 text-left text-[11px] leading-tight hover:brightness-95 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-indigo-600 ${styles[event.kind]}`} style={{ top: (minutes(event.start) - firstHour * 60) * 64 / 60, height: Math.max(30, minutes(event.end) - minutes(event.start)) * 64 / 60 - 2, left: `calc(${lane * 100 / columns}% + 2px)`, width: `calc(${100 / columns}% - 4px)` }}>
              <span className="block truncate font-semibold">{event.code}{event.status === "completed" ? " ✓" : ""}</span><span className="block">{clock(event.start)}–{clock(event.end)}</span><span className="block">{event.kind === "revision" ? event.title : kinds[event.kind]}{event.status === "missed" ? " · Manquée" : ""}</span>
            </button>)}
          </div>)}
        </div>
      </div> : <div className="min-w-[850px]">
        <div className="grid grid-cols-7 bg-slate-50 text-center text-sm font-medium">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => <div key={label} className="py-3">{label}</div>)}</div>
        <div className="grid grid-cols-7">{days.map((date) => { const dayEvents = events.filter((event) => event.date === date); return <div key={date} className={`min-h-36 border-t border-r border-slate-200 p-2 ${date.slice(0, 7) !== anchor.slice(0, 7) ? "bg-slate-50 text-slate-500" : ""} ${date === today ? "bg-indigo-50/50" : ""}`}>
          <button type="button" aria-label={`Voir les séances du ${formatCalendarDate(date)}`} className={`mb-2 rounded px-2 py-1 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600 ${date === today ? "bg-indigo-600 font-bold text-white" : ""}`} onClick={() => { setSelectedDay(date); setSelected(null); }}>{Number(date.slice(-2))}</button>
          <div className="space-y-1">{dayEvents.slice(0, 3).map(monthEvent)}{dayEvents.length > 3 && <button type="button" className="text-xs font-medium text-indigo-700 underline" onClick={() => { setSelectedDay(date); setSelected(null); }}>+ {dayEvents.length - 3} autres séances</button>}</div>
        </div>; })}</div>
      </div>}
    </div>
    <div aria-live="polite">
      {selected && <div className={`mt-4 rounded-xl border p-4 ${styles[selected.kind]}`}><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{selected.code} · {selected.title}</h3><button type="button" className="text-sm underline" onClick={() => setSelected(null)}>Fermer le détail</button></div>
        <p className="mt-2">{selected.name}</p><p>{formatCalendarDate(selected.date)} · {clock(selected.start)}–{clock(selected.end)} · {minutes(selected.end) - minutes(selected.start)} min</p>
        {selected.kind === "revision" && <><p className="mt-2 font-medium">À revoir : le contenu du cours{selected.sourceDate ? ` du ${formatCalendarDate(selected.sourceDate)}` : " d’origine"}.</p><p>{statuses[selected.status ?? ""]} · Cette répétition concerne cette séance de cours uniquement.</p><a href="/dashboard" className="mt-2 inline-block text-sm underline">Aller au tableau de bord pour suivre mes révisions</a></>}
      </div>}
      {selectedDay && <div className="mt-4 rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><h3 className="font-semibold">{formatCalendarDate(selectedDay)}</h3><button type="button" className="text-sm underline" onClick={() => setSelectedDay(null)}>Fermer le détail</button></div><div className="mt-3 space-y-2">{events.filter((event) => event.date === selectedDay).map(monthEvent)}{!events.some((event) => event.date === selectedDay) && <p className="text-sm text-slate-600">Aucune séance ce jour.</p>}</div></div>}
    </div>
  </section>;
}
