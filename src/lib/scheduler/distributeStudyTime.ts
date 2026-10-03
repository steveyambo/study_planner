export type RevisionAllocation = { intervalDays: number; durationMinutes: number };

/** Répartit les minutes entières ; les premières répétitions reçoivent le reste. */
export function distributeStudyTime(totalMinutes: number, intervals: readonly number[]): RevisionAllocation[] | null {
  if (!Number.isSafeInteger(totalMinutes) || totalMinutes < 0 || intervals.length === 0) return null;
  if (intervals.some((day) => !Number.isInteger(day) || day < 1 || day > 2_147_483_647)) return null;
  if (new Set(intervals).size !== intervals.length) return null;
  const ordered = [...intervals].sort((a, b) => a - b);
  const base = Math.floor(totalMinutes / ordered.length);
  const remainder = totalMinutes % ordered.length;
  return ordered.map((intervalDays, index) => ({ intervalDays, durationMinutes: base + (index < remainder ? 1 : 0) }));
}
