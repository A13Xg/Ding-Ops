import { dingAchievementById } from './dingAchievements.js';

export const DING_RANKS = Object.freeze([
  Object.freeze({ id: 'keyboard_turner', name: 'Keyboard Turner', minXp: 0 }),
  Object.freeze({ id: 'quest_addict', name: 'Quest Addict', minXp: 50 }),
  Object.freeze({ id: 'dungeon_rat', name: 'Dungeon Rat', minXp: 150 }),
  Object.freeze({ id: 'xp_goblin', name: 'XP Goblin', minXp: 300 }),
  Object.freeze({ id: 'dorito_disciple', name: 'Dorito Disciple', minXp: 550 }),
  Object.freeze({ id: 'mountain_dew_acolyte', name: 'Mountain Dew Acolyte', minXp: 900 }),
  Object.freeze({ id: 'grass_dodger', name: 'Grass Dodger', minXp: 1400 }),
  Object.freeze({ id: 'basement_warlord', name: 'Basement Warlord', minXp: 2100 }),
  Object.freeze({ id: 'sweatlord', name: 'Sweatlord', minXp: 3000 }),
  Object.freeze({ id: 'mythic_no_lifer', name: 'Mythic No-Lifer', minXp: 4200 }),
]);

export function achievementXpForUser(achievementRows = [], userId) {
  if (!userId) return 0;
  return achievementRows
    .filter(row => row?.user_id === userId)
    .reduce((sum, row) => sum + (dingAchievementById(row.achievement_type)?.points || 0), 0);
}

export function dingRankForXp(value) {
  const xp = Math.max(0, Number(value) || 0);
  let current = DING_RANKS[0];
  for (const rank of DING_RANKS) {
    if (xp >= rank.minXp) current = rank;
    else break;
  }
  const index = DING_RANKS.indexOf(current);
  const next = DING_RANKS[index + 1] || null;
  return {
    ...current,
    xp,
    maxed: !next,
    next,
    nextXp: next?.minXp ?? current.minXp,
    remaining: next ? Math.max(0, next.minXp - xp) : 0,
    progress: next ? Math.max(0, Math.min(1, (xp - current.minXp) / Math.max(1, next.minXp - current.minXp))) : 1,
  };
}

export function rankForUser(achievementRows = [], userId) {
  return dingRankForXp(achievementXpForUser(achievementRows, userId));
}

export function parseShowcase(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function serializeShowcase(ids = []) {
  return [...new Set(ids.map(String).filter(Boolean))].slice(0, 3).join(',');
}
