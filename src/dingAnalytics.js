import { rankForUser } from './dingProgression.js';

// Pure analytics derivation: no viewer-state mutation, network access, or fabricated fields.

const DAY_MS = 86_400_000;

function dayKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function eventDay(event) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(event?.local_date || ''))) return event.local_date;
  const date = validDate(event?.timestamp);
  return date ? dayKeyFromDate(date) : null;
}

function longestStreak(events) {
  const days = [...new Set(events.map(eventDay).filter(Boolean))]
    .map(value => Date.parse(`${value}T12:00:00Z`))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let longest = 0;
  let current = 0;
  let previous = null;
  for (const day of days) {
    current = previous != null && day - previous === DAY_MS ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

function countBy(values) {
  const map = new Map();
  for (const value of values) {
    if (value == null || value === '') continue;
    map.set(value, (map.get(value) || 0) + 1);
  }
  return map;
}

function maxEntry(map) {
  let winner = null;
  for (const [key, value] of map) {
    if (!winner || value > winner.value) winner = { key, value };
  }
  return winner;
}

export function deriveDingAnalytics({
  events = [],
  users = [],
  characters = [],
  achievements = [],
  viewerId,
  now = Date.now(),
} = {}) {
  const viewerEvents = events.filter(event => event.user_id === viewerId);
  const todayKey = dayKeyFromDate(new Date(now));
  const cutoff = now - 7 * DAY_MS;
  const activeUserIds = new Set(
    events
      .filter(event => {
        const date = validDate(event.timestamp);
        return date && date.getTime() >= cutoff;
      })
      .map(event => event.user_id)
  );

  const leaderboard = users
    .map(user => {
      const count = events.filter(event => event.user_id === user.id).length;
      return {
        user,
        count,
        rank: rankForUser(achievements, user.id),
      };
    })
    .sort((a, b) => b.count - a.count || b.rank.xp - a.rank.xp || a.user.username.localeCompare(b.user.username));

  const viewerRank = leaderboard.findIndex(row => row.user.id === viewerId) + 1;
  const trend30 = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(now - (29 - index) * DAY_MS);
    const key = dayKeyFromDate(date);
    return {
      key,
      label: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      count: events.filter(event => {
        const stamp = validDate(event.timestamp);
        return stamp && dayKeyFromDate(stamp) === key;
      }).length,
    };
  });

  const week = trend30.slice(-7);
  const dayparts = [...countBy(events.map(event => event.time_bucket || 'Unknown'))].map(([label, count]) => ({
    label,
    count,
  }));
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: events.filter(event => Number(event.local_hour) === hour).length,
  }));

  const heat = Array.from({ length: 7 * 24 }, (_, index) => {
    const weekday = Math.floor(index / 24);
    const hour = index % 24;
    const count = events.filter(event => {
      const key = eventDay(event);
      if (!key || Number(event.local_hour) !== hour) return false;
      return new Date(`${key}T12:00:00Z`).getUTCDay() === weekday;
    }).length;
    return { weekday, hour, count };
  });

  const activities = [...countBy(events.map(event => event.activity_type || 'other'))]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));

  const characterContribution = characters
    .map(character => ({
      character,
      count: events.filter(event => event.character_id === character.id).length,
    }))
    .filter(row => row.count > 0)
    .sort((a, b) => b.count - a.count || a.character.name.localeCompare(b.character.name));

  const pace = viewerEvents
    .filter(event => Number.isInteger(event.session_minutes))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(event => ({
      id: event.id,
      level: event.to_level,
      minutes: event.session_minutes,
      timestamp: event.timestamp,
    }));

  const measured = events.filter(event => Number.isInteger(event.session_minutes));
  const fastest = [...measured].sort((a, b) => a.session_minutes - b.session_minutes)[0] || null;
  const slowest = [...measured].sort((a, b) => b.session_minutes - a.session_minutes)[0] || null;
  const highestDeaths =
    [...events].filter(event => Number.isInteger(event.deaths)).sort((a, b) => b.deaths - a.deaths)[0] || null;
  const mostInDay = maxEntry(countBy(events.map(eventDay).filter(Boolean)));
  const mostActiveCharacter = characterContribution[0] || null;
  const userCharacterCounts = users.map(user => ({
    user,
    count: characters.filter(character => character.user_id === user.id && !character.is_archived).length,
  }));
  const mostAlts = [...userCharacterCounts].sort((a, b) => b.count - a.count)[0] || null;

  return {
    summary: {
      groupDings: events.length,
      activeGrinders: activeUserIds.size,
      today: events.filter(event => {
        const stamp = validDate(event.timestamp);
        return stamp && dayKeyFromDate(stamp) === todayKey;
      }).length,
      viewerRank: viewerRank > 0 ? viewerRank : null,
      viewerDings: viewerEvents.length,
      viewerStreak: longestStreak(viewerEvents),
    },
    leaderboard,
    trend30,
    week,
    dayparts,
    hours,
    heat,
    activities,
    characterContribution,
    pace,
    xpRanking: [...leaderboard].sort((a, b) => b.rank.xp - a.rank.xp || b.count - a.count),
    records: {
      fastest,
      slowest,
      highestDeaths,
      mostInDay,
      mostActiveCharacter,
      mostAlts,
    },
  };
}
