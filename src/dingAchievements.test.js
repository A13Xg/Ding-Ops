import { describe, expect, it } from 'vitest';
import { computeDingAchievementUnlocks, dingAchievements } from './dingAchievements.js';

const event = (patch = {}) => ({
  id: crypto.randomUUID(),
  user_id: 'u1',
  character_id: 'c1',
  to_level: 81,
  local_hour: 12,
  activity_type: 'other',
  session_minutes: null,
  deaths: null,
  ...patch,
});

describe('DING achievement foundation', () => {
  it('uses unique catalog ids', () => {
    expect(new Set(dingAchievements.map(item => item.id)).size).toBe(dingAchievements.length);
  });

  it('awards the first Ding once', () => {
    expect(computeDingAchievementUnlocks({ userId: 'u1', events: [event()] })).toContain('first_ding');
    expect(
      computeDingAchievementUnlocks({
        userId: 'u1',
        events: [event()],
        existing: [{ user_id: 'u1', achievement_type: 'first_ding' }],
      })
    ).not.toContain('first_ding');
  });

  it('derives behavior awards only from persisted Ding fields', () => {
    const fresh = computeDingAchievementUnlocks({
      userId: 'u1',
      levelCap: 90,
      events: [
        event({
          to_level: 90,
          local_hour: 2,
          activity_type: 'dungeon',
          session_minutes: 25,
          deaths: 5,
        }),
        event({ activity_type: 'questing' }),
      ],
      characters: [{ id: 'c1', user_id: 'u1' }, { id: 'c2', user_id: 'u1' }, { id: 'c3', user_id: 'u1' }],
    });
    expect(fresh).toEqual(expect.arrayContaining([
      'first_ding',
      'max_level',
      'late_night_ding',
      'dungeon_ding',
      'questing_ding',
      'speed_level',
      'death_tax',
      'altaholic',
    ]));
  });

  it('awards volume milestones at their thresholds', () => {
    const events = Array.from({ length: 25 }, (_, index) => event({ id: String(index), to_level: index + 2 }));
    const fresh = computeDingAchievementUnlocks({ userId: 'u1', events });
    expect(fresh).toEqual(expect.arrayContaining(['ten_dings', 'twenty_five_dings']));
  });

  it('does not use another player history', () => {
    const fresh = computeDingAchievementUnlocks({
      userId: 'u1',
      events: [event({ user_id: 'u2', to_level: 90, activity_type: 'dungeon' })],
      characters: [{ user_id: 'u2' }, { user_id: 'u2' }, { user_id: 'u2' }],
    });
    expect(fresh).toEqual([]);
  });
});
