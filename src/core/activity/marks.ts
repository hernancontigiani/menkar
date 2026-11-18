export const MARK_INTERVAL_MS = 60_000

// A clock set back gives a mark at once: waiting for it to catch up would silence the marks.
export function markDue(lastMs: number | null, nowMs: number): boolean {
  return lastMs === null || nowMs < lastMs || nowMs - lastMs >= MARK_INTERVAL_MS
}
