"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { BookOpen, CalendarDays, ChevronRight, Clock3, GraduationCap, LayoutDashboard, MoreHorizontal, Settings2 } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { Brand } from "@/components/layout/brand";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";

export type ActivePage = "dashboard" | "courses" | "exams" | "availability" | "settings" | "calendar";
const primary = [
  { page: "dashboard", href: "/dashboard", label: "Aujourd’hui", icon: LayoutDashboard },
  { page: "calendar", href: "/calendar", label: "Agenda", icon: CalendarDays },
  { page: "courses", href: "/courses", label: "Cours", icon: BookOpen },
] as const;
const more = [
  { page: "exams", href: "/exams", label: "Examens", detail: "Dates et échéances", icon: GraduationCap },
  { page: "availability", href: "/availability", label: "Disponibilités", detail: "Tes créneaux de travail", icon: Clock3 },
  { page: "settings", href: "/settings", label: "Paramètres", detail: "Le rythme de tes révisions", icon: Settings2 },
] as const;

export function MobileNavigation({ activePage, fullName }: { activePage: ActivePage; fullName: string }) {
  const [open, setOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
  const firstMenuLink = useRef<HTMLAnchorElement | null>(null);
  const moreActive = more.some((item) => item.page === activePage);
  const initials = fullName.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("") || "SP";
  return <Sheet open={open} onOpenChange={setOpen}>
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Brand />
        <SheetTrigger asChild><button type="button" onClick={(event) => { menuTrigger.current = event.currentTarget; }} aria-label="Ouvrir le menu et mon compte" className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">{initials}</button></SheetTrigger>
      </div>
    </header>
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 px-2 py-1.5">
        {primary.map(({ page, href, label, icon: Icon }) => <Link key={page} href={href} aria-current={activePage === page ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors", activePage === page ? "text-indigo-700" : "text-slate-500 hover:text-slate-900")}>
          <span className={cn("flex h-7 w-12 items-center justify-center rounded-lg", activePage === page && "bg-indigo-50")}><Icon className="size-5" strokeWidth={activePage === page ? 2.1 : 1.8} aria-hidden="true" /></span>
          {label}
        </Link>)}
        <SheetTrigger asChild><button type="button" onClick={(event) => { menuTrigger.current = event.currentTarget; }} aria-label="Plus : examens, disponibilités et paramètres" className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium", moreActive ? "text-indigo-700" : "text-slate-500 hover:text-slate-900")}>
          <span className={cn("flex h-7 w-12 items-center justify-center rounded-lg", moreActive && "bg-indigo-50")}><MoreHorizontal className="size-5" aria-hidden="true" /></span>Plus
        </button></SheetTrigger>
      </div>
    </nav>
    <SheetContent side="bottom" onOpenAutoFocus={(event) => { event.preventDefault(); firstMenuLink.current?.focus(); }} onCloseAutoFocus={(event) => { event.preventDefault(); menuTrigger.current?.focus(); }} className="mx-auto max-w-lg">
      <SheetHeader><SheetTitle>Ton espace</SheetTitle><SheetDescription>{fullName || "Organise tes révisions à ton rythme."}</SheetDescription></SheetHeader>
      <nav aria-label="Autres pages" className="mt-6 divide-y divide-slate-100">
        {more.map(({ page, href, label, detail, icon: Icon }) => <Link key={page} ref={page === "exams" ? firstMenuLink : undefined} href={href} aria-current={activePage === page ? "page" : undefined} onClick={() => setOpen(false)} className="flex min-h-20 items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-slate-50">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500", activePage === page && "bg-indigo-50 text-indigo-700")}><Icon className="size-5" aria-hidden="true" /></span>
          <span className="flex-1"><span className="block text-sm font-semibold text-slate-900">{label}</span><span className="mt-1 block text-xs text-slate-500">{detail}</span></span>
          <ChevronRight className="size-4 text-slate-400" aria-hidden="true" />
        </Link>)}
      </nav>
      <div className="mt-5 border-t border-slate-100 pt-4"><LogoutButton /></div>
    </SheetContent>
  </Sheet>;
}
