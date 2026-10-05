import { GAME_CONFIG, WOW_CLASSES } from './gameConfig.js';

const trim = (value, max) => String(value ?? '').trim().slice(0, max);
const intOrNull = value => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

export function normalizeCharacterDraft(input = {}, config = GAME_CONFIG) {
  const currentLevel = intOrNull(input.current_level ?? input.currentLevel) ?? config.minLevel;
  const trackedFrom = intOrNull(input.tracked_from_level ?? input.trackedFromLevel) ?? currentLevel;
  return {
    name: trim(input.name, 32),
    realm: trim(input.realm, 64),
    region: trim(input.region || 'US', 8).toUpperCase(),
    class_name: trim(input.class_name ?? input.className, 32),
    spec: trim(input.spec, 40) || null,
    race: trim(input.race, 40) || null,
    faction: trim(input.faction, 16) || null,
    current_level: currentLevel,
    tracked_from_level: trackedFrom,
  };
}

export function validateCharacterDraft(input = {}, config = GAME_CONFIG) {
  const value = normalizeCharacterDraft(input, config);
  const errors = {};
  if (value.name.length < 2) errors.name = 'Character name must be at least 2 characters.';
  if (!value.realm) errors.realm = 'Realm is required.';
  if (!config.regions.includes(value.region)) errors.region = 'Unsupported region.';
  if (!WOW_CLASSES.includes(value.class_name)) errors.class_name = 'Choose a supported class.';
  if (value.faction && !config.factions.includes(value.faction)) errors.faction = 'Unsupported faction.';
  if (!Number.isInteger(value.current_level) || value.current_level < config.minLevel || value.current_level > config.levelCap)
    errors.current_level = `Level must be between ${config.minLevel} and ${config.levelCap}.`;
  if (!Number.isInteger(value.tracked_from_level) || value.tracked_from_level < config.minLevel || value.tracked_from_level > value.current_level)
    errors.tracked_from_level = 'Tracked-from level must be valid and cannot exceed current level.';
  return { value, errors, ok: Object.keys(errors).length === 0 };
}

export function isMaxLevel(character, config = GAME_CONFIG) {
  return Number(character?.current_level) >= config.levelCap;
}

export function nextLevel(character, config = GAME_CONFIG) {
  const current = Number(character?.current_level);
  if (!Number.isInteger(current)) return null;
  return current >= config.levelCap ? null : current + 1;
}

export function bucketForHour(hour) {
  const h = Number(hour);
  if (!Number.isInteger(h) || h < 0 || h > 23) return 'Unknown';
  if (h < 4) return 'Late Night';
  if (h < 8) return 'Early Morning';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Prime Night';
}

export function createDingRequest({
  character,
  eventId,
  zone = '',
  activityType = 'other',
  deaths = null,
  sessionMinutes = null,
  note = '',
  timeZone,
  config = GAME_CONFIG,
} = {}) {
  if (!character?.id) throw new Error('An active character is required.');
  if (!eventId) throw new Error('A stable event id is required.');
  const from = Number(character.current_level);
  if (!Number.isInteger(from)) throw new Error('Character level is invalid.');
  if (from >= config.levelCap) throw new Error('Character is already at max level.');
  const activityIds = new Set(config.activityTypes.map(item => item.id));
  const deathCount = intOrNull(deaths);
  const minutes = intOrNull(sessionMinutes);
  if (deathCount != null && deathCount < 0) throw new Error('Deaths cannot be negative.');
  if (minutes != null && minutes < 0) throw new Error('Session minutes cannot be negative.');
  let resolvedTimeZone = trim(timeZone, 80);
  if (!resolvedTimeZone) {
    try { resolvedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch { resolvedTimeZone = 'UTC'; }
  }
  return {
    p_event_id: eventId,
    p_character_id: character.id,
    p_expected_from_level: from,
    p_zone: trim(zone, 80) || null,
    p_activity_type: activityIds.has(activityType) ? activityType : 'other',
    p_deaths: deathCount,
    p_session_minutes: minutes,
    p_note: trim(note, 240),
    p_time_zone: resolvedTimeZone || 'UTC',
  };
}

export function deriveLevelDurationSeconds(events = [], event) {
  if (!event?.character_id || !event?.timestamp) return null;
  const currentMs = Date.parse(event.timestamp);
  if (!Number.isFinite(currentMs)) return null;
  const previous = events
    .filter(row => row.character_id === event.character_id && row.id !== event.id)
    .map(row => ({ row, ms: Date.parse(row.timestamp) }))
    .filter(item => Number.isFinite(item.ms) && item.ms < currentMs)
    .sort((a,b) => b.ms - a.ms)[0];
  if (!previous) return null;
  return Math.max(0, Math.round((currentMs - previous.ms) / 1000));
}
