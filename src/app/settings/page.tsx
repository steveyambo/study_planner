import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { RevisionRulesForm } from "@/components/settings/revision-rules-form";
import { DEFAULT_REVISION_INTERVALS } from "@/lib/scheduler/revision-intervals";

export const metadata: Metadata = { title: "Paramètres | Study Planner" };
const messages: Record<string, string> = { saved: "Intervalles de révision enregistrés.", invalid: "La liste doit contenir des entiers positifs uniques, séparés par des virgules. Les nombres doivent tenir dans un entier PostgreSQL et le texte ne doit pas dépasser 512 caractères.", failed: "Impossible d’enregistrer les intervalles. Réessaie." };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ result?: string | string[] }> }) {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.from("revision_rules").select("intervals").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Impossible de charger les règles de révision.");
  const intervals = (data?.intervals ?? DEFAULT_REVISION_INTERVALS) as number[];
  const { result } = await searchParams;
  const message = typeof result === "string" && Object.hasOwn(messages, result) ? messages[result] : "";
  return <>
    <h1 className="text-3xl font-bold">Paramètres</h1>
    <p className="mt-3 text-slate-600">Choisis les intervalles de ta répétition espacée.</p>
    {message && <p role="status" className="mt-6 rounded-lg bg-indigo-50 p-4 text-sm text-indigo-950">{message}</p>}
    <section className="mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Répétition espacée</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">J+1 signifie une révision le lendemain du cours. Le moteur utilisera ces intervalles pour calculer les dates souhaitées, puis les adaptera aux disponibilités et aux examens.</p>
      <RevisionRulesForm intervals={intervals} />
      <p className="mt-6 text-sm leading-6 text-slate-600">Cette étape enregistre ta règle. La génération et la replanification des séances seront ajoutées dans les prochaines étapes.</p>
    </section>
  </>;
}
