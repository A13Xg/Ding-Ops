import { describe, expect, it } from 'vitest';
import { deriveDingAnalytics } from './dingAnalytics.js';

const now = Date.parse('2026-10-06T20:00:00Z');
const event = (patch = {}) => ({
  id: crypto.randomUUID(),
  user_id: 'u1',
  character_id: 'c1',
  timestamp: '2026-10-06T12:00:00Z',
  local_date: '2026-10-06',
  local_hour: 12,
  time_bucket: 'Afternoon',
  activity_type: 'questing',
  session_minutes: null,
  deaths: null,
  to_level: 81,
  ...patch,
});

describe('DING analytics', () => {
  it('derives summary, leaderboards and persisted-context distributions', () => {
    const result = deriveDingAnalytics({
      now,
      viewerId: 'u1',
      users: [{ id: 'u1', username: 'A' }, { id: 'u2', username: 'B' }],
      characters: [
        { id: 'c1', user_id: 'u1', name: 'One', is_archived: false },
        { id: 'c2', user_id: 'u2', name: 'Two', is_archived: false },
      ],
      events: [
        event({ id: 'e1', session_minutes: 20, deaths: 0 }),
        event({ id: 'e2', user_id: 'u2', character_id: 'c2', activity_type: 'dungeon', local_hour: 21, time_bucket: 'Prime Night' }),
      ],
    });
    expect(result.summary.groupDings).toBe(2);
    expect(result.summary.activeGrinders).toBe(2);
    expect(result.summary.today).toBe(2);
    expect(result.leaderboard).toHaveLength(2);
    expect(result.activities.map(row => row.label)).toEqual(expect.arrayContaining(['questing', 'dungeon']));
    expect(result.hours[12].count).toBe(1);
    expect(result.hours[21].count).toBe(1);
  });

  it('computes records only from fields that actually exist', () => {
    const result = deriveDingAnalytics({
      now,
      viewerId: 'u1',
      users: [{ id: 'u1', username: 'A' }],
      characters: [{ id: 'c1', user_id: 'u1', name: 'One', is_archived: false }],
      events: [
        event({ id: 'fast', session_minutes: 12, deaths: 1 }),
        event({ id: 'slow', session_minutes: 90, deaths: 8 }),
      ],
    });
    expect(result.records.fastest.id).toBe('fast');
    expect(result.records.slowest.id).toBe('slow');
    expect(result.records.highestDeaths.id).toBe('slow');
  });

  it('uses actor-local dates for streak and heatmap calculations', () => {
    const events = [1, 2, 3, 4, 5].map(day =>
      event({
        id: String(day),
        local_date: `2026-10-0${day}`,
        local_hour: 2,
        timestamp: `2026-10-0${day}T10:00:00Z`,
      })
    );
    const result = deriveDingAnalytics({
      now,
      viewerId: 'u1',
      users: [{ id: 'u1', username: 'A' }],
      characters: [],
      events,
    });
    expect(result.summary.viewerStreak).toBe(5);
    expect(result.heat.reduce((sum, cell) => sum + cell.count, 0)).toBe(5);
  });
});
