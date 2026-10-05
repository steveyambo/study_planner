export type SetupPreferences = {
  started: boolean;
  paused: boolean;
  examsReviewed: boolean;
  welcomeDismissed: boolean;
};

export const DEFAULT_SETUP_PREFERENCES: SetupPreferences = {
  started: false, paused: false, examsReviewed: false, welcomeDismissed: false,
};

export function setupPreferencesKey(userId: string): string {
  return `study-planner:guided-setup:v1:${userId}`;
}

export function parseSetupPreferences(value: string | null): SetupPreferences {
  try {
    const parsed: unknown = value === null ? null : JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return DEFAULT_SETUP_PREFERENCES;
    const fields = parsed as Record<string, unknown>;
    return {
      started: fields.started === true,
      paused: fields.paused === true,
      examsReviewed: fields.examsReviewed === true,
      welcomeDismissed: fields.welcomeDismissed === true,
    };
  } catch { return DEFAULT_SETUP_PREFERENCES; }
}
