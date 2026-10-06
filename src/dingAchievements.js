export const dingAchievements = Object.freeze([
  {
    id: 'first_ding',
    name: 'First Ding',
    desc: 'Record your first tracked level.',
    tier: 'bronze',
    kind: 'achievement',
    points: 10,
    accent: '#60a5fa',
  },
  {
    id: 'ten_dings',
    name: 'XP Goblin',
    desc: 'Record 10 tracked levels.',
    tier: 'silver',
    kind: 'badge',
    points: 50,
    accent: '#818cf8',
  },
  {
    id: 'twenty_five_dings',
    name: 'Grass Dodger',
    desc: 'Record 25 tracked levels.',
    tier: 'gold',
    kind: 'badge',
    points: 120,
    accent: '#a78bfa',
  },
  {
    id: 'max_level',
    name: 'Mythic No-Lifer',
    desc: 'Record a Ding that reaches the configured level cap.',
    tier: 'mythic',
    kind: 'trophy',
    points: 300,
    accent: '#f4c95d',
  },
  {
    id: 'late_night_ding',
    name: 'Sleep Is a DPS Loss',
    desc: 'Ding between midnight and 4 AM local time.',
    tier: 'silver',
    kind: 'achievement',
    points: 35,
    accent: '#7c3aed',
  },
  {
    id: 'dungeon_ding',
    name: 'Dungeon Rat',
    desc: 'Ding while running a dungeon.',
    tier: 'bronze',
    kind: 'achievement',
    points: 20,
    accent: '#3b82f6',
  },
  {
    id: 'questing_ding',
    name: 'Quest Goblin',
    desc: 'Ding while questing.',
    tier: 'bronze',
    kind: 'achievement',
    points: 20,
    accent: '#60a5fa',
  },
  {
    id: 'speed_level',
    name: 'Rested XP Is for Cowards',
    desc: 'Record a level completed in 30 minutes or less.',
    tier: 'gold',
    kind: 'achievement',
    points: 60,
    accent: '#a78bfa',
  },
  {
    id: 'death_tax',
    name: 'Corpse Run Enthusiast',
    desc: 'Record a level with 5 or more deaths.',
    tier: 'silver',
    kind: 'achievement',
    points: 35,
    accent: '#8b5cf6',
  },
  {
    id: 'altaholic',
    name: 'Altaholic',
    desc: 'Track at least 3 characters.',
    tier: 'gold',
    kind: 'badge',
    points: 90,
    accent: '#c084fc',
  },
]);

/**
 * @typedef {{ user_id?: string, to_level?: number, local_hour?: number, activity_type?: string | null, session_minutes?: number | null, deaths?: number | null }} DingAchievementEvent
 * @typedef {{ user_id?: string }} DingAchievementCharacter
 * @typedef {{ user_id?: string, achievement_type?: string }} DingAchievementRecord
 *
 * @param {{
 *   userId?: string,
 *   events?: DingAchievementEvent[],
 *   characters?: DingAchievementCharacter[],
 *   existing?: DingAchievementRecord[],
 *   levelCap?: number
 * }} input
 */
export function computeDingAchievementUnlocks({
  userId,
  events = [],
  characters = [],
  existing = [],
  levelCap = 90,
} = {}) {
  if (!userId) return [];
  const ownedEvents = events.filter(event => event?.user_id === userId);
  const ownedCharacters = characters.filter(character => character?.user_id === userId);
  const unlocked = new Set(existing.filter(row => row?.user_id === userId).map(row => row.achievement_type));
  const fresh = [];
  const award = id => {
    if (!unlocked.has(id)) {
      unlocked.add(id);
      fresh.push(id);
    }
  };

  if (ownedEvents.length >= 1) award('first_ding');
  if (ownedEvents.length >= 10) award('ten_dings');
  if (ownedEvents.length >= 25) award('twenty_five_dings');
  if (ownedEvents.some(event => Number(event.to_level) >= Number(levelCap))) award('max_level');
  if (ownedEvents.some(event => Number(event.local_hour) >= 0 && Number(event.local_hour) < 4))
    award('late_night_ding');
  if (ownedEvents.some(event => event.activity_type === 'dungeon')) award('dungeon_ding');
  if (ownedEvents.some(event => event.activity_type === 'questing')) award('questing_ding');
  if (ownedEvents.some(event => Number.isInteger(event.session_minutes) && event.session_minutes <= 30))
    award('speed_level');
  if (ownedEvents.some(event => Number(event.deaths) >= 5)) award('death_tax');
  if (ownedCharacters.length >= 3) award('altaholic');

  return fresh;
}

export function dingAchievementById(id) {
  return dingAchievements.find(item => item.id === id) || null;
}
