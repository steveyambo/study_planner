"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GuideError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg px-5 py-12">
    <h1 className="text-2xl font-semibold tracking-tight">Le guide n’a pas pu se charger</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">Tes cours et ton planning sont conservés. Réessaie pour retrouver les étapes déjà renseignées.</p>
    <div className="mt-6 flex flex-wrap gap-3"><Button onClick={reset}>Réessayer</Button><Button asChild variant="outline"><Link href="/dashboard">Retour à mon espace</Link></Button></div>
  </main>;
}
