import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Repeat2 } from "lucide-react";
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
    <header className="page-header"><div><p className="page-eyebrow">Mes préférences</p><h1 className="page-title">Paramètres</h1><p className="page-description">Adapte le rythme de tes répétitions.</p></div></header>
    {message && <p role="status" className="mt-6 rounded-lg bg-indigo-50 p-4 text-sm text-indigo-950">{message}</p>}
    <section className="surface-card mt-6 max-w-2xl p-4 sm:p-6">
      <div className="flex items-center gap-2.5"><Repeat2 aria-hidden="true" className="size-5 text-slate-400" /><h2 className="text-lg font-semibold tracking-tight">Répétition espacée</h2></div>
      <p className="mt-3 text-sm leading-7 text-slate-600">J+1 signifie une révision le lendemain du cours. Le moteur utilisera ces intervalles pour calculer les dates souhaitées, puis les adaptera aux disponibilités et aux examens.</p>
      <RevisionRulesForm intervals={intervals} />
      <p className="mt-6 text-sm leading-6 text-slate-600">Les nouveaux intervalles seront utilisés lors du prochain calcul. Les séances déjà terminées restent conservées.</p>
      <Link href="/calendar" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-indigo-700">Recalculer mon planning<ArrowRight aria-hidden="true" className="size-4" /></Link>
    </section>
  </>;
}
