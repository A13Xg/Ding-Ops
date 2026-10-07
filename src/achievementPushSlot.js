/*
 * One achievement push per reconciliation burst.
 *
 * Postgres evaluates now() once per statement, so every achievement inserted by
 * one reconcile upsert receives the same unlocked_at timestamp. That timestamp
 * is therefore a stable burst id: siblings compete on one push_events slot,
 * while a second Ding/reconcile seconds later receives a different slot and is
 * not incorrectly suppressed by a time-based cooldown.
 */

export function achievementBurstSlotId(actorId, unlockedAt, fallbackId = '') {
  const actor = String(actorId || '').trim();
  const stamp = String(unlockedAt || '').trim() || `row:${String(fallbackId || '').trim() || 'unknown'}`;
  return `achievement-burst:${actor}:${stamp}`;
}
