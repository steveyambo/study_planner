import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:block focus:p-4">
        Aller au contenu
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="text-xl font-bold text-indigo-700">
            Study Planner
          </Link>
          <nav aria-label="Navigation principale">
            <Link href="/dashboard" aria-current="page" className="rounded-lg bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">
              Tableau de bord
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-6xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
