/*
 * Notification copy shared by the browser client and Supabase Edge Functions.
 * Variant selection is seeded from the event id so one Ding renders the same
 * wording on every recipient device and retry path.
 */

export const DING_TITLES = [
  '{user} dinged {level}',
  '{character} hit {level}',
  'Level {level}: {character}',
  '{user} found another level',
  '{character} refuses to touch grass',
  'XP bar defeated: {character}',
];

export const DING_BODIES = [
  'Another level secured. Sunlight remains optional.',
  'The grind continues. The chair has accepted its fate.',
  'One more level between this player and a normal sleep schedule.',
  'The leaderboard moved. Somebody check the snack reserves.',
  'Quest text was probably ignored. The XP still counted.',
  'A completely reasonable amount of gaming has occurred.',
  'The basement command center reports nominal Dorito dust levels.',
  'Rested XP is starting to feel personally rejected.',
  'Another contribution to the least necessary performance review in Azeroth.',
  'Level acquired. Grass exposure remains unconfirmed.',
];

export const ACHIEVEMENT_TITLES = [
  '{user} unlocked {name}',
  '{name} — claimed by {user}',
  '{user} earned {name}',
  'New hardware for {user}: {name}',
];

export const ACHIEVEMENT_BODIES = [
  'Awarded for behavior that probably should not have been instrumented.',
  'The trophy pile grows. So does the concern.',
  'Certified, timestamped, and aggressively unnecessary.',
  'Add it to the pile. The pile is becoming a personality.',
  'Skill, persistence, or unhealthy scheduling. The badge does not care.',
  'Somewhere, a spreadsheet is extremely proud.',
];

export const INACTIVITY_MESSAGE_CATALOG = [
  { text: 'Your XP bar has filed a missing-person report.', weight: 5 },
  { text: 'No Ding in days. Casual behavior detected.', weight: 5 },
  { text: 'Grass exposure suspected. Return to the grind.', weight: 5 },
  { text: 'Your chair has started cooling down. Fix that.', weight: 4 },
  { text: 'The dungeon finder has not seen your name in an alarming amount of time.', weight: 4 },
  { text: 'Your character is beginning to think you have hobbies.', weight: 4 },
  { text: 'The Mountain Dew reserves are questioning your commitment.', weight: 3 },
  { text: 'Rested XP is accumulating. This is getting embarrassing.', weight: 3 },
  { text: 'Your keyboard has entered an abandonment phase.', weight: 3 },
  { text: 'A suspicious amount of real life appears to be happening.', weight: 3 },
  { text: 'The basement command center reports zero recent progression.', weight: 2 },
  { text: 'One more quest became zero more quests somehow.', weight: 2 },
  { text: 'Your alt army has submitted a formal complaint.', weight: 2 },
  { text: 'Five days without number-go-up is not the culture we built here.', weight: 2 },
  { text: 'Log in. Make the number larger. Restore order.', weight: 1 },
];

/** Small stable string hash so client and server pick the same variant. */
export function seedIndex(seed, length) {
  if (!length) return 0;
  const text = String(seed ?? '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % length;
}

function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

export function buildDingNotification({ username, characterName, toLevel, note, eventId, zone } = {}) {
  const user = String(username || 'Someone').trim() || 'Someone';
  const character = String(characterName || 'a character').trim() || 'a character';
  const level = Number.isInteger(Number(toLevel)) ? String(Number(toLevel)) : '?';
  const seed = eventId || `${user}:${character}:${level}:${note || ''}`;
  const trimmedNote = String(note || '').trim();
  const suffix = zone ? ` · ${zone}` : '';
  const values = { user, character, level };
  return {
    title: fill(DING_TITLES[seedIndex(`t:${seed}`, DING_TITLES.length)], values),
    body: trimmedNote
      ? `“${trimmedNote}”${suffix}`
      : `${DING_BODIES[seedIndex(`b:${seed}`, DING_BODIES.length)]}${suffix}`,
    tag: `ding-${eventId || seed}`,
    kind: 'ding',
  };
}

export function buildAchievementNotification({ username, achievementName, achievementId, tier } = {}) {
  const user = String(username || 'Someone').trim() || 'Someone';
  const name = String(achievementName || achievementId || 'a new badge').trim();
  const seed = `${user}:${achievementId || name}`;
  return {
    title: fill(ACHIEVEMENT_TITLES[seedIndex(`t:${seed}`, ACHIEVEMENT_TITLES.length)], { user, name }),
    body: ACHIEVEMENT_BODIES[seedIndex(`b:${seed}`, ACHIEVEMENT_BODIES.length)],
    tag: `achievement-${user}-${achievementId || name}`,
    kind: 'achievement',
    tier: tier || null,
  };
}
