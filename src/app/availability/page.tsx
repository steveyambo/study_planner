import type { Metadata } from "next";
import { ChevronDown, Clock3 } from "lucide-react";
import { AddPanel } from "@/components/courses/add-panel";
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
    <header className="page-header flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
      <div className="min-w-0"><p className="page-eyebrow">Mon rythme</p><h1 className="page-title">Mes disponibilités</h1><p className="page-description">Les moments où tu souhaites travailler, chaque semaine.</p></div>
      <AddPanel title="Ajouter un créneau" description="Choisis un jour et une plage horaire. Le planning réservera tes révisions dans ces disponibilités."><AvailabilityForm /></AddPanel>
    </header>
    {message && <p role="status" className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">{message}</p>}
    <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Clock3 aria-hidden="true" className="size-5" /></span><div><p className="text-lg font-semibold tracking-tight text-slate-950">{formatMinutes(total)} <span className="text-sm font-normal text-slate-500">par semaine</span></p><p className="mt-1 text-xs leading-5 text-slate-500">Les cours, les examens et les pauses seront déduits de ces créneaux.</p></div></div>
    <div className="mt-6 grid items-start gap-3 lg:grid-cols-2">{weekDays.map((day, index) => {
      const daily = slots.filter((slot) => slot.day_of_week === index + 1);
      const dailyMinutes = daily.reduce((sum, slot) => sum + (sessionMinutes(slot.start_time, slot.end_time) ?? 0), 0);
      return <section key={day} className="surface-card min-w-0 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">{day}</h2><span className={`text-xs ${daily.length ? "font-medium text-slate-600" : "text-slate-500"}`}>{daily.length ? formatMinutes(dailyMinutes) : "Indisponible"}</span></div>
        {daily.length > 0 && <ul className="mt-3 space-y-3">{daily.map((slot) => <li key={slot.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
          <p className="text-sm font-medium tabular-nums text-slate-800">{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} <span className="ml-1 text-xs font-normal text-slate-500">· {formatMinutes(sessionMinutes(slot.start_time, slot.end_time) ?? 0)}</span></p>
          <details className="group mt-1"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium text-slate-600">Modifier le créneau<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 text-slate-400" /></summary><div className="pb-2 pt-2"><AvailabilityForm slot={slot} /></div></details>
          <DeleteAvailabilityForm id={slot.id} />
        </li>)}</ul>}
      </section>;
    })}</div>
    {!slots.length && <p className="mt-4 text-sm leading-6 text-slate-500">Ajoute ton premier créneau avec le bouton ci-dessus. Tu pourras en définir plusieurs pour un même jour.</p>}
  </>;
}
