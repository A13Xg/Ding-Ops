/*
 * Achievement glyphs shared by DING trophy surfaces.
 * Material Symbols is bundled through material-symbols/outlined.css in main.jsx,
 * so render the ligature directly instead of depending on an external
 * font-readiness side channel from the retired Bust entrypoint.
 */
export const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'mythic'];

export const matMap = {
  Activity: 'monitoring',
  AlarmClock: 'alarm',
  Clock3: 'schedule',
  Sparkles: 'auto_awesome',
  Repeat2: 'repeat',
  Moon: 'dark_mode',
  Sun: 'light_mode',
  Sunrise: 'wb_twilight',
  Flame: 'local_fire_department',
  Snowflake: 'ac_unit',
  Gauge: 'speed',
  NotebookPen: 'edit_note',
  BadgeCheck: 'verified',
  CalendarDays: 'calendar_month',
  MapPinned: 'location_on',
  Crown: 'crown',
  Medal: 'military_tech',
  Trophy: 'trophy',
  Shield: 'shield',
  Swords: 'swords',
  Castle: 'castle',
  Groups: 'groups',
  Skull: 'skull',
  Bolt: 'bolt',
  Bedtime: 'bedtime',
  Explore: 'explore',
};

export const prettyIcon = n =>
  String(n || 'shield')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

export function MIcon({ name, className = '' }) {
  const key = name || 'shield';
  return (
    <span className={`icon-stack ${className}`} title={prettyIcon(key)} aria-label={prettyIcon(key)}>
      <span className="msym material-symbols-outlined" aria-hidden="true">
        {key}
      </span>
    </span>
  );
}

export function BadgeIcon({ name }) {
  return <MIcon name={matMap[name] || name || 'shield'} />;
}
