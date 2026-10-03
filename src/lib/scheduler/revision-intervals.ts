export const DEFAULT_REVISION_INTERVALS = [1, 3, 7, 14];

export function parseRevisionIntervals(input: string): number[] | null {
  const text = input.trim();
  if (!text || text.length > 512) return null;
  const parts = text.split(/[,;\s]+/);
  if (parts.some((part) => !/^\d+$/.test(part))) return null;
  const intervals = parts.map(Number);
  if (intervals.some((value) => !Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647)) return null;
  if (new Set(intervals).size !== intervals.length) return null;
  return intervals.sort((a, b) => a - b);
}
