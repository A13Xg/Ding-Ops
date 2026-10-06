import { describe, it, expect } from 'vitest';

import {
  ACHIEVEMENT_BODIES,
  ACHIEVEMENT_TITLES,
  DING_BODIES,
  DING_TITLES,
  INACTIVITY_MESSAGE_CATALOG,
  buildAchievementNotification,
  buildDingNotification,
  seedIndex,
} from './notificationMessages.js';

describe('notification copy', () => {
  it('keeps every catalog non-empty so a notification can never ship blank', () => {
    for (const catalog of [DING_TITLES, DING_BODIES, ACHIEVEMENT_TITLES, ACHIEVEMENT_BODIES]) {
      expect(catalog.length).toBeGreaterThan(0);
      expect(catalog.every(entry => entry.trim().length > 0)).toBe(true);
    }
    expect(INACTIVITY_MESSAGE_CATALOG.length).toBeGreaterThanOrEqual(10);
    expect(INACTIVITY_MESSAGE_CATALOG.every(entry => entry.text.trim().length > 0)).toBe(true);
  });

  it('keeps inactivity reminder entries shaped for weighted selection', () => {
    for (const entry of INACTIVITY_MESSAGE_CATALOG) {
      expect(typeof entry.text).toBe('string');
      expect(entry.text.trim()).not.toBe('');
      expect(Number.isFinite(entry.weight)).toBe(true);
      expect(entry.weight).toBeGreaterThan(0);
    }
  });

  it('picks a Ding variant deterministically so two devices never disagree', () => {
    const input = { username: 'Rex', characterName: 'Hexlord', toLevel: 84, eventId: 'd-1' };
    expect(buildDingNotification(input)).toEqual(buildDingNotification(input));
    expect(seedIndex('d-1', 5)).toBe(seedIndex('d-1', 5));
  });

  it('spreads variants across different Ding events', () => {
    const titles = new Set(
      Array.from(
        { length: 40 },
        (_, i) =>
          buildDingNotification({ username: 'Rex', characterName: 'Hexlord', toLevel: 84, eventId: `d-${i}` }).title
      )
    );
    expect(titles.size).toBeGreaterThan(1);
  });

  it('quotes the note and keeps Dings inside their own notification namespace', () => {
    const withNote = buildDingNotification({
      username: 'Rex',
      characterName: 'Hexlord',
      toLevel: 84,
      note: 'one more quest',
      eventId: 'd-9',
      zone: 'Harandar',
    });
    expect(withNote.title).toMatch(/Rex|Hexlord/);
    expect(withNote.body).toContain('one more quest');
    expect(withNote.body).toContain('Harandar');
    expect(withNote.tag).toBe('ding-d-9');
    expect(withNote.kind).toBe('ding');

    const withoutNote = buildDingNotification({
      username: 'Rex',
      characterName: 'Hexlord',
      toLevel: 84,
      eventId: 'd-9',
    });
    expect(DING_BODIES).toContain(withoutNote.body);
  });

  it('falls back to usable actor and character labels', () => {
    const notification = buildDingNotification({ eventId: 'd-2', toLevel: 2 });
    expect(notification.title).toMatch(/Someone|a character/);
  });

  it('names the achievement in the title', () => {
    const notification = buildAchievementNotification({
      username: 'Rex',
      achievementName: 'Night Shift',
      achievementId: 'night_shift',
      tier: 'silver',
    });
    expect(notification.title).toContain('Night Shift');
    expect(notification.title).toContain('Rex');
    expect(ACHIEVEMENT_BODIES).toContain(notification.body);
    expect(notification.tier).toBe('silver');
  });

  it('keeps seedIndex inside bounds for any input', () => {
    for (const seed of ['', 'x', 'a-very-long-seed-value', '☃', '12345']) {
      const index = seedIndex(seed, 7);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(7);
    }
    expect(seedIndex('anything', 0)).toBe(0);
  });
});
