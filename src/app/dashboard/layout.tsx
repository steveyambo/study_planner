import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/supabase/require-user";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { supabase, userId } = await requireUser();
  const { data: profile, error } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  if (error) throw new Error("Impossible de charger le profil utilisateur.");
  return <AppShell fullName={profile?.full_name || ""}>{children}</AppShell>;
}
