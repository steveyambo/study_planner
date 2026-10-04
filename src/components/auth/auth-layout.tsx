import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarCheck2 } from "lucide-react";
import { Brand } from "@/components/layout/brand";

export function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="min-h-dvh px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8">
    <header className="mx-auto flex max-w-6xl items-center justify-between"><Brand href="/" /><Link href="/" aria-label="Revenir à l’accueil" className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><ArrowLeft className="size-4" aria-hidden="true" /></Link></header>
    <div className="mx-auto mt-10 grid max-w-4xl items-center gap-16 pb-8 sm:mt-16 lg:grid-cols-2 lg:pt-10">
      <div className="hidden lg:block">
        <div className="mb-6 inline-flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-white"><CalendarCheck2 className="size-6 text-indigo-600" strokeWidth={1.5} aria-hidden="true" /></div>
        <h2 className="max-w-xs text-3xl font-semibold leading-tight tracking-tight text-slate-900">Un peu chaque jour.<br />Une semaine plus claire.</h2>
        <p className="mt-4 max-w-xs text-sm leading-7 text-slate-500">Tes cours, tes disponibilités et tes examens réunis dans un planning que tu peux adapter.</p>
      </div>
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(16,24,40,.025)] sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        {children}
      </section>
    </div>
  </main>;
}
