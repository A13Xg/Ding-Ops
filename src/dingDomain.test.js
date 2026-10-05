import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './gameConfig.js';
import {
  bucketForHour,
  createDingRequest,
  deriveLevelDurationSeconds,
  isMaxLevel,
  nextLevel,
  validateCharacterDraft,
} from './dingDomain.js';

const character = { id: 'c1', current_level: 41 };

describe('character validation', () => {
  it('normalizes a valid draft', () => {
    const result = validateCharacterDraft({
      name: ' Thrall ',
      realm: 'Area 52',
      region: 'us',
      className: 'Shaman',
      currentLevel: 41,
      trackedFromLevel: 40,
    });

    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({
      name: 'Thrall',
      region: 'US',
      class_name: 'Shaman',
      current_level: 41,
      tracked_from_level: 40,
    });
  });

  it('rejects impossible tracked and current levels', () => {
    expect(
      validateCharacterDraft({
        name: 'x',
        realm: '',
        region: 'XX',
        className: 'Bard',
        currentLevel: 91,
        trackedFromLevel: 92,
      }).ok
    ).toBe(false);
  });
});

describe('Ding request contract', () => {
  it('sends the observed current level as the mandatory stale-client guard', () => {
    const request = createDingRequest({
      character,
      eventId: '11111111-1111-4111-8111-111111111111',
      activityType: 'dungeon',
      deaths: 2,
      timeZone: 'America/Los_Angeles',
    });

    expect(request).toMatchObject({
      p_character_id: 'c1',
      p_expected_from_level: 41,
      p_activity_type: 'dungeon',
      p_deaths: 2,
      p_time_zone: 'America/Los_Angeles',
    });
    expect(request).not.toHaveProperty('to_level');
  });

  it('rejects max-level events client-side before the server enforces them again', () => {
    expect(() =>
      createDingRequest({
        character: { id: 'c1', current_level: GAME_CONFIG.levelCap },
        eventId: 'e',
      })
    ).toThrow(/max level/i);
  });

  it('normalizes unknown activities to other', () => {
    expect(createDingRequest({ character, eventId: 'e', activityType: 'definitely-not-real' }).p_activity_type).toBe(
      'other'
    );
  });

  it('rejects negative optional counters', () => {
    expect(() => createDingRequest({ character, eventId: 'e', deaths: -1 })).toThrow(/negative/i);
    expect(() => createDingRequest({ character, eventId: 'e', sessionMinutes: -2 })).toThrow(/negative/i);
  });
});

describe('level helpers', () => {
  it('uses a configurable cap', () => {
    expect(nextLevel({ current_level: 89 })).toBe(90);
    expect(nextLevel({ current_level: 90 })).toBeNull();
    expect(isMaxLevel({ current_level: 90 })).toBe(true);
  });

  it('uses stable local-time buckets', () => {
    expect(bucketForHour(2)).toBe('Late Night');
    expect(bucketForHour(13)).toBe('Afternoon');
    expect(bucketForHour(22)).toBe('Prime Night');
  });

  it('derives pace from the previous event for the same character only', () => {
    const rows = [
      { id: 'a', character_id: 'c1', timestamp: '2026-10-05T10:00:00Z' },
      { id: 'x', character_id: 'other', timestamp: '2026-10-05T10:30:00Z' },
    ];

    expect(
      deriveLevelDurationSeconds(rows, {
        id: 'b',
        character_id: 'c1',
        timestamp: '2026-10-05T11:00:00Z',
      })
    ).toBe(3600);
  });
});
