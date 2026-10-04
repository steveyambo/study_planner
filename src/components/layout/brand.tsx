import Link from "next/link";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Brand({ className, href = "/dashboard" }: { className?: string; href?: string }) {
  return <Link href={href} className={cn("inline-flex min-h-11 items-center gap-2.5 rounded-lg text-base font-semibold tracking-tight text-slate-950", className)}>
    <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white"><BookOpen className="size-5" strokeWidth={1.8} aria-hidden="true" /></span>
    Study Planner
  </Link>;
}
