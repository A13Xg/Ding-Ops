const item = (id, name, desc, tier, points, icon, criterion) =>
  Object.freeze({ id, name, desc, tier, kind: tier === 'mythic' ? 'trophy' : 'achievement', points, accent: tierAccent(tier), icon, criterion });

function tierAccent(tier) {
  return {
    bronze: '#60a5fa',
    silver: '#818cf8',
    gold: '#a78bfa',
    platinum: '#c084fc',
    mythic: '#f4c95d',
  }[tier] || '#60a5fa';
}

const volumeAwards = [
  [1, 'first_ding', 'First Ding', 'Record your first tracked level.', 'bronze', 10],
  [2, 'two_dings', 'Double Pull', 'Record 2 tracked levels.', 'bronze', 15],
  [3, 'three_dings', 'Three Quest Problem', 'Record 3 tracked levels.', 'bronze', 15],
  [5, 'five_dings', 'Five Stack', 'Record 5 tracked levels.', 'bronze', 20],
  [10, 'ten_dings', 'XP Goblin', 'Record 10 tracked levels.', 'silver', 50],
  [15, 'fifteen_dings', 'Quest Log Occupancy', 'Record 15 tracked levels.', 'silver', 55],
  [20, 'twenty_dings', 'Chair Bonded', 'Record 20 tracked levels.', 'silver', 60],
  [25, 'twenty_five_dings', 'Grass Dodger', 'Record 25 tracked levels.', 'gold', 120],
  [30, 'thirty_dings', 'Sunlight Debuff', 'Record 30 tracked levels.', 'gold', 130],
  [40, 'forty_dings', 'Basement Tenure', 'Record 40 tracked levels.', 'gold', 150],
  [50, 'fifty_dings', 'Half-Century Grind', 'Record 50 tracked levels.', 'platinum', 220],
  [60, 'sixty_dings', 'Ergonomic Concern', 'Record 60 tracked levels.', 'platinum', 240],
  [75, 'seventy_five_dings', 'XP Industrial Complex', 'Record 75 tracked levels.', 'platinum', 280],
  [100, 'hundred_dings', 'Touch Grass Challenge — Failed', 'Record 100 tracked levels.', 'mythic', 400],
  [150, 'hundred_fifty_dings', 'Permanent Residence', 'Record 150 tracked levels.', 'mythic', 500],
].map(([threshold, id, name, desc, tier, points]) =>
  item(id, name, desc, tier, points, 'Bolt', { type: 'event_count', threshold })
);

const levelAwards = [10, 20, 30, 40, 50, 60, 70, 80, 90].map(level => {
  const isCap = level === 90;
  const tier = isCap ? 'mythic' : level >= 80 ? 'platinum' : level >= 60 ? 'gold' : level >= 30 ? 'silver' : 'bronze';
  return item(
    isCap ? 'max_level' : `level_${level}`,
    isCap ? 'Mythic No-Lifer' : `Level ${level}: Number Bigger`,
    `Record a Ding that reaches level ${level}.`,
    tier,
    isCap ? 300 : 15 + level,
    isCap ? 'Trophy' : 'Bolt',
    isCap ? { type: 'configured_cap_reached' } : { type: 'level_reached', threshold: level }
  );
});

const dailyAwards = [
  [2, 'Double Ding Day', 'bronze', 20],
  [3, 'Hat Trick', 'silver', 35],
  [5, 'Five-Level Friday Energy', 'silver', 50],
  [8, 'Eight Hour Problem', 'gold', 80],
  [10, 'Ten in a Day', 'platinum', 140],
  [15, 'Please Stand Up', 'mythic', 220],
].map(([threshold, name, tier, points]) =>
  item(`daily_${threshold}`, name, `Record ${threshold} Dings on one local calendar day.`, tier, points, 'CalendarDays', {
    type: 'daily_max',
    threshold,
  })
);

const streakAwards = [
  [2, 'Back Tomorrow', 'bronze', 20],
  [3, 'Three-Day Subscription', 'bronze', 25],
  [5, 'Workweek Warrior', 'silver', 45],
  [7, 'No Days Off', 'silver', 65],
  [10, 'Ten-Day Sweat', 'gold', 90],
  [14, 'Two-Week Lease', 'gold', 120],
  [21, 'Habit Formed', 'platinum', 180],
  [30, 'Monthly Tenant', 'mythic', 260],
].map(([threshold, name, tier, points]) =>
  item(`streak_${threshold}`, name, `Record at least one Ding on ${threshold} consecutive local days.`, tier, points, 'Repeat2', {
    type: 'streak_days',
    threshold,
  })
);

const timeBucketAwards = [
  ['Late Night', 'late_night_ding', 'Sleep Is a DPS Loss', 'Moon'],
  ['Early Morning', 'early_morning_ding', 'The Sun Is Coming Up', 'Sunrise'],
  ['Morning', 'morning_ding', 'Breakfast Buff', 'Sun'],
  ['Afternoon', 'afternoon_ding', 'Productivity Avoidance', 'Clock3'],
  ['Evening', 'evening_ding', 'Prime Time Sweat', 'Activity'],
  ['Prime Night', 'prime_night_ding', 'One More Quest', 'Moon'],
].map(([bucket, id, name, icon]) =>
  item(id, name, `Record a Ding during the ${bucket.toLowerCase()} time bucket.`, 'silver', 30, icon, {
    type: 'time_bucket_count',
    bucket,
    threshold: 1,
  })
);

const repeatedTimeAwards = [
  ['Late Night', 'late_night', 'Moon', [5, 'five', 'Night Shift Regular', 'silver'], [10, 'ten', 'Circadian Raider', 'gold'], [25, 'twenty_five', 'Sleep Schedule Deleted', 'platinum']],
  ['Early Morning', 'early_morning', 'Sunrise', [5, 'five', 'Dawn Patrol', 'silver'], [10, 'ten', 'Breakfast Raid Leader', 'gold'], [25, 'twenty_five', 'Sunrise Is a Mechanic', 'platinum']],
].flatMap(([bucket, prefix, icon, ...rows]) =>
  rows.map(([threshold, suffix, name, tier]) =>
    item(
      `${prefix}_${suffix}`,
      name,
      `Record ${threshold} Dings during the ${bucket.toLowerCase()} bucket.`,
      tier,
      35 + threshold * 3,
      icon,
      { type: 'time_bucket_count', bucket, threshold }
    )
  )
);

const activityDefinitions = [
  ['questing', 'Questing', 'questing_ding', 'Quest Goblin', 'NotebookPen'],
  ['dungeon', 'Dungeon', 'dungeon_ding', 'Dungeon Rat', 'Castle'],
  ['delve', 'Delve', 'delve_ding', 'Hole Enthusiast', 'Explore'],
  ['pvp', 'PvP', 'pvp_ding', 'Violence Was the Answer', 'Swords'],
  ['grinding', 'Mob Grinding', 'grinding_ding', 'Mob Accountant', 'Activity'],
  ['campaign', 'Campaign', 'campaign_ding', 'Main Character Syndrome', 'Crown'],
  ['profession', 'Profession / Gathering', 'profession_ding', 'Crafting Detour', 'BadgeCheck'],
  ['other', 'Other', 'other_ding', 'Unclassifiable Sweat', 'Shield'],
];

const activityAwards = activityDefinitions.flatMap(([activity, label, firstId, firstName, icon]) => [
  item(firstId, firstName, `Record a Ding while doing ${label.toLowerCase()}.`, 'bronze', 20, icon, {
    type: 'activity_count',
    activity,
    threshold: 1,
  }),
  ...[
    [5, 'silver', 40, 'Regular'],
    [10, 'gold', 70, 'Resident'],
    [25, 'platinum', 130, 'Specialist'],
  ].map(([threshold, tier, points, suffix]) =>
    item(
      `${activity}_${threshold}`,
      `${label} ${suffix}`,
      `Record ${threshold} Dings from ${label.toLowerCase()}.`,
      tier,
      points,
      icon,
      { type: 'activity_count', activity, threshold }
    )
  ),
]);

const speedAwards = [
  [120, 'speed_120', 'Two-Hour Tourist', 'bronze', 20],
  [90, 'speed_90', 'Efficient-ish', 'bronze', 25],
  [60, 'speed_60', 'One-Hour Wonder', 'silver', 35],
  [45, 'speed_45', 'Quest Text Optional', 'silver', 45],
  [30, 'speed_level', 'Rested XP Is for Cowards', 'gold', 60],
  [20, 'speed_20', 'XP Conveyor Belt', 'gold', 80],
  [15, 'speed_15', 'Blizzard Would Like a Word', 'platinum', 110],
  [10, 'speed_10', 'Speedrun Behavior', 'mythic', 170],
].map(([threshold, id, name, tier, points]) =>
  item(id, name, `Record a level completed in ${threshold} minutes or less.`, tier, points, 'Gauge', {
    type: 'session_lte',
    threshold,
  })
);

const deathAwards = [
  item('flawless_level', 'No Corpse Run Today', 'Record a Ding with zero deaths.', 'bronze', 20, 'Shield', {
    type: 'deaths_eq',
    threshold: 0,
  }),
  ...[
    [1, 'one_death', 'Minor Skill Issue', 'bronze', 15],
    [5, 'death_tax', 'Corpse Run Enthusiast', 'silver', 35],
    [10, 'ten_deaths', 'Spirit Healer Frequent Flyer', 'gold', 65],
    [20, 'twenty_deaths', 'Repair Bill Enjoyer', 'platinum', 110],
  ].map(([threshold, id, name, tier, points]) =>
    item(id, name, `Record a level with at least ${threshold} death${threshold === 1 ? '' : 's'}.`, tier, points, 'Skull', {
      type: 'deaths_gte',
      threshold,
    })
  ),
];

const characterAwards = [
  [2, 'two_alts', 'Alt Curious', 'bronze', 20],
  [3, 'altaholic', 'Altaholic', 'gold', 90],
  [5, 'five_alts', 'Character Select Main', 'gold', 110],
  [8, 'eight_alts', 'Roster Problem', 'platinum', 160],
  [10, 'ten_alts', 'Login Screen Landlord', 'mythic', 220],
].map(([threshold, id, name, tier, points]) =>
  item(id, name, `Track at least ${threshold} characters.`, tier, points, 'Groups', {
    type: 'character_count',
    threshold,
  })
);

const classAwards = [
  [3, 'Class Tourist', 'silver', 40],
  [5, 'Role Confusion', 'gold', 75],
  [8, 'Toolbox Account', 'platinum', 130],
  [13, 'All Classes, No Grass', 'mythic', 240],
].map(([threshold, name, tier, points]) =>
  item(`classes_${threshold}`, name, `Track ${threshold} distinct classes.`, tier, points, 'Swords', {
    type: 'unique_classes',
    threshold,
  })
);

const zoneAwards = [
  [3, 'Three-Zone Tour', 'bronze', 20],
  [5, 'Map Has Been Opened', 'silver', 35],
  [10, 'Flight Path Collector', 'gold', 70],
  [20, 'Azeroth Commuter', 'platinum', 130],
  [30, 'Where Is Outside?', 'mythic', 210],
].map(([threshold, name, tier, points]) =>
  item(`zones_${threshold}`, name, `Record Dings in ${threshold} distinct named zones.`, tier, points, 'MapPinned', {
    type: 'unique_zones',
    threshold,
  })
);

const noteAwards = [
  [1, 'Excuse Filed', 'bronze', 10],
  [5, 'Patch Notes', 'silver', 25],
  [10, 'Author Main', 'gold', 45],
  [25, 'Memoir of a Grinder', 'platinum', 90],
].map(([threshold, name, tier, points]) =>
  item(`notes_${threshold}`, name, `Attach notes to ${threshold} Ding events.`, tier, points, 'NotebookPen', {
    type: 'note_count',
    threshold,
  })
);

const weekendAwards = [
  [1, 'Weekend Warrior', 'bronze', 15],
  [5, 'Saturday Is Gone', 'silver', 35],
  [10, 'Weekend Deleted', 'gold', 70],
].map(([threshold, name, tier, points]) =>
  item(`weekend_${threshold}`, name, `Record ${threshold} Dings on Saturdays or Sundays.`, tier, points, 'CalendarDays', {
    type: 'weekend_count',
    threshold,
  })
);

const maxCharacterAwards = [
  [1, 'One Capped Character', 'gold', 80],
  [2, 'Double Cap', 'platinum', 130],
  [3, 'Three Max Problems', 'platinum', 180],
  [5, 'Stable of No-Lifers', 'mythic', 300],
].map(([threshold, name, tier, points]) =>
  item(
    `maxed_chars_${threshold}`,
    name,
    `Have ${threshold} tracked characters at the configured level cap.`,
    tier,
    points,
    'Crown',
    { type: 'max_level_characters', threshold }
  )
);

const realmAwards = [
  [2, 'Realm Hopper', 'bronze', 20],
  [3, 'Server Tourist', 'silver', 35],
  [5, 'Realm Collection', 'gold', 70],
].map(([threshold, name, tier, points]) =>
  item(`realms_${threshold}`, name, `Track characters across ${threshold} distinct realms.`, tier, points, 'Explore', {
    type: 'unique_realms',
    threshold,
  })
);

const activeDayAwards = [
  [5, 'Five Active Days', 'bronze', 20],
  [10, 'Ten Active Days', 'silver', 40],
  [30, 'Thirty Active Days', 'gold', 90],
  [60, 'Sixty Active Days', 'platinum', 160],
  [100, 'Century of Sweat', 'mythic', 260],
].map(([threshold, name, tier, points]) =>
  item(`active_days_${threshold}`, name, `Record Dings on ${threshold} distinct local days.`, tier, points, 'CalendarDays', {
    type: 'unique_days',
    threshold,
  })
);

const measuredAwards = [
  [5, 'Timer User', 'bronze', 20],
  [10, 'Stopwatch Sweat', 'silver', 35],
  [25, 'Measured Degeneracy', 'gold', 75],
  [50, 'Performance Review', 'platinum', 140],
].map(([threshold, name, tier, points]) =>
  item(`measured_${threshold}`, name, `Record session time on ${threshold} Ding events.`, tier, points, 'Clock3', {
    type: 'session_count',
    threshold,
  })
);

export const dingAchievements = Object.freeze([
  ...volumeAwards,
  ...levelAwards,
  ...dailyAwards,
  ...streakAwards,
  ...timeBucketAwards,
  ...repeatedTimeAwards,
  ...activityAwards,
  ...speedAwards,
  ...deathAwards,
  ...characterAwards,
  ...classAwards,
  ...zoneAwards,
  ...noteAwards,
  ...weekendAwards,
  ...maxCharacterAwards,
  item('both_factions', 'Factionally Indecisive', 'Track characters from both Alliance and Horde.', 'gold', 70, 'Groups', {
    type: 'factions_count',
    threshold: 2,
  }),
  ...realmAwards,
  ...activeDayAwards,
  ...measuredAwards,
]);

function normalizedDate(value) {
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(String(value || ''));
  return match ? match[0] : null;
}

function longestDateStreak(dateValues) {
  const days = [...new Set(dateValues.map(normalizedDate).filter(Boolean))]
    .map(value => Date.parse(`${value}T12:00:00Z`))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let longest = 0;
  let current = 0;
  let previous = null;
  for (const day of days) {
    current = previous != null && day - previous === 86_400_000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

function metricMap(values) {
  const map = new Map();
  for (const value of values) {
    if (value == null || value === '') continue;
    map.set(value, (map.get(value) || 0) + 1);
  }
  return map;
}

function buildMetrics(events, characters, levelCap) {
  const dates = events.map(event => normalizedDate(event.local_date)).filter(Boolean);
  const dailyCounts = metricMap(dates);
  const activityCounts = metricMap(events.map(event => event.activity_type || 'other'));
  const bucketCounts = metricMap(events.map(event => event.time_bucket));
  const uniqueZones = new Set(events.map(event => String(event.zone || '').trim().toLowerCase()).filter(Boolean));
  const uniqueClasses = new Set(characters.map(character => String(character.class_name || '').trim().toLowerCase()).filter(Boolean));
  const uniqueRealms = new Set(characters.map(character => String(character.realm || '').trim().toLowerCase()).filter(Boolean));
  const factions = new Set(
    characters
      .map(character => character.faction)
      .filter(faction => faction === 'Alliance' || faction === 'Horde')
  );

  return {
    levelCap: Number(levelCap) || 90,
    eventCount: events.length,
    maxLevelReached: events.reduce((max, event) => Math.max(max, Number(event.to_level) || 0), 0),
    dailyMax: Math.max(0, ...dailyCounts.values()),
    longestStreak: longestDateStreak(dates),
    activityCounts,
    bucketCounts,
    sessionMinutes: events.map(event => event.session_minutes).filter(Number.isInteger),
    deaths: events.map(event => event.deaths).filter(Number.isInteger),
    characterCount: characters.length,
    uniqueClasses: uniqueClasses.size,
    uniqueZones: uniqueZones.size,
    noteCount: events.filter(event => String(event.note || '').trim()).length,
    weekendCount: events.filter(event => {
      const date = normalizedDate(event.local_date);
      if (!date) return false;
      const day = new Date(`${date}T12:00:00Z`).getUTCDay();
      return day === 0 || day === 6;
    }).length,
    maxLevelCharacters: characters.filter(character => Number(character.current_level) >= Number(levelCap)).length,
    factions: factions.size,
    uniqueRealms: uniqueRealms.size,
    uniqueDays: new Set(dates).size,
    sessionCount: events.filter(event => Number.isInteger(event.session_minutes)).length,
  };
}

function meets(criterion, metrics) {
  const threshold = Number(criterion.threshold) || 0;
  switch (criterion.type) {
    case 'event_count':
      return metrics.eventCount >= threshold;
    case 'level_reached':
      return metrics.maxLevelReached >= threshold;
    case 'configured_cap_reached':
      return metrics.maxLevelReached >= metrics.levelCap;
    case 'daily_max':
      return metrics.dailyMax >= threshold;
    case 'streak_days':
      return metrics.longestStreak >= threshold;
    case 'time_bucket_count':
      return (metrics.bucketCounts.get(criterion.bucket) || 0) >= threshold;
    case 'activity_count':
      return (metrics.activityCounts.get(criterion.activity) || 0) >= threshold;
    case 'session_lte':
      return metrics.sessionMinutes.some(value => value <= threshold);
    case 'deaths_eq':
      return metrics.deaths.some(value => value === threshold);
    case 'deaths_gte':
      return metrics.deaths.some(value => value >= threshold);
    case 'character_count':
      return metrics.characterCount >= threshold;
    case 'unique_classes':
      return metrics.uniqueClasses >= threshold;
    case 'unique_zones':
      return metrics.uniqueZones >= threshold;
    case 'note_count':
      return metrics.noteCount >= threshold;
    case 'weekend_count':
      return metrics.weekendCount >= threshold;
    case 'max_level_characters':
      return metrics.maxLevelCharacters >= threshold;
    case 'factions_count':
      return metrics.factions >= threshold;
    case 'unique_realms':
      return metrics.uniqueRealms >= threshold;
    case 'unique_days':
      return metrics.uniqueDays >= threshold;
    case 'session_count':
      return metrics.sessionCount >= threshold;
    default:
      return false;
  }
}

/**
 * All achievement conditions are derived exclusively from persisted DING
 * level_events and characters. The function returns only newly earned IDs.
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
  const ownedCharacters = characters.filter(character => character?.user_id === userId && !character?.is_archived);
  const unlocked = new Set(existing.filter(row => row?.user_id === userId).map(row => row.achievement_type));
  const metrics = buildMetrics(ownedEvents, ownedCharacters, levelCap);
  return dingAchievements
    .filter(achievement => !unlocked.has(achievement.id) && meets(achievement.criterion, metrics))
    .map(achievement => achievement.id);
}

export function dingAchievementById(id) {
  return dingAchievements.find(achievement => achievement.id === id) || null;
}
