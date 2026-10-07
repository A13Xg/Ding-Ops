import { describe, expect, it } from 'vitest';
import { achievementBurstSlotId } from './achievementPushSlot.js';

describe('achievement push burst slot', () => {
  const actor = '11111111-2222-3333-4444-555555555555';

  it('gives siblings from the same reconciliation statement one slot', () => {
    const unlockedAt = '2026-10-06T20:00:00.123456+00:00';
    expect(achievementBurstSlotId(actor, unlockedAt, 'a')).toBe(achievementBurstSlotId(actor, unlockedAt, 'b'));
  });

  it('does not suppress a later Ding simply because it happened within ten minutes', () => {
    expect(achievementBurstSlotId(actor, '2026-10-06T20:00:00Z')).not.toBe(
      achievementBurstSlotId(actor, '2026-10-06T20:00:01Z')
    );
  });

  it('never collides between actors', () => {
    const stamp = '2026-10-06T20:00:00Z';
    expect(achievementBurstSlotId(actor, stamp)).not.toBe(achievementBurstSlotId('other-user', stamp));
  });

  it('falls back to the row id only when legacy data has no unlock timestamp', () => {
    expect(achievementBurstSlotId(actor, null, 'achievement-row')).toContain('row:achievement-row');
  });
});
