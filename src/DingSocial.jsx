// DING player progression, trophy, crew and realtime social surfaces.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, Save, Shield, Swords, Trophy, UsersRound, X } from 'lucide-react';
import { BadgeMedal } from './BadgeToast.jsx';
import { backend } from './backend.js';
import { dingAchievementById, dingAchievements } from './dingAchievements.js';
import {
  achievementXpForUser,
  parseShowcase,
  rankForUser,
  serializeShowcase,
} from './dingProgression.js';
import { hapticsEnabled, setHapticsEnabled } from './haptics.js';

function initials(value) {
  return String(value || '?')
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function RankBlock({ achievements, userId }) {
  const rank = rankForUser(achievements, userId);
  return (
    <div className={'ding-rank-block mf-frame' + (rank.maxed ? ' mythic' : '')}>
      <div>
        <span>APP RANK</span>
        <strong>{rank.name}</strong>
      </div>
      <div className="ding-rank-xp">
        <b>{rank.xp} XP</b>
        <small>{rank.maxed ? 'Peak basement performance' : `${rank.remaining} XP to ${rank.next.name}`}</small>
      </div>
      <div className="ding-rank-progress" aria-label={`${Math.round(rank.progress * 100)} percent to next app rank`}>
        <i style={{ width: `${Math.round(rank.progress * 100)}%` }} />
      </div>
    </div>
  );
}

export function ProfilePane({ user, characters, events, achievements, onUserUpdated }) {
  const ownCharacters = characters.filter(character => character.user_id === user.id && !character.is_archived);
  const ownEvents = events.filter(event => event.user_id === user.id);
  const ownedAwards = achievements.filter(row => row.user_id === user.id);
  const unlocked = new Set(ownedAwards.map(row => row.achievement_type));
  const [tagline, setTagline] = useState(user.tagline || '');
  const [showcase, setShowcase] = useState(() => parseShowcase(user.showcase));
  const [saving, setSaving] = useState(false);
  const [haptics, setHaptics] = useState(() => hapticsEnabled());

  useEffect(() => {
    setTagline(user.tagline || '');
    setShowcase(parseShowcase(user.showcase));
  }, [user.tagline, user.showcase]);

  async function saveProfile(patch) {
    setSaving(true);
    try {
      const updated = await backend.patchProfile(patch);
      onUserUpdated?.(updated);
      return updated;
    } finally {
      setSaving(false);
    }
  }

  async function toggleShowcase(id) {
    const next = showcase.includes(id)
      ? showcase.filter(item => item !== id)
      : [...showcase, id].slice(-3);
    setShowcase(next);
    try {
      await saveProfile({ showcase: serializeShowcase(next) });
    } catch {
      setShowcase(parseShowcase(user.showcase));
    }
  }

  return (
    <div className="ding-profile">
      <section className="ding-profile-hero mf-frame">
        <div className="ding-avatar" aria-hidden="true">{initials(user.username)}</div>
        <div>
          <span className="mf-kicker">OPERATOR</span>
          <h2>{user.username}</h2>
          <p>{user.tagline || 'No bio. Too busy grinding.'}</p>
        </div>
      </section>

      <RankBlock achievements={achievements} userId={user.id} />

      <div className="ding-stat-grid">
        <div className="stat mf-frame"><span>DINGS</span><strong>{ownEvents.length}</strong><small>tracked levels</small></div>
        <div className="stat mf-frame"><span>CHARACTERS</span><strong>{ownCharacters.length}</strong><small>active alts</small></div>
        <div className="stat mf-frame"><span>AWARDS</span><strong>{ownedAwards.length}</strong><small>questionable honors</small></div>
        <div className="stat mf-frame"><span>APP XP</span><strong>{achievementXpForUser(achievements, user.id)}</strong><small>separate from WoW XP</small></div>
      </div>

      <section className="ding-panel mf-frame">
        <h2>Profile</h2>
        <label className="ding-note">
          BASEMENT BIO
          <textarea
            maxLength={80}
            value={tagline}
            onChange={event => setTagline(event.target.value)}
            placeholder="Optional public warning label…"
          />
          <button
            className="mf-button"
            type="button"
            disabled={saving || tagline === (user.tagline || '')}
            onClick={() => saveProfile({ tagline })}
          >
            <Save /> {saving ? 'SAVING…' : 'SAVE BIO'}
          </button>
        </label>
        <label className="ding-toggle">
          <input
            type="checkbox"
            checked={haptics}
            onChange={event => {
              const next = event.target.checked;
              setHaptics(next);
              setHapticsEnabled(next);
            }}
          />
          <span>Haptic feedback</span>
          <small>Best-effort vibration where the browser supports it.</small>
        </label>
      </section>

      <section className="ding-panel mf-frame">
        <h2>Showcase</h2>
        <p className="ding-muted">Pick up to three earned awards for your profile.</p>
        <div className="ding-award-grid compact">
          {dingAchievements.filter(item => unlocked.has(item.id)).map(item => {
            const selected = showcase.includes(item.id);
            return (
              <button
                type="button"
                className={'ding-award-card' + (selected ? ' selected' : '')}
                key={item.id}
                onClick={() => toggleShowcase(item.id)}
              >
                <BadgeMedal icon={item.micon || item.icon} accent={item.accent} tier={item.tier} />
                <span><b>{item.name}</b><small>{item.tier} · {item.points} XP</small></span>
                {selected && <Check />}
              </button>
            );
          })}
          {!ownedAwards.length && <div className="ding-empty">Earn something first. Revolutionary concept.</div>}
        </div>
      </section>
    </div>
  );
}

export function TrophyPane({ userId, achievements }) {
  const rows = achievements.filter(row => row.user_id === userId);
  const unlocked = new Set(rows.map(row => row.achievement_type));
  const xp = achievementXpForUser(achievements, userId);
  return (
    <div className="ding-trophies">
      <div className="ding-trophy-summary mf-frame">
        <Trophy />
        <div><strong>{unlocked.size} / {dingAchievements.length}</strong><span>awards unlocked</span></div>
        <div><strong>{xp}</strong><span>app XP</span></div>
      </div>
      <div className="ding-award-grid">
        {dingAchievements.map(item => {
          const earned = unlocked.has(item.id);
          return (
            <article className={'ding-award-card mf-frame' + (earned ? ' earned' : ' locked')} key={item.id}>
              <BadgeMedal icon={item.micon || item.icon} accent={earned ? item.accent : '#475569'} tier={item.tier} />
              <div>
                <span className="mf-kicker">{item.tier}</span>
                <h3>{item.name}</h3>
                <p>{item.desc}</p>
                <small>{item.points} XP · {earned ? 'UNLOCKED' : 'LOCKED'}</small>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function CrewPane({ users, characters, events, achievements, viewerId }) {
  const viewerDings = events.filter(event => event.user_id === viewerId).length;
  const rows = useMemo(
    () =>
      users
        .map(user => {
          const active = characters.find(character => character.id === user.active_character_id)
            || characters.find(character => character.user_id === user.id && !character.is_archived)
            || null;
          const dings = events.filter(event => event.user_id === user.id).length;
          const awards = achievements.filter(row => row.user_id === user.id).length;
          return { user, active, dings, awards, rank: rankForUser(achievements, user.id) };
        })
        .sort((a, b) => b.dings - a.dings || a.user.username.localeCompare(b.user.username)),
    [users, characters, events, achievements]
  );

  return (
    <div className="ding-crew-list">
      {rows.map((row, index) => (
        <article className={'ding-crew-card mf-frame' + (row.user.id === viewerId ? ' self' : '')} key={row.user.id}>
          <div className="ding-avatar small" aria-hidden="true">{initials(row.user.username)}</div>
          <div className="ding-crew-copy">
            <span className="mf-kicker">#{index + 1} · {row.rank.name}</span>
            <h3>{row.user.username}</h3>
            <p>{row.user.tagline || 'No public excuse provided.'}</p>
            <small>
              {row.active
                ? `${row.active.name} · ${row.active.class_name} · LVL ${row.active.current_level}`
                : 'No active character'}
            </small>
          </div>
          <div className="ding-crew-numbers">
            <b>{row.dings}<small>DINGS</small></b>
            <b>{row.awards}<small>AWARDS</small></b>
            {row.user.id !== viewerId && (
              <span className={row.dings >= viewerDings ? 'ahead' : 'behind'}>
                {row.dings === viewerDings ? 'TIED' : row.dings > viewerDings ? `+${row.dings - viewerDings}` : `-${viewerDings - row.dings}`}
              </span>
            )}
          </div>
        </article>
      ))}
      {!rows.length && <div className="ding-empty mf-frame"><UsersRound /> Nobody else has emerged from the basement.</div>}
    </div>
  );
}

export function CrewToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onClose, 5200);
    return () => clearTimeout(timer);
  }, [toast, onClose]);
  if (!toast) return null;
  const Icon = toast.kind === 'achievement' ? Trophy : toast.kind === 'ding' ? Swords : Shield;
  return createPortal(
    <div className="ding-crew-toast-anchor">
      <motion.div
        className="ding-crew-toast mf-frame"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8 }}
        role="status"
        aria-live="polite"
      >
        <Icon />
        <div><span>{toast.kind === 'achievement' ? 'CREW ACHIEVEMENT' : 'CREW DING'}</span><b>{toast.title}</b><small>{toast.body}</small></div>
        <button type="button" onClick={onClose} aria-label="Dismiss activity notification"><X /></button>
      </motion.div>
    </div>,
    document.body
  );
}
