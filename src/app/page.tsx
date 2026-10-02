import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
          Ton assistant de révision
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Study Planner
        </h1>

        <p className="mt-6 text-lg leading-8 text-slate-600">
          Organise tes cours, prépare tes examens et planifie tes révisions
          selon tes disponibilités.
        </p>

        <div className="mt-8 rounded-xl bg-indigo-50 p-6">
          <h2 className="font-semibold text-indigo-950">
            Notre règle de départ
          </h2>

          <p className="mt-2 text-indigo-900">
            1 heure de cours = 2 heures de révision.
          </p>

          <p className="mt-2 text-sm leading-6 text-indigo-800">
            Les révisions seront réparties à J+1, J+3, J+7 et J+14.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
        >
          Ouvrir le tableau de bord
        </Link>
      </section>
    </main>
  );
}
