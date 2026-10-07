import { GAME_CONFIG } from './gameConfig.js';

const now = new Date('2026-10-07T20:00:00Z');
const iso = offsetHours => new Date(now.getTime() - offsetHours * 3_600_000).toISOString();

const users = [
  { id: 'demo-alex', username: 'Alex', avatar_seed: 'alex', tagline: 'One more quest is a legally binding contract.', showcase: 'first_ding,dungeon_10,streak_7', active_character_id: 'char-alex' },
  { id: 'demo-travis', username: 'Travis', avatar_seed: 'travis', tagline: 'Queue popped. Society can wait.', showcase: 'ten_dings,late_night_ten,daily_5', active_character_id: 'char-travis' },
  { id: 'demo-kylie', username: 'Kylie', avatar_seed: 'kylie', tagline: 'Inventory sorted. Life absolutely is not.', showcase: 'questing_10,zones_5,notes_5', active_character_id: 'char-kylie' },
  { id: 'demo-jakob', username: 'Jakob', avatar_seed: 'jakob', tagline: 'Claims to be casual. Evidence says otherwise.', showcase: 'delve_10,speed_45,active_days_10', active_character_id: 'char-jakob' },
];

const characters = [
  { id: 'char-alex', user_id: 'demo-alex', name: 'Hexadecimal', realm: 'Area 52', region: 'US', class_name: 'Warlock', spec: 'Destruction', race: 'Orc', faction: 'Horde', current_level: 87, tracked_from_level: 80, is_archived: false },
  { id: 'char-alex-alt', user_id: 'demo-alex', name: 'Packetloss', realm: 'Area 52', region: 'US', class_name: 'Mage', spec: 'Arcane', race: 'Blood Elf', faction: 'Horde', current_level: 83, tracked_from_level: 80, is_archived: false },
  { id: 'char-travis', user_id: 'demo-travis', name: 'Chairbound', realm: 'Illidan', region: 'US', class_name: 'Paladin', spec: 'Retribution', race: 'Human', faction: 'Alliance', current_level: 89, tracked_from_level: 80, is_archived: false },
  { id: 'char-kylie', user_id: 'demo-kylie', name: 'Organizedchaos', realm: 'Stormrage', region: 'US', class_name: 'Priest', spec: 'Shadow', race: 'Void Elf', faction: 'Alliance', current_level: 85, tracked_from_level: 80, is_archived: false },
  { id: 'char-jakob', user_id: 'demo-jakob', name: 'Mountaindew', realm: 'Tichondrius', region: 'US', class_name: 'Demon Hunter', spec: 'Havoc', race: 'Night Elf', faction: 'Alliance', current_level: 88, tracked_from_level: 80, is_archived: false },
];

const activityCycle = ['questing', 'dungeon', 'delve', 'questing', 'campaign', 'dungeon'];
const zones = ['Harandar', 'Silvermoon', 'Voidstorm', 'Eversong Woods', 'Zul’Aman', 'Quel’Thalas'];

let seq = 0;
const events = [];
for (let day = 0; day < 24; day += 1) {
  const count = 1 + (day % 4);
  for (let n = 0; n < count; n += 1) {
    const user = users[(day + n) % users.length];
    const character = characters.find(row => row.user_id === user.id && row.id === user.active_character_id) || characters.find(row => row.user_id === user.id);
    const stamp = new Date(now.getTime() - day * 86_400_000 - n * 2_700_000);
    const level = Math.min(character.current_level, 80 + ((24 - day + n) % 10));
    events.push({
      id: `demo-event-${seq++}`,
      user_id: user.id,
      username: user.username,
      character_id: character.id,
      from_level: Math.max(1, level - 1),
      to_level: level,
      timestamp: stamp.toISOString(),
      local_date: stamp.toISOString().slice(0, 10),
      local_hour: stamp.getUTCHours(),
      time_bucket: stamp.getUTCHours() < 5 ? 'Late Night' : stamp.getUTCHours() < 12 ? 'Morning' : stamp.getUTCHours() < 17 ? 'Afternoon' : stamp.getUTCHours() < 21 ? 'Evening' : 'Prime Night',
      zone: zones[(day + n) % zones.length],
      activity_type: activityCycle[(day + n) % activityCycle.length],
      deaths: (day + n) % 6 === 0 ? 2 : (day + n) % 5 === 0 ? 1 : 0,
      session_minutes: 18 + ((day * 7 + n * 11) % 74),
      note: n === 0 && day % 5 === 0 ? 'Grass remains undefeated.' : '',
    });
  }
}
events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

const awardIds = [
  'first_ding','two_dings','three_dings','five_dings','ten_dings','twenty_dings',
  'streak_3','streak_5','streak_7','daily_3','daily_5','questing_ding','questing_5',
  'dungeon_ding','dungeon_5','dungeon_10','delve_ding','delve_5','late_night_ding',
  'late_night_five','zones_3','zones_5','notes_1','speed_60','speed_45','active_days_5',
];
let awardSeq = 0;
const achievements = users.flatMap((user, userIndex) =>
  awardIds.slice(0, 10 + userIndex * 4).map((achievement_type, index) => ({
    id: `demo-award-${awardSeq++}`,
    user_id: user.id,
    username: user.username,
    achievement_type,
    unlocked_at: iso(userIndex * 8 + index),
  }))
);

let currentUser = { ...users[0] };
let characterRows = characters.map(row => ({ ...row }));
let eventRows = events.map(row => ({ ...row }));
let achievementRows = achievements.map(row => ({ ...row }));

function clone(value) {
  return structuredClone(value);
}

function noopSubscription() {
  return () => {};
}

export const demoBackend = {
  async me() {
    return clone(currentUser);
  },
  async login() {
    return clone(currentUser);
  },
  async signup() {
    return clone(currentUser);
  },
  async logout() {},
  async updateOwnPassword() {
    return { ok: true };
  },
  async deleteAccount() {
    return { ok: true };
  },
  async gameConfig() {
    return {
      id: 'current',
      expansion_key: GAME_CONFIG.expansionKey,
      expansion_name: GAME_CONFIG.expansionName,
      level_cap: GAME_CONFIG.levelCap,
    };
  },
  async characters({ includeArchived = false } = {}) {
    return clone(characterRows.filter(row => includeArchived || !row.is_archived));
  },
  async createCharacter(input) {
    const row = {
      id: `demo-character-${Date.now()}`,
      user_id: currentUser.id,
      ...input,
      current_level: Number(input.current_level ?? input.currentLevel ?? 80),
      tracked_from_level: Number(input.tracked_from_level ?? input.current_level ?? input.currentLevel ?? 80),
      is_archived: false,
    };
    characterRows = [row, ...characterRows];
    return clone(row);
  },
  async updateCharacter(characterId, patch) {
    characterRows = characterRows.map(row => (row.id === characterId ? { ...row, ...patch } : row));
    return clone(characterRows.find(row => row.id === characterId));
  },
  async setActiveCharacter(characterId) {
    currentUser = { ...currentUser, active_character_id: characterId || null };
    return clone(currentUser);
  },
  async levelEvents(limit = 200) {
    return clone(eventRows.slice(0, limit));
  },
  async levelEventById(id) {
    return clone(eventRows.find(row => row.id === id) || null);
  },
  async recordDing(request) {
    const character = characterRows.find(row => row.id === request.p_character_id);
    const toLevel = Number(character.current_level) + 1;
    const stamp = new Date().toISOString();
    const row = {
      id: request.p_event_id,
      user_id: currentUser.id,
      username: currentUser.username,
      character_id: character.id,
      from_level: character.current_level,
      to_level: toLevel,
      timestamp: stamp,
      local_date: stamp.slice(0, 10),
      local_hour: new Date(stamp).getHours(),
      time_bucket: 'Evening',
      zone: request.p_zone || null,
      activity_type: request.p_activity_type || 'other',
      deaths: request.p_deaths ?? null,
      session_minutes: request.p_session_minutes ?? null,
      note: request.p_note || '',
    };
    eventRows = [row, ...eventRows];
    characterRows = characterRows.map(item => item.id === character.id ? { ...item, current_level: toLevel } : item);
    return clone(row);
  },
  async patchLevelEventNote(id, note) {
    eventRows = eventRows.map(row => row.id === id ? { ...row, note } : row);
    return clone(eventRows.find(row => row.id === id));
  },
  async dingDashboard() {
    return clone({
      users,
      characters: characterRows,
      levelEvents: eventRows,
      achievements: achievementRows,
    });
  },
  async reconcileAchievements() {
    return clone({ achievements: achievementRows, newlyEarned: [] });
  },
  async saveAchievements() {
    return clone(achievementRows);
  },
  async notifyEvent() {
    return { ok: true };
  },
  async registerPushSubscription() {
    return { ok: true };
  },
  async pushDeliveryReport() {
    return { deliveries: [], unavailable: 'Demo mode has no delivery ledger.' };
  },
  async broadcastTestNotification() {
    return { ok: true, attempted: 4, delivered: 4, pruned: 0 };
  },
  async adminSetPassword() {
    return { ok: true, username: 'Demo User' };
  },
  async getDiscordSettings() {
    return {
      ok: true,
      defaults: { enabled: false, ding_enabled: true, achievement_enabled: true, include_thumbnail: true },
      settings: { enabled: false, ding_enabled: true, achievement_enabled: true, include_thumbnail: true },
    };
  },
  async updateDiscordSettings(settings) {
    return { ok: true, settings };
  },
  async sendDiscordTestMessage() {
    return { ok: true, status: 204 };
  },
  webPushPublicKey() {
    return '';
  },
  async patchProfile(patch) {
    currentUser = { ...currentUser, ...patch };
    return clone(currentUser);
  },
  subscribeDing() {
    return noopSubscription();
  },
};
