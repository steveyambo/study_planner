import { unstable_rethrow } from "next/navigation";
import type { ActivePage } from "@/components/layout/mobile-navigation";
import { SetupNudge } from "@/components/onboarding/setup-nudge";
import { loadSetupProgress } from "@/lib/onboarding/load-setup-progress";

export async function SetupAssistant({ page }: { page: ActivePage }) {
  if (page === "guide" || page === "settings") return null;

  let setup: Awaited<ReturnType<typeof loadSetupProgress>>;
  try {
    setup = await loadSetupProgress();
  } catch (error) {
    unstable_rethrow(error);
    // L'aide ne doit pas bloquer la page ni présenter des données vides après une erreur.
    return null;
  }
  return <SetupNudge userId={setup.userId} progress={setup.progress} page={page} />;
}
