export const SETUP_STEP_IDS = ["courses", "hours", "availability", "exams", "planning"] as const;
export type SetupStepId = "intro" | typeof SETUP_STEP_IDS[number] | "complete";

export type SetupProgress = {
  courseCount: number;
  coursesWithoutHours: { id: string; code: string; name: string }[];
  weeklySessionCount: number;
  availabilityCount: number;
  weeklyAvailableMinutes: number;
  upcomingExamCount: number;
  hasSavedPlanning: boolean;
  planningIsCurrent: boolean;
  plannedSessionCount: number;
};

export function setupStepIsComplete(progress: SetupProgress, step: SetupStepId, examsReviewed: boolean): boolean {
  switch (step) {
    case "intro": return true;
    case "courses": return progress.courseCount > 0;
    case "hours": return progress.courseCount > 0 && progress.coursesWithoutHours.length === 0;
    case "availability": return progress.availabilityCount > 0;
    case "exams": return examsReviewed || progress.upcomingExamCount > 0 || progress.hasSavedPlanning;
    case "planning": return progress.hasSavedPlanning && progress.planningIsCurrent;
    case "complete": return SETUP_STEP_IDS.every((id) => setupStepIsComplete(progress, id, examsReviewed));
  }
}

// La navigation dans le guide ne valide jamais un formulaire ou une sauvegarde.
export function getNextSetupStep(progress: SetupProgress, examsReviewed: boolean): SetupStepId {
  return SETUP_STEP_IDS.find((id) => !setupStepIsComplete(progress, id, examsReviewed)) ?? "complete";
}
