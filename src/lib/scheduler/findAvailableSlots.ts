export type MinuteSlot = { start: number; end: number };

/** Fusionne les disponibilités puis retire chaque occupation. */
export function findAvailableSlots(availability: readonly MinuteSlot[], occupied: readonly MinuteSlot[]): MinuteSlot[] {
  const merged: MinuteSlot[] = [];
  for (const slot of [...availability].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && slot.start <= last.end) last.end = Math.max(last.end, slot.end);
    else merged.push({ ...slot });
  }
  let free = merged;
  for (const busy of occupied) {
    free = free.flatMap((slot) => busy.end <= slot.start || busy.start >= slot.end ? [slot] : [
      { start: slot.start, end: Math.min(slot.end, busy.start) },
      { start: Math.max(slot.start, busy.end), end: slot.end },
    ].filter((part) => part.end > part.start));
  }
  return free;
}
