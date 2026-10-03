/** Total de révision par occurrence, arrondi à la minute la plus proche. */
export function calculateStudyTime(courseMinutes: number, multiplier: number): number | null {
  if (!Number.isSafeInteger(courseMinutes) || courseMinutes <= 0) return null;
  if (!Number.isFinite(multiplier) || multiplier < 0.01 || multiplier > 99.99) return null;
  const hundredths = Math.round(multiplier * 100);
  if (Math.abs(multiplier * 100 - hundredths) > 1e-9) return null;
  const product = courseMinutes * hundredths;
  if (!Number.isSafeInteger(product)) return null;
  // Multiplication entière pour éviter les erreurs des décimales binaires.
  const whole = Math.floor(product / 100);
  return whole + (product % 100 >= 50 ? 1 : 0);
}
