export const WOW_CLASSES = Object.freeze([
  'Warrior',
  'Paladin',
  'Hunter',
  'Rogue',
  'Priest',
  'Death Knight',
  'Shaman',
  'Mage',
  'Warlock',
  'Monk',
  'Druid',
  'Demon Hunter',
  'Evoker',
]);

export const GAME_CONFIG = Object.freeze({
  game: 'World of Warcraft',
  expansionKey: 'midnight',
  expansionName: 'Midnight',
  levelCap: 90,
  minLevel: 1,
  regions: Object.freeze(['US', 'EU', 'KR', 'TW']),
  factions: Object.freeze(['Alliance', 'Horde', 'Neutral']),
  reminderCadence: Object.freeze({
    firstDelayDays: 5,
    randomWindowDays: 2,
    followupMinDays: 5,
  }),
  activityTypes: Object.freeze([
    Object.freeze({ id: 'questing', label: 'Questing' }),
    Object.freeze({ id: 'dungeon', label: 'Dungeon' }),
    Object.freeze({ id: 'delve', label: 'Delve' }),
    Object.freeze({ id: 'pvp', label: 'PvP' }),
    Object.freeze({ id: 'grinding', label: 'Mob Grinding' }),
    Object.freeze({ id: 'campaign', label: 'Campaign' }),
    Object.freeze({ id: 'profession', label: 'Profession / Gathering' }),
    Object.freeze({ id: 'other', label: 'Other' }),
  ]),
});

export function activityLabel(id) {
  return GAME_CONFIG.activityTypes.find(item => item.id === id)?.label || 'Other';
}

export function mergeGameConfig(remote = {}) {
  const levelCap = Number(remote.level_cap ?? remote.levelCap);
  return {
    ...GAME_CONFIG,
    expansionKey: String(remote.expansion_key ?? remote.expansionKey ?? GAME_CONFIG.expansionKey),
    expansionName: String(remote.expansion_name ?? remote.expansionName ?? GAME_CONFIG.expansionName),
    levelCap: Number.isInteger(levelCap) && levelCap > 0 ? levelCap : GAME_CONFIG.levelCap,
  };
}
