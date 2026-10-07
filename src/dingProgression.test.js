import { describe, expect, it } from 'vitest';
import {
  DING_RANKS,
  achievementXpForUser,
  dingRankForXp,
  parseShowcase,
  rankForUser,
  serializeShowcase,
} from './dingProgression.js';

describe('DING app progression', () => {
  it('keeps rank thresholds ordered', () => {
    expect(DING_RANKS.length).toBeGreaterThanOrEqual(8);
    expect(DING_RANKS.map(rank => rank.minXp)).toEqual(
      [...DING_RANKS].map(rank => rank.minXp).sort((a, b) => a - b)
    );
  });

  it('derives XP only from the requested player awards', () => {
    const rows = [
      { user_id: 'u1', achievement_type: 'first_ding' },
      { user_id: 'u1', achievement_type: 'dungeon_ding' },
      { user_id: 'u2', achievement_type: 'max_level' },
    ];
    expect(achievementXpForUser(rows, 'u1')).toBe(30);
    expect(rankForUser(rows, 'u2').xp).toBe(300);
  });

  it('returns bounded rank progress', () => {
    expect(dingRankForXp(-1).progress).toBe(0);
    expect(dingRankForXp(75).name).toBe('Quest Addict');
    expect(dingRankForXp(10_000).maxed).toBe(true);
    expect(dingRankForXp(10_000).progress).toBe(1);
  });

  it('round-trips at most three unique showcase ids', () => {
    expect(serializeShowcase(['a', 'b', 'a', 'c', 'd'])).toBe('a,b,c');
    expect(parseShowcase('a,b,c,d')).toEqual(['a', 'b', 'c']);
  });
});
