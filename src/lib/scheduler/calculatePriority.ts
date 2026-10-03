/** Charge par jour avant examen, pondérée par son importance (1 à 3). */
export function calculatePriority(remainingMinutes: number, daysUntilExam: number | null, importance = 1): number | null {
  if (!Number.isSafeInteger(remainingMinutes) || remainingMinutes < 0) return null;
  if (!Number.isInteger(importance) || importance < 1 || importance > 3) return null;
  if (daysUntilExam === null) return 0;
  if (!Number.isSafeInteger(daysUntilExam)) return null;
  if (daysUntilExam <= 0) return 0;
  return (remainingMinutes / daysUntilExam) * importance;
}
