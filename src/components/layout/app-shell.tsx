import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";

export function AppShell({ children, fullName, activePage = "dashboard" }: { children: ReactNode; fullName: string; activePage?: "dashboard" | "courses" }) {
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
          <nav aria-label="Navigation principale" className="flex flex-wrap gap-2">
            <Link href="/dashboard" aria-current={activePage === "dashboard" ? "page" : undefined} className="rounded-lg px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 aria-[current=page]:bg-indigo-50">
              Tableau de bord
            </Link>
            <Link href="/courses" aria-current={activePage === "courses" ? "page" : undefined} className="rounded-lg px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 aria-[current=page]:bg-indigo-50">Mes cours</Link>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            {fullName && <p className="max-w-64 break-words text-sm text-slate-600">Bonjour {fullName}</p>}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-6xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
