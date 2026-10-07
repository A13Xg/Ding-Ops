import {
  Activity,
  AlarmClock,
  BadgeCheck,
  Bed,
  Bolt,
  CalendarDays,
  Castle,
  Clock3,
  Compass,
  Crown,
  Flame,
  Gauge,
  MapPinned,
  Medal,
  Moon,
  NotebookPen,
  Repeat2,
  Shield,
  Skull,
  Snowflake,
  Sparkles,
  Sun,
  Sunrise,
  Swords,
  Trophy,
  UsersRound,
} from 'lucide-react';

export const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'mythic'];

const iconMap = {
  Activity,
  AlarmClock,
  Clock3,
  Sparkles,
  Repeat2,
  Moon,
  Sun,
  Sunrise,
  Flame,
  Snowflake,
  Gauge,
  NotebookPen,
  BadgeCheck,
  CalendarDays,
  MapPinned,
  Crown,
  Medal,
  Trophy,
  Shield,
  Swords,
  Castle,
  Groups: UsersRound,
  UsersRound,
  Skull,
  Bolt,
  Bedtime: Bed,
  Explore: Compass,
};

export const prettyIcon = name =>
  String(name || 'Shield')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, character => character.toUpperCase());

export function MIcon({ name, className = '' }) {
  const key = name || 'Shield';
  const Icon = iconMap[key] || Shield;
  const label = prettyIcon(key);
  return (
    <span className={`icon-stack ${className}`} title={label} aria-label={label}>
      <Icon aria-hidden="true" />
    </span>
  );
}

export function BadgeIcon({ name }) {
  return <MIcon name={name || 'Shield'} />;
}
