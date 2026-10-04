import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, CalendarDays, Clock3, GraduationCap, LayoutDashboard, Settings2 } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { Brand } from "@/components/layout/brand";
import { MobileNavigation, type ActivePage } from "@/components/layout/mobile-navigation";
import { cn } from "@/lib/utils/cn";

const navigation = [
  { page: "dashboard", href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { page: "calendar", href: "/calendar", label: "Agenda & planning", icon: CalendarDays },
  { page: "courses", href: "/courses", label: "Mes cours", icon: BookOpen },
  { page: "exams", href: "/exams", label: "Examens", icon: GraduationCap },
  { page: "availability", href: "/availability", label: "Disponibilités", icon: Clock3 },
  { page: "settings", href: "/settings", label: "Paramètres", icon: Settings2 },
] as const;

export function AppShell({ children, fullName, activePage = "dashboard" }: { children: ReactNode; fullName: string; activePage?: ActivePage }) {
  return (
    <div className="min-h-dvh">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-white focus:p-4 focus:shadow-lg">
        Aller au contenu
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto border-r border-slate-200 bg-white p-5 lg:flex">
        <Brand />
        <p className="mb-3 mt-10 px-3 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Espace de travail</p>
        <nav aria-label="Navigation principale" className="space-y-1">
          {navigation.map(({ page, href, label, icon: Icon }) => <Link key={page} href={href} aria-current={activePage === page ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", activePage === page ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950")}>
            <Icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />{label}
          </Link>)}
          </nav>
        <div className="mt-auto border-t border-slate-100 pt-5">
          {fullName && <p className="mb-3 break-words px-2 text-sm font-medium text-slate-700">{fullName}</p>}
          <LogoutButton />
        </div>
      </aside>
      <MobileNavigation activePage={activePage} fullName={fullName} />
      <div className="min-w-0 lg:pl-60">
        <main id="main-content" className="mx-auto w-full max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
