"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, GraduationCap, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { addDays, calendarDate, calendarDays, calendarEvents, eventColumns, minutes, shiftMonth, type CalendarData, type CalendarEvent } from "@/lib/calendar/events";
import { formatCalendarDate } from "@/lib/utils/calendar-date";

const styles = {
  course: { surface: "border-sky-200 bg-sky-50 text-sky-950", icon: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  revision: { surface: "border-indigo-200 bg-indigo-50 text-indigo-950", icon: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  exam: { surface: "border-amber-200 bg-amber-50 text-amber-950", icon: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
};
const kinds = { course: "Cours", revision: "Révision", exam: "Examen" };
const icons = { course: BookOpen, revision: RefreshCw, exam: GraduationCap };
const statuses: Record<string, string> = { planned: "Planifiée", completed: "Terminée", missed: "Manquée" };
const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr", { timeZone: "UTC", ...options }).format(calendarDate(date));
const clock = (value: string) => value.slice(0, 5);
const durationLabel = (value: number) => value < 60 ? `${value} min` : `${Math.floor(value / 60)} h${value % 60 ? ` ${String(value % 60).padStart(2, "0")}` : ""}`;
const control = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export function VisualCalendar({ today, data }: { today: string; data: CalendarData }) {
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState(today);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const days = useMemo(() => calendarDays(anchor, view), [anchor, view]);
  const events = useMemo(() => calendarEvents(data, days), [data, days]);
  const activeDay = days.includes(selectedDay) ? selectedDay : days[0];
  const dayEvents = events.filter((event) => event.date === activeDay);
  const firstHour = Math.max(0, Math.min(8, ...events.map((event) => Math.floor(minutes(event.start) / 60))));
  const lastHour = Math.min(24, Math.max(20, ...events.map((event) => Math.ceil(Math.max(minutes(event.end), minutes(event.start) + 30) / 60))));
  const height = (lastHour - firstHour) * 64;

  const navigate = (amount: number) => {
    const next = view === "week" ? addDays(activeDay, amount * 7) : shiftMonth(anchor, amount);
    setAnchor(next); setSelectedDay(next); setSelected(null);
  };
  const goToday = () => { setAnchor(today); setSelectedDay(today); setSelected(null); };
  const changeView = (mode: "week" | "month") => {
    if (mode === view) return;
    setView(mode); setAnchor(activeDay); setSelected(null);
  };
  const chooseDay = (date: string) => { setSelectedDay(date); setSelected(null); };
  const chooseEvent = (event: CalendarEvent, trigger: HTMLButtonElement | null) => { detailTrigger.current = trigger; setSelected(event); };
  const eventLabel = (event: CalendarEvent) => `${kinds[event.kind]} · ${event.code} · ${formatCalendarDate(event.date)} · ${clock(event.start)}–${clock(event.end)} · ${event.title}${event.status ? ` · ${statuses[event.status]}` : ""}`;

  const agendaEvent = (event: CalendarEvent) => {
    const Icon = icons[event.kind];
    return <li key={event.id}>
      <button type="button" onClick={(click) => chooseEvent(event, click.currentTarget)} aria-label={eventLabel(event)} className="group grid min-h-24 w-full grid-cols-[58px_minmax(0,1fr)_16px] items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition-colors hover:border-indigo-200 hover:bg-slate-50/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:grid-cols-[70px_minmax(0,1fr)_20px] sm:p-4">
        <span className="pt-0.5 text-sm tabular-nums"><span className="block font-semibold text-slate-950">{clock(event.start)}</span><span className="mt-1 block text-xs text-slate-500">{clock(event.end)}</span></span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2"><span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${styles[event.kind].icon}`}><Icon className="size-3.5" aria-hidden="true" /></span><span className="truncate text-sm font-semibold text-slate-950">{event.code}</span></span>
          <span className="mt-2 block text-sm text-slate-700">{event.kind === "revision" ? event.title : event.kind === "exam" ? event.title : "Cours"} <span className="text-slate-400">·</span> {durationLabel(minutes(event.end) - minutes(event.start))}</span>
          {event.kind === "revision" && event.sourceDate && <span className="mt-1 block text-xs leading-relaxed text-slate-500">À revoir : cours du {dateLabel(event.sourceDate, { day: "numeric", month: "short" })}</span>}
          {event.kind !== "revision" && event.name && <span className="mt-1 block truncate text-xs text-slate-500">{event.name}</span>}
          {event.status === "completed" && <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><Check className="size-3.5" aria-hidden="true" />Terminée</span>}
          {event.status === "missed" && <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-800"><AlertCircle className="size-3.5" aria-hidden="true" />Manquée · à rattraper</span>}
        </span>
        <ChevronRight className="mt-1 size-4 text-slate-400 group-hover:text-indigo-600" aria-hidden="true" />
      </button>
    </li>;
  };

  const agenda = () => <div className="mt-5" aria-label={`Agenda du ${formatCalendarDate(activeDay)}`}>
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold capitalize text-slate-900" aria-live="polite"><time dateTime={activeDay}>{dateLabel(activeDay, { weekday: "long", day: "numeric", month: "long" })}</time></h3>
      <span className="shrink-0 text-xs text-slate-500">{dayEvents.length} séance{dayEvents.length > 1 ? "s" : ""}</span>
    </div>
    {dayEvents.length ? <ul className="space-y-2.5">{dayEvents.map(agendaEvent)}</ul> : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center">
      <CalendarDays className="mx-auto mb-3 size-6 text-slate-400" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-700">Aucune séance ce jour.</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">Sélectionne une autre date pour consulter ton agenda.</p>
    </div>}
  </div>;

  const monthEvent = (event: CalendarEvent) => <button key={event.id} type="button" onClick={(click) => chooseEvent(event, click.currentTarget)} aria-label={eventLabel(event)} className={`block w-full truncate rounded-lg border px-2 py-2 text-left text-xs transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-indigo-600 ${styles[event.kind].surface}`}>
    <span className="font-medium">{clock(event.start)} · {event.code}</span><span className="mt-0.5 block truncate">{event.kind === "revision" ? event.title : kinds[event.kind]}{event.status === "completed" ? " ✓" : event.status === "missed" ? " · Manquée" : ""}</span>
  </button>;

  return <section className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 lg:p-6" aria-labelledby="calendar-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="calendar-title" className="text-lg font-semibold tracking-tight text-slate-950">Mon calendrier</h2><p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">Tes cours et tes révisions, jour après jour.</p></div>
      <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Vue du calendrier">{(["week", "month"] as const).map((mode) => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => changeView(mode)} className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${view === mode ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>{mode === "week" ? "Semaine" : "Mois"}</button>)}</div>
    </div>

    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold capitalize text-slate-900 sm:text-base" aria-live="polite">{view === "week" ? `${dateLabel(days[0], { day: "numeric", month: "short" })} – ${dateLabel(days[6], { day: "numeric", month: "short", year: "numeric" })}` : dateLabel(anchor, { month: "long", year: "numeric" })}</p>
      <div className="flex items-center gap-1.5">
        <button type="button" className={control} aria-label={view === "week" ? "Semaine précédente" : "Mois précédent"} onClick={() => navigate(-1)}><ChevronLeft className="size-4" aria-hidden="true" /></button>
        <button type="button" className={control} onClick={goToday}>Aujourd’hui</button>
        <button type="button" className={control} aria-label={view === "week" ? "Semaine suivante" : "Mois suivant"} onClick={() => navigate(1)}><ChevronRight className="size-4" aria-hidden="true" /></button>
      </div>
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500" aria-label="Légende du calendrier">{(["course", "revision", "exam"] as const).map((kind) => <span key={kind} className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${styles[kind].dot}`} aria-hidden="true" />{kinds[kind]}</span>)}</div>
    {!data.courseStart && !data.courseEnd && data.courses.some((course) => !course.archived_at && (!course.starts_on || !course.ends_on)) && <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-600">Renseigne les dates des matières ou enregistre un planning pour afficher tous les cours hebdomadaires.</p>}
    {!events.length && <p role="status" className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">Aucune séance dans cette période. Change de semaine ou de mois, ou prépare ton planning ci-dessous.</p>}

    {view === "week" ? <>
      <div className="mt-5 lg:hidden" aria-label="Agenda hebdomadaire">
        <div className="grid grid-cols-7 gap-0.5 pb-1 sm:gap-1" role="group" aria-label="Choisir un jour de la semaine">
          {days.map((date) => {
            const hasEvents = events.some((event) => event.date === date);
            return <button key={date} type="button" aria-label={`Voir les séances du ${formatCalendarDate(date)}`} aria-pressed={date === activeDay} onClick={() => chooseDay(date)} className={`flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 sm:text-xs ${date === activeDay ? "bg-indigo-600 text-white" : date === today ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}>
              <span>{dateLabel(date, { weekday: "short" }).replace(".", "")}</span>
              <time dateTime={date} className="text-base font-semibold">{Number(date.slice(-2))}</time>
              <span className={`size-1 rounded-full ${hasEvents ? date === activeDay ? "bg-white" : "bg-slate-400" : "bg-transparent"}`} aria-hidden="true" />
            </button>;
          })}
        </div>
        {agenda()}
      </div>
      <div className="mt-5 hidden overflow-x-auto rounded-xl border border-slate-200 lg:block" tabIndex={0} role="region" aria-label="Calendrier hebdomadaire">
        <div className="min-w-[850px]">
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-slate-200"><div />{days.map((date) => <div key={date} className={`border-l border-slate-200 py-3 text-center text-xs ${date === today ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-500"}`}><span className="capitalize">{dateLabel(date, { weekday: "short" })}</span><time dateTime={date} className="mt-1 block text-sm font-semibold">{dateLabel(date, { day: "numeric", month: "short" })}</time></div>)}</div>
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]" style={{ height }}>
            <div className="relative text-xs tabular-nums text-slate-400">{Array.from({ length: lastHour - firstHour }, (_, i) => <span key={i} className="absolute right-2" style={{ top: i * 64 + 2 }}>{String(firstHour + i).padStart(2, "0")}:00</span>)}</div>
            {days.map((date) => <div key={date} className={`relative border-l border-slate-200 ${date === today ? "bg-indigo-50/20" : ""}`} style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 63px, #e2e8f0 63px, #e2e8f0 64px)" }}>
              {eventColumns(events.filter((event) => event.date === date)).map(({ event, lane, columns }) => <button key={event.id} type="button" aria-label={eventLabel(event)} title={eventLabel(event)} onClick={(click) => chooseEvent(event, click.currentTarget)} className={`absolute overflow-hidden rounded-lg border text-left text-[11px] leading-tight transition-colors hover:brightness-95 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-indigo-600 ${minutes(event.end) - minutes(event.start) < 45 ? "p-1" : "p-1.5"} ${styles[event.kind].surface}`} style={{ top: (minutes(event.start) - firstHour * 60) * 64 / 60, height: Math.max(30, minutes(event.end) - minutes(event.start)) * 64 / 60 - 2, left: `calc(${lane * 100 / columns}% + 2px)`, width: `calc(${100 / columns}% - 4px)` }}>
                <span className="flex justify-between gap-1 font-semibold"><span className="truncate">{event.code}{event.status === "completed" ? " ✓" : ""}</span>{event.kind === "revision" && minutes(event.end) - minutes(event.start) < 45 && <span className="shrink-0 text-[10px]">{event.title.replace("Révision ", "R")}</span>}</span><span className="block">{clock(event.start)}–{clock(event.end)}</span>{minutes(event.end) - minutes(event.start) >= 45 && <span className="mt-0.5 block">{event.kind === "revision" ? event.title : kinds[event.kind]}{event.status === "missed" ? " · Manquée" : ""}</span>}
              </button>)}
            </div>)}
          </div>
        </div>
      </div>
    </> : <>
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200" role="region" aria-label="Calendrier mensuel">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-medium text-slate-500 lg:text-xs">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => <div key={label} className="py-3">{label}</div>)}</div>
        <div className="grid grid-cols-7">{days.map((date) => {
          const items = events.filter((event) => event.date === date);
          const outsideMonth = date.slice(0, 7) !== anchor.slice(0, 7);
          return <div key={date} className={`min-w-0 border-r border-b border-slate-100 last:border-r-0 lg:min-h-44 lg:p-2 ${outsideMonth ? "bg-slate-50 text-slate-400" : "text-slate-700"} ${date === activeDay ? "bg-indigo-50/70" : ""}`}>
            <button type="button" aria-label={`Voir les séances du ${formatCalendarDate(date)}`} aria-pressed={date === activeDay} onClick={() => chooseDay(date)} className="flex min-h-[76px] w-full flex-col items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600 lg:min-h-11 lg:w-11 lg:rounded-lg lg:gap-0">
              <time dateTime={date} className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${date === activeDay ? "bg-indigo-600 text-white" : date === today ? "font-bold text-indigo-600 ring-1 ring-indigo-300" : ""}`}>{Number(date.slice(-2))}</time>
              <span className="flex h-1 items-center gap-0.5 lg:hidden" aria-hidden="true">{[...new Set(items.map((event) => event.kind))].map((kind) => <span key={kind} className={`size-1 rounded-full ${styles[kind].dot}`} />)}</span>
              <span className="sr-only">{items.length} séance{items.length > 1 ? "s" : ""}</span>
            </button>
            <div className="mt-2 hidden space-y-1 lg:block">{items.slice(0, 3).map(monthEvent)}{items.length > 3 && <button type="button" className="min-h-11 text-xs font-medium text-indigo-700 hover:underline" onClick={() => chooseDay(date)}>+ {items.length - 3} autres séances</button>}</div>
          </div>;
        })}</div>
      </div>
      {agenda()}
    </>}

    {selected && <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <SheetContent side="responsive" onCloseAutoFocus={(event) => { event.preventDefault(); detailTrigger.current?.focus(); }} className="border-slate-200 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-6">
        <SheetHeader className="pr-8 text-left">
          <span className={`mb-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${styles[selected.kind].icon}`}><span className={`size-1.5 rounded-full ${styles[selected.kind].dot}`} aria-hidden="true" />{kinds[selected.kind]}</span>
          <SheetTitle className="min-w-0 break-words text-xl tracking-tight">{selected.code} · {selected.title}</SheetTitle>
          <SheetDescription className="min-w-0 break-words">{selected.name || kinds[selected.kind]}</SheetDescription>
        </SheetHeader>
        <dl className="my-6 space-y-4 text-sm">
          <div className="flex gap-3"><CalendarDays className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" /><div><dt className="text-xs text-slate-500">Prévu le</dt><dd className="mt-1 font-medium capitalize text-slate-900">{dateLabel(selected.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</dd></div></div>
          <div className="flex gap-3"><Clock3 className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" /><div><dt className="text-xs text-slate-500">Horaire</dt><dd className="mt-1 font-medium tabular-nums text-slate-900">{clock(selected.start)}–{clock(selected.end)} <span className="font-normal text-slate-500">· {durationLabel(minutes(selected.end) - minutes(selected.start))}</span></dd></div></div>
        </dl>
        {selected.kind === "revision" ? <>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><p className="text-sm font-semibold text-indigo-950">À revoir : le contenu du cours{selected.sourceDate ? ` du ${formatCalendarDate(selected.sourceDate)}` : " d’origine"}.</p><p className="mt-2 text-sm leading-relaxed text-indigo-900/80">Cette répétition concerne cette séance de cours uniquement.</p></div>
          <p className={`mt-4 text-sm font-medium ${selected.status === "completed" ? "text-emerald-700" : selected.status === "missed" ? "text-amber-800" : "text-slate-600"}`}>{statuses[selected.status ?? ""]}{selected.status === "missed" ? " · à rattraper" : ""}</p>
          <a href="/dashboard" className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Aller au tableau de bord pour suivre mes révisions</a>
        </> : <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">{selected.kind === "course" ? "Ce créneau correspond à ton cours. Les révisions de son contenu apparaissent séparément dans l’agenda." : "Retrouve les dates et les informations de cet examen dans la page Examens."}</p>}
      </SheetContent>
    </Sheet>}
  </section>;
}
