import type { ReactNode } from "react";
import { requireUser } from "@/lib/supabase/require-user";
import { AppShell } from "@/components/layout/app-shell";

export default async function ExamsLayout({ children }: { children: ReactNode }) {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  if (error) throw new Error("Impossible de charger le profil utilisateur.");
  return <AppShell fullName={data?.full_name ?? ""} activePage="exams">{children}</AppShell>;
}
