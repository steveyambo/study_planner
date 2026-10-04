import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Check, Clock3 } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-dvh px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-slate-200/70 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Brand href="/" /><Button variant="ghost" asChild className="px-3"><Link href="/login">Connexion<ArrowRight aria-hidden="true" /></Link></Button>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 py-12 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-20">
        <section>
          <p className="text-xs font-medium tracking-wide text-slate-500">COURS · RÉVISIONS · EXAMENS</p>
          <h1 className="mt-4 max-w-lg text-[2.25rem] font-semibold leading-[1.12] tracking-[-.045em] text-slate-950 sm:text-5xl">Tes révisions,<br />au bon moment.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-500">Un planning qui suit tes cours et respecte tes disponibilités. Tu sais quoi revoir, quand le faire, et ce qu’il te reste.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg"><Link href="/register">Créer mon compte<ArrowRight aria-hidden="true" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">Se connecter</Link></Button>
          </div>
          <div className="mt-8 space-y-3 text-sm text-slate-600">
            {["Tes horaires de cours et tes dates d’examen", "Des répétitions espacées, adaptées à ta semaine", "Un suivi simple du travail réellement terminé"].map((text) => <p key={text} className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden="true" />{text}</p>)}
          </div>
        </section>
        <section aria-label="Exemple d’une journée de révision" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_28px_rgba(16,24,40,.04)] sm:p-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5"><div><p className="text-xs font-medium text-slate-500">EXEMPLE DE JOURNÉE</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Lundi</h2></div><CalendarDays className="size-5 text-slate-500" strokeWidth={1.5} aria-hidden="true" /></div>
          <div className="mt-5 space-y-3">
            {[
              { time: "10:00", end: "11:30", code: "Algorithmique", detail: "Révision 2 · Cours du lundi précédent", tone: "bg-indigo-50 text-indigo-600", icon: BookOpen },
              { time: "11:45", end: "12:08", code: "Anglais", detail: "Révision 1 · Expression orale", tone: "bg-sky-50 text-sky-600", icon: BookOpen },
              { time: "14:30", end: "16:00", code: "Sécurité informatique", detail: "Révision 3 · 1 h 30", tone: "bg-amber-50 text-amber-700", icon: Clock3 },
            ].map(({ time, end, code, detail, tone, icon: Icon }, index) => <div key={code} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2" style={{ animationDuration: `${200 + index * 80}ms` }}>
              <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="size-4" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><p className="text-xs font-medium tabular-nums text-slate-500">{time} — {end}</p><p className="mt-1 text-sm font-semibold text-slate-900">{code}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>
            </div>)}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-5"><p className="text-xs text-slate-500">Un même contenu, revu plusieurs fois.</p><div className="mt-3 flex items-center justify-between gap-2">{["J+1", "J+3", "J+7", "J+14"].map((day) => <span key={day} className="flex h-9 flex-1 items-center justify-center rounded-lg bg-slate-50 text-xs font-semibold text-slate-600">{day}</span>)}</div><p className="mt-3 text-xs leading-5 text-slate-500">Le rythme et le temps de révision se règlent selon tes besoins.</p></div>
        </section>
      </div>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 py-5 text-xs text-slate-500"><span>Study Planner</span><span>Une semaine organisée, à ton rythme.</span></footer>
    </main>
  );
}
