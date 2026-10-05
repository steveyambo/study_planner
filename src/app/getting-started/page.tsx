import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { SetupGuide } from "@/components/onboarding/setup-guide";
import { loadSetupProgress } from "@/lib/onboarding/load-setup-progress";

export const metadata: Metadata = { title: "Guide de démarrage | Study Planner" };

export default async function GettingStartedPage() {
  const { userId, fullName, progress } = await loadSetupProgress();
  return <AppShell fullName={fullName} activePage="guide"><SetupGuide userId={userId} progress={progress} /></AppShell>;
}
