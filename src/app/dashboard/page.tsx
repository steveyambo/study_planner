import type { Metadata } from "next";
import { EmptyCard } from "@/components/dashboard/empty-card";

export const metadata: Metadata = {
  title: "Tableau de bord | Study Planner",
};

export default function DashboardPage() {
  return (
    <>
      <p className="text-sm font-semibold text-indigo-600">Ton espace de révision</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        Tableau de bord
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-slate-600">
        Retrouve ici tes prochaines séances, tes examens et ta progression.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <EmptyCard title="Aujourd’hui" message="Aucune séance à afficher. Tes révisions apparaîtront ici une fois ton planning généré." />
        <EmptyCard title="Prochain examen" message="Aucun examen à afficher. Tu pourras bientôt ajouter les dates de tes examens." />
        <EmptyCard title="Temps de révision du jour" message="Le temps prévu sera calculé à partir de tes séances planifiées." />
        <EmptyCard title="Progression hebdomadaire" message="Ta progression apparaîtra lorsque tu commenceras à terminer des séances." />
      </div>
      <section className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
        <h2 className="font-semibold text-indigo-950">Pour préparer ton planning</h2>
        <ol className="mt-4 list-inside list-decimal space-y-2 text-sm leading-6 text-indigo-900">
          <li>Ajouter tes cours et leurs horaires.</li>
          <li>Renseigner tes examens.</li>
          <li>Définir tes disponibilités et tes intervalles de révision.</li>
        </ol>
      </section>
    </>
  );
}
