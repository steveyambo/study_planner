"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Clock3, GraduationCap, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/lib/courses/session-time";
import { getNextSetupStep, SETUP_STEP_IDS, setupStepIsComplete, type SetupProgress, type SetupStepId } from "@/lib/onboarding/setup-progress";
import { useSetupPreferences } from "@/lib/onboarding/use-setup-preferences";
import { cn } from "@/lib/utils/cn";

const steps = {
  courses: { label: "Cours", title: "Commence par tes matières", description: "Ajoute les matières que tu suis. Elles serviront de base à ton planning de révisions.", action: "Ajouter mes cours", href: "/courses", icon: BookOpen },
  hours: { label: "Horaires", title: "Quand as-tu cours ?", description: "Pour chaque matière, renseigne le jour, le début et la fin de tes cours. L’application saura quel contenu revoir et combien de temps lui consacrer.", action: "Ajouter un horaire", href: "/courses", icon: Clock3 },
  availability: { label: "Temps libre", title: "Choisis tes moments pour réviser", description: "Ajoute au moins un créneau où tu peux vraiment travailler. Les révisions seront placées dans ces disponibilités, en dehors de tes cours.", action: "Ajouter mes disponibilités", href: "/availability", icon: CalendarDays },
  exams: { label: "Examens", title: "As-tu une date d’examen ?", description: "Si tu la connais, ajoute-la : le planning pourra répartir tes révisions avant cette échéance. Tu peux aussi continuer sans date.", action: "Ajouter mes examens", href: "/exams", icon: GraduationCap },
  planning: { label: "Planning", title: "Enregistre ton premier planning", description: "Garde les réglages proposés pour commencer. Dans Planification, calcule un aperçu, vérifie les créneaux, puis enregistre le planning pour les retrouver dans ton calendrier.", action: "Préparer mon planning", href: "/calendar#replanning", icon: CalendarDays },
} as const;

type ConfigStepId = (typeof SETUP_STEP_IDS)[number];

function GuideDetails({ title, children }: { title: string; children: ReactNode }) {
  return <details className="group border-t border-slate-100">
    <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-3 text-sm font-medium text-slate-600">
      {title}<ChevronDown aria-hidden="true" className="disclosure-chevron size-4 shrink-0 text-slate-400" />
    </summary>
    <div className="space-y-3 pb-4 text-sm leading-6 text-slate-500">{children}</div>
  </details>;
}

function StepDetails({ step, progress }: { step: ConfigStepId; progress: SetupProgress }) {
  if (step === "courses") return <GuideDetails title="Que renseigner pour commencer ?">
    <p>Le code peut être une abréviation, comme BIO101. Le nom t’aide à reconnaître la matière. Le temps de révision proposé peut rester tel quel au départ.</p>
    <p>Si tu connais la période de cette matière, indique son premier et son dernier jour de cours. Sinon, la période choisie lors de la planification s’appliquera.</p>
  </GuideDetails>;
  if (step === "hours") return <GuideDetails title="Pourquoi les horaires sont-ils nécessaires ?">
    <p>Un horaire se répète chaque semaine pendant la période du cours. Sa durée sert à calculer le temps de révision. Sans horaire, cette matière ne génère pas de révisions.</p>
    <p>Exemple : pour un cours chaque lundi de 9 h à 11 h, ajoute un horaire le lundi, de 09:00 à 11:00. Tu pourras en ajouter d’autres pour la même matière.</p>
    {progress.coursesWithoutHours.length > 0 && <div>
      <p className="font-medium text-slate-700">Horaires à ajouter :</p>
      <ul className="mt-2 divide-y divide-slate-100">
        {progress.coursesWithoutHours.map((course) => <li key={course.id}>
          <Link href={`/courses#course-${course.id}`} className="flex min-h-11 items-center justify-between gap-3 py-2 font-medium text-indigo-700">
            <span className="min-w-0 break-words">{course.code}<span className="block text-xs font-normal text-slate-500">{course.name}</span></span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        </li>)}
      </ul>
    </div>}
  </GuideDetails>;
  if (step === "availability") return <GuideDetails title="Comment choisir des créneaux réalistes ?">
    <p>Commence par un ou deux moments réguliers, par exemple le mardi de 17 h à 19 h. Garde du temps pour les repas, les trajets et le repos.</p>
    <p>Ces créneaux se répètent chaque semaine. Le planning tient compte de tes horaires de cours et réserve aussi les pauses entre les révisions.</p>
  </GuideDetails>;
  if (step === "exams") return <GuideDetails title="Que change une date d’examen ?">
    <p>Elle donne une limite aux révisions de la matière. Le planning essaie de les répartir avant l’examen, en conservant des jours distincts entre les répétitions.</p>
    <p>Sans date, les révisions restent possibles dans la période du planning. Tu pourras ajouter un examen plus tard, puis recalculer.</p>
  </GuideDetails>;
  return <GuideDetails title="Comprendre les dates et les options">
    <p><span className="font-medium text-slate-700">Séances de cours à inclure :</span> choisis les cours dont tu veux revoir le contenu. Les deux dates sont incluses ; la période de chaque matière s’applique aussi.</p>
    <p><span className="font-medium text-slate-700">Période des révisions :</span> choisis quand travailler, à partir de demain. Ses deux dates sont incluses. Les révisions peuvent continuer après le dernier cours, avant l’examen.</p>
    <p>Les réglages proposés suffisent pour commencer. Si des révisions déjà échues restent réellement à faire, ouvre « Pauses et rattrapage » et coche le rattrapage. L’application ne connaît pas le travail fait en dehors de son suivi.</p>
    <p>L’aperçu indique aussi le travail qui ne trouve pas de place. Ce travail ne sera pas ajouté au calendrier ; tu pourras adapter tes disponibilités et recalculer.</p>
  </GuideDetails>;
}

function StepStatus({ step, progress, examsReviewed }: { step: ConfigStepId; progress: SetupProgress; examsReviewed: boolean }) {
  const complete = setupStepIsComplete(progress, step, examsReviewed);
  let text: string;
  switch (step) {
    case "courses": text = progress.courseCount > 0 ? `${progress.courseCount} ${progress.courseCount === 1 ? "matière active enregistrée" : "matières actives enregistrées"}.` : "Aucune matière enregistrée pour l’instant."; break;
    case "hours": text = complete ? `${progress.weeklySessionCount} ${progress.weeklySessionCount === 1 ? "horaire enregistré" : "horaires enregistrés"}. Chaque matière a au moins un horaire.` : progress.courseCount === 0 ? "Ajoute d’abord une matière pour pouvoir renseigner ses horaires." : `${progress.coursesWithoutHours.length} ${progress.coursesWithoutHours.length === 1 ? "matière attend encore un horaire" : "matières attendent encore un horaire"}.`; break;
    case "availability": text = progress.availabilityCount > 0 ? `${formatMinutes(progress.weeklyAvailableMinutes)} disponibles par semaine, sur ${progress.availabilityCount} ${progress.availabilityCount === 1 ? "créneau" : "créneaux"}.` : "Aucun créneau de révision enregistré pour l’instant."; break;
    case "exams": text = progress.upcomingExamCount > 0 ? `${progress.upcomingExamCount} ${progress.upcomingExamCount === 1 ? "examen à venir enregistré" : "examens à venir enregistrés"}.` : complete ? "Aucune date d’examen à venir enregistrée. Tu pourras l’ajouter plus tard." : "Cette étape est facultative."; break;
    case "planning": text = complete ? progress.plannedSessionCount > 0 ? `${progress.plannedSessionCount} ${progress.plannedSessionCount === 1 ? "révision planifiée dans ton calendrier" : "révisions planifiées dans ton calendrier"}.` : "Les paramètres sont enregistrés, mais aucune révision n’est actuellement planifiée dans le calendrier." : progress.hasSavedPlanning ? "Tes données ont changé depuis le dernier enregistrement. Recalcule puis enregistre un planning à jour." : "Un aperçu seul ne sauvegarde aucun créneau. L’étape se termine après l’enregistrement."; break;
  }
  return <p className={cn("flex items-start gap-2 rounded-xl p-3 text-sm leading-6", complete ? "bg-slate-50 text-slate-700" : "bg-indigo-50/70 text-indigo-950")}>
    {complete && <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-indigo-600" />}<span>{text}</span>
  </p>;
}

export function SetupGuide({ progress, userId }: { progress: SetupProgress; userId: string }) {
  const { preferences, updatePreferences } = useSetupPreferences(userId);
  const [selectedStep, setSelectedStep] = useState<{ id: SetupStepId; snapshot: string } | null>(null);
  const focusRequested = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const recommendedStep = getNextSetupStep(progress, preferences.examsReviewed);
  // A review selection belongs to the data shown when it was chosen. After a
  // form is saved, returning to this guide recommends the next missing step.
  const progressSnapshot = JSON.stringify([progress, preferences.examsReviewed]);
  const step = selectedStep?.snapshot === progressSnapshot ? selectedStep.id : preferences.started ? recommendedStep : "intro";
  const configStep = step !== "intro" && step !== "complete" ? step : null;
  const completedCount = SETUP_STEP_IDS.filter((id) => setupStepIsComplete(progress, id, preferences.examsReviewed)).length;
  const currentComplete = configStep ? setupStepIsComplete(progress, configStep, preferences.examsReviewed) : false;
  const paused = preferences.paused && preferences.started && step !== "intro";
  const currentIndex = configStep ? SETUP_STEP_IDS.indexOf(configStep) : -1;
  const current = configStep ? steps[configStep] : null;
  const hoursTarget = progress.coursesWithoutHours[0];
  const actionHref = configStep === "hours" && hoursTarget ? `/courses#course-${hoursTarget.id}` : current?.href ?? "/dashboard";

  useEffect(() => {
    if (!focusRequested.current) return;
    (buttonRef.current ?? linkRef.current)?.focus();
    focusRequested.current = false;
  }, [step, paused]);

  function navigateTo(nextStep: SetupStepId) {
    if (nextStep === step) return;
    focusRequested.current = true;
    setSelectedStep({ id: nextStep, snapshot: progressSnapshot });
  }

  function begin() {
    updatePreferences({ started: true, paused: false });
    navigateTo(recommendedStep);
  }

  function resume() {
    focusRequested.current = true;
    updatePreferences({ paused: false });
    setSelectedStep({ id: recommendedStep, snapshot: progressSnapshot });
  }

  function skipExam() {
    updatePreferences({ examsReviewed: true });
    navigateTo(getNextSetupStep(progress, true));
  }

  function leave() {
    updatePreferences({ paused: true, welcomeDismissed: true });
  }

  return <div className="mx-auto w-full max-w-3xl">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="page-eyebrow">Premiers pas</p>
      <Link href="/dashboard" onClick={leave} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
        <Pause aria-hidden="true" className="size-4" />{step === "complete" ? "Quitter le guide" : "Quitter et reprendre plus tard"}
      </Link>
    </header>

    <section aria-label="Progression de la configuration" className="mb-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{completedCount} sur {SETUP_STEP_IDS.length} étapes complétées</span>
        {preferences.started && step !== "intro" && <button type="button" onClick={() => navigateTo("intro")} className="min-h-11 font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-indigo-700">Revoir l’introduction</button>}
      </div>
      <progress className="sr-only" value={completedCount} max={SETUP_STEP_IDS.length} aria-label="Étapes de configuration complétées" />
      <ol className="grid grid-cols-5 gap-1.5 sm:gap-3">
        {SETUP_STEP_IDS.map((id, index) => {
          const done = setupStepIsComplete(progress, id, preferences.examsReviewed);
          const available = preferences.started && (done || id === recommendedStep);
          return <li key={id} className="min-w-0">
            <button type="button" disabled={!available || paused} aria-current={step === id ? "step" : undefined} aria-label={`Étape ${index + 1} : ${steps[id].label}, ${done ? "complétée" : id === recommendedStep ? "à compléter" : "à venir"}`} onClick={() => navigateTo(id)} className={cn("flex min-h-14 w-full min-w-0 flex-col items-center gap-2 rounded-lg px-0.5 py-2 text-[10px] font-medium transition-colors sm:text-xs", step === id ? "bg-indigo-50 text-indigo-700" : "text-slate-500", available ? "hover:bg-slate-100 disabled:hover:bg-transparent" : "cursor-default")}>
              <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", done ? "bg-indigo-600 text-white" : step === id ? "border border-indigo-300 bg-white text-indigo-700" : "border border-slate-200 bg-white text-slate-500")}>{done ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}</span>
              <span className="max-w-full break-words text-center">{steps[id].label}</span>
            </button>
          </li>;
        })}
      </ol>
    </section>

    <section aria-labelledby="setup-step-title" className="surface-card overflow-hidden">
      <div className="p-5 sm:p-8">
        {paused ? <>
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Pause aria-hidden="true" className="size-5" /></span>
          <h1 id="setup-step-title" className="mt-5 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Reprends à ton rythme</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">Tes données enregistrées sont conservées. {recommendedStep === "complete" ? "Ta configuration est déjà complète." : `La prochaine étape : ${steps[recommendedStep as ConfigStepId].label.toLocaleLowerCase("fr")}.`}</p>
          <Button ref={buttonRef} type="button" onClick={resume} className="mt-6 min-h-12 w-full whitespace-normal sm:w-auto"><Play aria-hidden="true" className="size-4" />Reprendre le guide</Button>
        </> : step === "intro" ? <>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-indigo-700"><BookOpen aria-hidden="true" className="size-4" />Un planning, étape par étape</span>
          <h1 id="setup-step-title" className="mt-4 max-w-lg text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl">De tes cours à tes prochaines révisions</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">Study Planner répartit tes révisions dans les moments où tu es disponible. Tu sais quoi revoir, quand travailler, et tu peux suivre ce que tu as terminé.</p>
          <div className="my-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
            <p className="text-xs font-semibold text-slate-500">Un exemple concret</p>
            <ol className="mt-3 space-y-3 text-sm leading-6">
              <li className="flex items-start gap-3"><BookOpen aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-400" /><span>Tu ajoutes ton cours de biologie du lundi.</span></li>
              <li className="flex items-start gap-3"><Clock3 aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-400" /><span>L’application propose de le revoir plusieurs fois, sur des jours espacés.</span></li>
              <li className="flex items-start gap-3"><CalendarDays aria-hidden="true" className="mt-1 size-4 shrink-0 text-indigo-600" /><span>Les révisions trouvent leur place dans tes créneaux libres. Tu vérifies, puis tu enregistres.</span></li>
            </ol>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-500">On va préparer tes cours et tes disponibilités, une étape à la fois. Tu peux quitter le guide et le reprendre plus tard.</p>
          <Button ref={buttonRef} type="button" onClick={begin} className="mt-6 min-h-12 w-full whitespace-normal sm:w-auto">{preferences.started || progress.courseCount > 0 ? "Continuer avec ma configuration" : "Commencer avec mes cours"}<ArrowRight aria-hidden="true" className="size-4" /></Button>
        </> : step === "complete" ? <>
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Check aria-hidden="true" className="size-5" /></span>
          <h1 id="setup-step-title" className="mt-5 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Ta configuration est enregistrée</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">{progress.plannedSessionCount > 0 ? `${progress.plannedSessionCount} ${progress.plannedSessionCount === 1 ? "révision est planifiée" : "révisions sont planifiées"} dans ton calendrier. Retrouve ton programme du jour sur le tableau de bord.` : "Les paramètres du planning sont enregistrés, mais aucune révision n’est actuellement planifiée dans ton calendrier. Consulte le planning pour vérifier les périodes et le travail non placé."}</p>
          <dl className="mt-5 grid gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
            <div className="flex flex-wrap gap-x-2"><dt className="text-slate-500">Matières actives</dt><dd className="font-medium text-slate-800">{progress.courseCount}</dd></div>
            <div className="flex flex-wrap gap-x-2"><dt className="text-slate-500">Disponibilités par semaine</dt><dd className="font-medium text-slate-800">{formatMinutes(progress.weeklyAvailableMinutes)}</dd></div>
          </dl>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="min-h-12 w-full whitespace-normal sm:w-auto"><Link ref={linkRef} href={progress.plannedSessionCount > 0 ? "/dashboard" : "/calendar#replanning"}>{progress.plannedSessionCount > 0 ? "Voir mon programme du jour" : "Vérifier mon planning"}<ArrowRight aria-hidden="true" className="size-4" /></Link></Button>
            <Button asChild variant="outline" className="w-full whitespace-normal sm:w-auto"><Link href={progress.plannedSessionCount > 0 ? "/calendar" : "/dashboard"}>{progress.plannedSessionCount > 0 ? "Ouvrir mon calendrier" : "Aller au tableau de bord"}</Link></Button>
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">Tu peux ajuster tes cours, tes disponibilités et tes examens à tout moment, puis recalculer le planning.</p>
        </> : current && configStep ? <>
          <p className="flex items-center gap-2 text-xs font-medium text-indigo-700"><current.icon aria-hidden="true" className="size-4" />Étape {currentIndex + 1} sur {SETUP_STEP_IDS.length}{configStep === "exams" && " · Facultative"}</p>
          <h1 id="setup-step-title" className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl">{configStep === "planning" && progress.hasSavedPlanning && !progress.planningIsCurrent ? "Mets ton planning à jour" : current.title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">{current.description}</p>
          <div className="mt-5"><StepStatus step={configStep} progress={progress} examsReviewed={preferences.examsReviewed} /></div>
          <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {currentComplete ? <>
              <Button ref={buttonRef} type="button" onClick={() => navigateTo(recommendedStep)} className="min-h-12 w-full whitespace-normal sm:w-auto">{recommendedStep === "complete" ? "Terminer le guide" : "Continuer"}<ArrowRight aria-hidden="true" className="size-4" /></Button>
              <Button asChild variant="ghost" className="w-full whitespace-normal sm:w-auto"><Link href={actionHref}>Revoir {configStep === "hours" ? "mes horaires" : configStep === "availability" ? "mes disponibilités" : configStep === "planning" ? "mon planning" : configStep === "exams" ? "mes examens" : "mes cours"}</Link></Button>
            </> : <>
              <Button asChild className="min-h-12 w-full whitespace-normal sm:w-auto"><Link ref={linkRef} href={actionHref}>{configStep === "planning" && progress.hasSavedPlanning ? "Mettre mon planning à jour" : current.action}<ArrowRight aria-hidden="true" className="size-4" /></Link></Button>
              {configStep === "exams" && <Button type="button" variant="outline" onClick={skipExam} className="w-full whitespace-normal sm:w-auto">Je n’ai pas encore de date</Button>}
            </>}
          </div>
          {!currentComplete && <p className="mt-3 text-xs leading-5 text-slate-500">Reviens au guide après l’enregistrement : ta progression sera mise à jour.</p>}
          <div className="mt-5"><StepDetails key={configStep} step={configStep} progress={progress} /></div>
        </> : null}
      </div>
    </section>

    {!paused && step !== "intro" && <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <Button type="button" variant="ghost" onClick={() => navigateTo(currentIndex > 0 ? SETUP_STEP_IDS[currentIndex - 1] : "intro")} className="px-0 hover:bg-transparent"><ArrowLeft aria-hidden="true" className="size-4" />{step === "complete" ? "Revoir l’introduction" : "Étape précédente"}</Button>
      <span className="text-xs leading-5 text-slate-500">Les étapes suivent tes données enregistrées.</span>
    </div>}
  </div>;
}
