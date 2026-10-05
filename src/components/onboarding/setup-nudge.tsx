"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Compass, Pause } from "lucide-react";
import type { ActivePage } from "@/components/layout/mobile-navigation";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/lib/courses/session-time";
import { getNextSetupStep, SETUP_STEP_IDS, setupStepIsComplete, type SetupProgress, type SetupStepId } from "@/lib/onboarding/setup-progress";
import { useSetupPreferences } from "@/lib/onboarding/use-setup-preferences";
import { cn } from "@/lib/utils/cn";

const stepHints: Record<SetupStepId, { title: string; description: string }> = {
  intro: { title: "Prépare ton premier planning", description: "Le guide t’accompagne à partir de tes données enregistrées." },
  courses: { title: "Ajoute ta première matière", description: "Dans Mes cours, renseigne le code et le nom de ta matière. Tu pourras ensuite lui ajouter ses horaires." },
  hours: { title: "Ajoute les horaires de chaque cours", description: "Les horaires indiquent quand tu suis tes cours et servent à répartir leurs révisions." },
  availability: { title: "Définis tes disponibilités", description: "Ajoute les moments de la semaine où tu souhaites réviser. Le planning utilisera ces créneaux." },
  exams: { title: "Renseigne tes examens si tu les connais", description: "Ajoute les échéances connues. Le guide permet aussi de continuer sans examen pour le moment." },
  planning: { title: "Calcule puis enregistre ton planning", description: "Dans Agenda & planning, choisis une période, calcule un aperçu puis enregistre-le pour retrouver tes révisions." },
  complete: { title: "Ton premier planning est prêt", description: "Retrouve tes révisions dans l’agenda et sur ton tableau de bord." },
};

function pageHint(page: ActivePage, progress: SetupProgress, nextStep: SetupStepId, examsReviewed: boolean) {
  if (page === "courses") {
    if (!progress.courseCount) return { ...stepHints.courses, description: "Utilise « Ajouter un cours » pour renseigner ta première matière. Ensuite, ajoute ses horaires hebdomadaires." };
    if (progress.coursesWithoutHours.length) return { ...stepHints.hours, description: `${progress.coursesWithoutHours.length} ${progress.coursesWithoutHours.length === 1 ? "matière attend ses horaires" : "matières attendent leurs horaires"}. Dans chaque carte de cours, utilise « Ajouter un horaire ».` };
    return { title: "Tes cours et leurs horaires sont enregistrés", description: `${progress.weeklySessionCount} ${progress.weeklySessionCount === 1 ? "horaire hebdomadaire" : "horaires hebdomadaires"} pour ${progress.courseCount} ${progress.courseCount === 1 ? "matière" : "matières"}. Continue le guide pour préparer la suite.` };
  }
  if (page === "availability") {
    return progress.availabilityCount
      ? { title: "Tes disponibilités sont enregistrées", description: `${formatMinutes(progress.weeklyAvailableMinutes)} par semaine dans ${progress.availabilityCount} ${progress.availabilityCount === 1 ? "créneau" : "créneaux"}. Tu peux en ajouter d’autres ou continuer le guide.` }
      : { ...stepHints.availability, description: "Utilise « Ajouter un créneau » pour choisir un jour et une plage horaire où tu souhaites réviser." };
  }
  if (page === "exams") {
    if (!progress.courseCount) return { title: "Ajoute d’abord une matière", description: "Chaque examen est lié à un cours. Le guide t’aide à ajouter tes matières avant leurs échéances." };
    if (progress.upcomingExamCount) return { title: "Tes prochains examens sont enregistrés", description: `${progress.upcomingExamCount} ${progress.upcomingExamCount === 1 ? "examen à venir" : "examens à venir"}. Le planning tiendra compte de ces dates.` };
    if (examsReviewed) return { title: "Tu peux ajouter tes examens plus tard", description: "Tu as choisi de continuer sans examen pour le moment. Reviens ici quand tu connaîtras leurs dates." };
    return { ...stepHints.exams, description: "Utilise « Ajouter un examen » pour une échéance connue, ou retourne au guide pour continuer sans examen pour le moment." };
  }
  if (page === "calendar" && nextStep === "planning" && progress.hasSavedPlanning && !progress.planningIsCurrent) {
    return { title: "Actualise ton planning", description: "Tes données ont changé. Calcule un nouvel aperçu puis enregistre-le pour terminer cette étape." };
  }
  return stepHints[nextStep];
}

function checklistLabel(progress: SetupProgress, step: typeof SETUP_STEP_IDS[number], examsReviewed: boolean) {
  switch (step) {
    case "courses": return `Cours : ${progress.courseCount}`;
    case "hours": return `Horaires : ${progress.courseCount - progress.coursesWithoutHours.length}/${progress.courseCount} cours`;
    case "availability": return `Disponibilités : ${formatMinutes(progress.weeklyAvailableMinutes)}/sem.`;
    case "exams": return `Examens : ${progress.upcomingExamCount || (examsReviewed ? "plus tard" : "0")}`;
    case "planning": return `Planning : ${progress.hasSavedPlanning ? (progress.planningIsCurrent ? "à jour" : "à actualiser") : "à enregistrer"}`;
  }
}

export function SetupNudge({ progress, userId, page }: { progress: SetupProgress; userId: string; page: ActivePage }) {
  const { preferences, updatePreferences } = useSetupPreferences(userId);
  if (page === "guide" || page === "settings") return null;

  if (page === "dashboard" && !progress.hasSavedPlanning && !preferences.welcomeDismissed && !preferences.started) {
    return <section aria-labelledby="setup-welcome-title" className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600"><Compass aria-hidden="true" className="size-5" /></span>
        <div className="min-w-0">
          <h2 id="setup-welcome-title" className="text-base font-semibold text-slate-950">Bienvenue dans Study Planner</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">Transforme tes cours et tes disponibilités en un planning de révision. Le guide t’accompagne jusqu’à ton premier planning enregistré, à ton rythme.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link href="/getting-started">Commencer <ArrowRight aria-hidden="true" /></Link></Button>
            <Button variant="ghost" size="sm" onClick={() => updatePreferences({ welcomeDismissed: true })}>Plus tard</Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Tu peux retrouver le Guide de démarrage dans le menu.</p>
        </div>
      </div>
    </section>;
  }

  if (!preferences.started || preferences.paused) return null;
  const nextStep = getNextSetupStep(progress, preferences.examsReviewed);
  if (nextStep === "complete") return null;
  const completedCount = SETUP_STEP_IDS.filter((step) => setupStepIsComplete(progress, step, preferences.examsReviewed)).length;
  const hint = pageHint(page, progress, nextStep, preferences.examsReviewed);
  const firstMissingHours = page === "courses" ? progress.coursesWithoutHours[0] : undefined;

  return <section aria-labelledby="setup-nudge-title" className="mb-6 rounded-2xl border border-indigo-100 bg-white p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-indigo-700"><Compass aria-hidden="true" className="size-4" /> Guide de démarrage <span className="text-slate-500">· {completedCount}/{SETUP_STEP_IDS.length} étapes terminées</span></p>
        <h2 id="setup-nudge-title" className="mt-2 text-sm font-semibold text-slate-950">{hint.title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{hint.description}</p>
        {firstMissingHours && <Link href={`/courses#course-${firstMissingHours.id}`} className="mt-1 inline-flex min-h-11 items-center gap-1 break-words text-sm font-medium text-indigo-700 underline underline-offset-4">Ajouter les horaires de {firstMissingHours.code}<ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/getting-started">Continuer le guide <ArrowRight aria-hidden="true" /></Link></Button>
        <Button variant="ghost" size="sm" onClick={() => updatePreferences({ paused: true })}><Pause aria-hidden="true" />Mettre en pause</Button>
      </div>
    </div>
    <ul aria-label="Progression de la configuration" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
      {SETUP_STEP_IDS.map((step) => {
        const complete = setupStepIsComplete(progress, step, preferences.examsReviewed);
        const Icon = complete ? CheckCircle2 : Circle;
        return <li key={step} className={cn("flex min-w-0 items-center gap-1.5 text-xs leading-5", complete ? "text-slate-600" : "text-slate-500")}><Icon aria-hidden="true" className={cn("size-3.5 shrink-0", complete && "text-emerald-600")} /><span><span className="sr-only">{complete ? "Étape terminée : " : "À compléter : "}</span>{checklistLabel(progress, step, preferences.examsReviewed)}</span></li>;
      })}
    </ul>
  </section>;
}
