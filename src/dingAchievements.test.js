import { describe, expect, it } from 'vitest';
import { computeDingAchievementUnlocks, dingAchievementById, dingAchievements } from './dingAchievements.js';

const event = (patch = {}) => ({
  id: crypto.randomUUID(),
  user_id: 'u1',
  character_id: 'c1',
  from_level: 80,
  to_level: 81,
  local_date: '2026-10-06',
  local_hour: 12,
  time_bucket: 'Afternoon',
  activity_type: 'other',
  session_minutes: null,
  deaths: null,
  note: '',
  ...patch,
});

describe('DING achievement catalog', () => {
  it('has production-scale breadth with unique IDs and valid metadata', () => {
    expect(dingAchievements.length).toBeGreaterThanOrEqual(130);
    expect(new Set(dingAchievements.map(item => item.id)).size).toBe(dingAchievements.length);
    for (const item of dingAchievements) {
      expect(item.name.trim()).not.toBe('');
      expect(item.desc.trim()).not.toBe('');
      expect(['bronze', 'silver', 'gold', 'platinum', 'mythic']).toContain(item.tier);
      expect(item.points).toBeGreaterThan(0);
      expect(item.criterion?.type).toBeTruthy();
      expect(dingAchievementById(item.id)).toBe(item);
    }
  });

  it('preserves the vertical-slice achievement IDs already used by server code', () => {
    for (const id of [
      'first_ding',
      'ten_dings',
      'twenty_five_dings',
      'max_level',
      'late_night_ding',
      'dungeon_ding',
      'questing_ding',
      'speed_level',
      'death_tax',
      'altaholic',
    ]) {
      expect(dingAchievementById(id)).not.toBeNull();
    }
  });

  it('awards the first Ding only once', () => {
    expect(computeDingAchievementUnlocks({ userId: 'u1', events: [event()] })).toContain('first_ding');
    expect(
      computeDingAchievementUnlocks({
        userId: 'u1',
        events: [event()],
        existing: [{ user_id: 'u1', achievement_type: 'first_ding' }],
      })
    ).not.toContain('first_ding');
  });

  it('derives behavior awards only from persisted event and character fields', () => {
    const events = [
      event({
        to_level: 90,
        local_date: '2026-10-04',
        local_hour: 2,
        time_bucket: 'Late Night',
        activity_type: 'dungeon',
        session_minutes: 25,
        deaths: 5,
        zone: 'Harandar',
        note: 'one more quest',
      }),
      event({
        id: 'two',
        character_id: 'c2',
        local_date: '2026-10-05',
        activity_type: 'questing',
        zone: 'Silvermoon',
      }),
      event({
        id: 'three',
        character_id: 'c3',
        local_date: '2026-10-06',
        activity_type: 'delve',
        zone: 'Voidstorm',
      }),
    ];
    const characters = [
      { id: 'c1', user_id: 'u1', class_name: 'Mage', realm: 'A', faction: 'Alliance', current_level: 90 },
      { id: 'c2', user_id: 'u1', class_name: 'Warrior', realm: 'B', faction: 'Horde', current_level: 90 },
      { id: 'c3', user_id: 'u1', class_name: 'Priest', realm: 'C', faction: 'Alliance', current_level: 81 },
    ];
    const fresh = computeDingAchievementUnlocks({ userId: 'u1', levelCap: 90, events, characters });
    expect(fresh).toEqual(
      expect.arrayContaining([
        'first_ding',
        'three_dings',
        'max_level',
        'late_night_ding',
        'dungeon_ding',
        'questing_ding',
        'delve_ding',
        'speed_level',
        'death_tax',
        'altaholic',
        'classes_3',
        'zones_3',
        'both_factions',
        'realms_3',
        'streak_3',
        'maxed_chars_2',
        'notes_1',
      ])
    );
  });

  it('computes daily volume and long streaks from local_date rather than viewer timezone', () => {
    const streak = Array.from({ length: 7 }, (_, index) =>
      event({
        id: String(index),
        local_date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      })
    );
    const sameDay = Array.from({ length: 10 }, (_, index) => event({ id: `same-${index}`, local_date: '2026-09-30' }));
    const fresh = computeDingAchievementUnlocks({ userId: 'u1', events: [...streak, ...sameDay] });
    expect(fresh).toEqual(expect.arrayContaining(['streak_7', 'daily_10']));
  });

  it('awards synchronized Dings only when another crew member is actually nearby in server time', () => {
    const anchor = event({ id: 'mine', timestamp: '2026-10-06T20:00:00Z' });
    const near = event({ id: 'near', user_id: 'u2', timestamp: '2026-10-06T20:01:30Z' });
    const far = event({ id: 'far', user_id: 'u3', timestamp: '2026-10-06T21:00:00Z' });
    const fresh = computeDingAchievementUnlocks({
      userId: 'u1',
      events: [anchor],
      allEvents: [anchor, near, far],
    });
    expect(fresh).toContain('sync_pair');
    expect(fresh).not.toContain('sync_trio');
  });

  it('recognizes a synchronized crew cluster using distinct users, not duplicate events', () => {
    const rows = [
      event({ id: 'mine', timestamp: '2026-10-06T20:00:00Z' }),
      event({ id: 'u2a', user_id: 'u2', timestamp: '2026-10-06T20:01:00Z' }),
      event({ id: 'u2b', user_id: 'u2', timestamp: '2026-10-06T20:02:00Z' }),
      event({ id: 'u3', user_id: 'u3', timestamp: '2026-10-06T20:03:00Z' }),
      event({ id: 'u4', user_id: 'u4', timestamp: '2026-10-06T20:08:00Z' }),
    ];
    const fresh = computeDingAchievementUnlocks({ userId: 'u1', events: [rows[0]], allEvents: rows });
    expect(fresh).toEqual(expect.arrayContaining(['sync_pair', 'sync_trio', 'sync_raid']));
  });

  it('does not use another player history', () => {
    const fresh = computeDingAchievementUnlocks({
      userId: 'u1',
      events: [event({ user_id: 'u2', to_level: 90, activity_type: 'dungeon' })],
      characters: [{ user_id: 'u2', class_name: 'Mage', realm: 'A' }],
    });
    expect(fresh).toEqual([]);
  });
});
