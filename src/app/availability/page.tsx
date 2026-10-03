import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { AvailabilityForm, DeleteAvailabilityForm } from "@/components/availability/availability-form";
import { weekDays, sessionMinutes, formatMinutes } from "@/lib/courses/session-time";
import type { Availability } from "@/types/availability";

export const metadata: Metadata = { title: "Disponibilités | Study Planner" };
const messages: Record<string, string> = { created: "Créneau ajouté.", updated: "Créneau modifié.", deleted: "Créneau supprimé.", invalid: "Vérifie le jour et les heures : la fin doit être après le début.", overlap: "Ce créneau chevauche une disponibilité existante ce jour-là.", missing: "Ce créneau n’est plus disponible.", failed: "L’enregistrement a échoué. Réessaie." };

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ result?: string | string[] }> }) {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.from("availabilities").select("id,day_of_week,start_time,end_time").eq("user_id", userId).order("day_of_week").order("start_time");
  if (error) throw new Error("Impossible de charger les disponibilités.");
  const slots = (data ?? []) as Availability[];
  const total = slots.reduce((sum, slot) => sum + (sessionMinutes(slot.start_time, slot.end_time) ?? 0), 0);
  const { result } = await searchParams;
  const message = typeof result === "string" && Object.hasOwn(messages, result) ? messages[result] : "";
  return <>
    <h1 className="text-3xl font-bold">Mes disponibilités</h1>
    <p className="mt-3 max-w-2xl leading-7 text-slate-600">Indique les créneaux où tu peux réviser chaque semaine. Les cours et examens seront déduits par le moteur de planification.</p>
    <p className="mt-4 font-semibold text-indigo-700">Total déclaré : {formatMinutes(total)} par semaine</p>
    {message && <p role="status" className="mt-6 rounded-lg bg-indigo-50 p-4 text-sm text-indigo-950">{message}</p>}
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section className="self-start rounded-2xl border border-slate-200 bg-white p-6"><h2 className="mb-5 text-xl font-semibold">Ajouter une disponibilité</h2><AvailabilityForm /></section>
      <div className="space-y-4">{weekDays.map((day, index) => {
        const daily = slots.filter((slot) => slot.day_of_week === index + 1);
        return <section key={day} className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">{day}</h2>
          {!daily.length ? <p className="mt-3 text-sm text-slate-600">Indisponible</p> : <ul className="mt-4 space-y-4">{daily.map((slot) => <li key={slot.id} className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-medium">{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {formatMinutes(sessionMinutes(slot.start_time, slot.end_time) ?? 0)}</p>
            <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-indigo-700">Modifier le créneau</summary><div className="mt-4"><AvailabilityForm slot={slot} /></div></details>
            <DeleteAvailabilityForm id={slot.id} />
          </li>)}</ul>}
        </section>;
      })}</div>
    </div>
  </>;
}
