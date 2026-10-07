// DING player progression, trophy, crew and realtime social surfaces.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Bell,
  Check,
  KeyRound,
  LogOut,
  RotateCw,
  Save,
  Shield,
  Swords,
  Trash2,
  Trophy,
  UsersRound,
  X,
} from 'lucide-react';
import { BadgeMedal } from './BadgeToast.jsx';
import { backend } from './backend.js';
import { dingAchievements } from './dingAchievements.js';
import { achievementXpForUser, parseShowcase, rankForUser, serializeShowcase } from './dingProgression.js';
import { hapticsEnabled, setHapticsEnabled } from './haptics.js';
import {
  enablePushNotifications,
  getNotificationPermission,
  PUSH_REASON_MESSAGE,
  rotatePushEndpoint,
} from './notifications.js';

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

function PushControl() {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(() => ({
    permission: getNotificationPermission(),
    message: '',
    ok: getNotificationPermission() === 'granted',
  }));

  async function arm(interactive = true) {
    setBusy(true);
    try {
      const result = await enablePushNotifications({
        backend,
        workerPath: `${import.meta.env.BASE_URL}sw.js`,
        interactive,
      });
      setState({
        permission: result.permission || getNotificationPermission(),
        ok: Boolean(result.ok),
        message: result.message || PUSH_REASON_MESSAGE[result.reason] || result.reason || '',
      });
    } catch (error) {
      setState({ permission: getNotificationPermission(), ok: false, message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    setBusy(true);
    try {
      const result = await rotatePushEndpoint({
        backend,
        workerPath: `${import.meta.env.BASE_URL}sw.js`,
      });
      setState({
        permission: getNotificationPermission(),
        ok: Boolean(result.ok),
        message: result.ok
          ? 'Push endpoint rotated and re-registered.'
          : PUSH_REASON_MESSAGE[result.reason] || result.reason || 'Rotation failed.',
      });
    } catch (error) {
      setState({ permission: getNotificationPermission(), ok: false, message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ding-push-control">
      <div>
        <Bell />
        <span>
          <b>Crew push alerts</b>
          <small>
            {state.message ||
              (state.permission === 'granted'
                ? 'Browser permission granted. Arm this device with the DING backend.'
                : 'Get Dings and achievement alerts when the app is closed.')}
          </small>
        </span>
      </div>
      <div className="ding-push-actions">
        <button className="mf-button" type="button" disabled={busy} onClick={() => arm(true)}>
          <Bell /> {busy ? 'WORKING…' : state.ok ? 'RE-ARM DEVICE' : 'ENABLE ALERTS'}
        </button>
        {state.permission === 'granted' && (
          <button className="mf-button ghost" type="button" disabled={busy} onClick={rotate}>
            <RotateCw /> ROTATE ENDPOINT
          </button>
        )}
      </div>
    </div>
  );
}

export function ProfilePane({ user, characters, events, achievements, onUserUpdated, onLoggedOut, onDeleted }) {
  const ownCharacters = characters.filter(character => character.user_id === user.id && !character.is_archived);
  const ownEvents = events.filter(event => event.user_id === user.id);
  const ownedAwards = achievements.filter(row => row.user_id === user.id);
  const unlocked = new Set(ownedAwards.map(row => row.achievement_type));
  const [tagline, setTagline] = useState(user.tagline || '');
  const [showcase, setShowcase] = useState(() => parseShowcase(user.showcase));
  const [saving, setSaving] = useState(false);
  const [haptics, setHaptics] = useState(() => hapticsEnabled());
  const [password, setPassword] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountStatus, setAccountStatus] = useState('');
  const pwaInstall = usePwaInstall();

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
    const next = showcase.includes(id) ? showcase.filter(item => item !== id) : [...showcase, id].slice(-3);
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
        <div className="ding-avatar" aria-hidden="true">
          {initials(user.username)}
        </div>
        <div>
          <span className="mf-kicker">OPERATOR</span>
          <h2>{user.username}</h2>
          <p>{user.tagline || 'No bio. Too busy grinding.'}</p>
        </div>
      </section>

      <RankBlock achievements={achievements} userId={user.id} />

      <div className="ding-stat-grid">
        <div className="stat mf-frame">
          <span>DINGS</span>
          <strong>{ownEvents.length}</strong>
          <small>tracked levels</small>
        </div>
        <div className="stat mf-frame">
          <span>CHARACTERS</span>
          <strong>{ownCharacters.length}</strong>
          <small>active alts</small>
        </div>
        <div className="stat mf-frame">
          <span>AWARDS</span>
          <strong>{ownedAwards.length}</strong>
          <small>questionable honors</small>
        </div>
        <div className="stat mf-frame">
          <span>APP XP</span>
          <strong>{achievementXpForUser(achievements, user.id)}</strong>
          <small>separate from WoW XP</small>
        </div>
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
        <PushControl />
        <div className="ding-install-control">
          <div>
            <Download />
            <span>
              <b>Install DING</b>
              <small>
                {pwaInstall.kind === 'installed'
                  ? 'Running as an installed app.'
                  : pwaInstall.kind === 'ios-manual'
                    ? 'On iPhone/iPad: Safari Share → Add to Home Screen. Installed mode is required for iOS Web Push.'
                    : pwaInstall.kind === 'prompt'
                      ? 'Install the standalone PWA for faster access and more reliable background notifications.'
                      : 'This browser is not offering an install prompt. You can keep using the web app normally.'}
              </small>
            </span>
          </div>
          {pwaInstall.kind === 'prompt' && (
            <button
              className="mf-button"
              type="button"
              onClick={async () => {
                const result = await pwaInstall.install();
                setAccountStatus(result.ok ? 'DING installed.' : 'Install prompt dismissed.');
              }}
            >
              <Download /> INSTALL APP
            </button>
          )}
        </div>
      </section>

      <section className="ding-panel mf-frame">
        <h2>Showcase</h2>
        <p className="ding-muted">Pick up to three earned awards for your profile.</p>
        <div className="ding-award-grid compact">
          {dingAchievements
            .filter(item => unlocked.has(item.id))
            .map(item => {
              const selected = showcase.includes(item.id);
              return (
                <button
                  type="button"
                  className={'ding-award-card' + (selected ? ' selected' : '')}
                  key={item.id}
                  onClick={() => toggleShowcase(item.id)}
                >
                  <BadgeMedal icon={item.micon || item.icon} accent={item.accent} tier={item.tier} />
                  <span>
                    <b>{item.name}</b>
                    <small>
                      {item.tier} · {item.points} XP
                    </small>
                  </span>
                  {selected && <Check />}
                </button>
              );
            })}
          {!ownedAwards.length && <div className="ding-empty">Earn something first. Revolutionary concept.</div>}
        </div>
      </section>
      <section className="ding-panel mf-frame ding-account-panel">
        <h2>Account</h2>
        <p className="ding-muted">
          Username is your immutable crew identity. Password and account lifecycle stay under your control.
        </p>
        <label className="ding-admin-field">
          NEW PASSWORD
          <input
            type="password"
            minLength={6}
            maxLength={200}
            autoComplete="new-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </label>
        <div className="ding-account-row">
          <button
            className="mf-button"
            type="button"
            disabled={accountBusy || password.length < 6}
            onClick={async () => {
              setAccountBusy(true);
              setAccountStatus('');
              try {
                await backend.updateOwnPassword(password);
                setPassword('');
                setAccountStatus('Password updated.');
              } catch (error) {
                setAccountStatus(error.message);
              } finally {
                setAccountBusy(false);
              }
            }}
          >
            <KeyRound /> CHANGE PASSWORD
          </button>
          <button
            className="mf-button ghost"
            type="button"
            disabled={accountBusy}
            onClick={async () => {
              setAccountBusy(true);
              try {
                await backend.logout();
                onLoggedOut?.();
              } finally {
                setAccountBusy(false);
              }
            }}
          >
            <LogOut /> LOG OUT
          </button>
        </div>
        {accountStatus && <div className="ding-muted">{accountStatus}</div>}
        <div className="ding-danger-zone">
          <strong>DELETE ACCOUNT</strong>
          <small>
            Permanent. Characters, Dings, achievements, push registrations and auth identity are removed by cascade.
          </small>
          <label className="ding-admin-field">
            TYPE {user.username} TO CONFIRM
            <input value={deletePhrase} onChange={event => setDeletePhrase(event.target.value)} />
          </label>
          <button
            className="mf-button danger"
            type="button"
            disabled={accountBusy || deletePhrase !== user.username}
            onClick={async () => {
              if (!window.confirm('Delete this DING account permanently? This cannot be undone.')) return;
              setAccountBusy(true);
              setAccountStatus('');
              try {
                await backend.deleteAccount();
                onDeleted?.();
              } catch (error) {
                setAccountStatus(error.message);
                setAccountBusy(false);
              }
            }}
          >
            <Trash2 /> DELETE ACCOUNT PERMANENTLY
          </button>
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
        <div>
          <strong>
            {unlocked.size} / {dingAchievements.length}
          </strong>
          <span>awards unlocked</span>
        </div>
        <div>
          <strong>{xp}</strong>
          <span>app XP</span>
        </div>
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
                <small>
                  {item.points} XP · {earned ? 'UNLOCKED' : 'LOCKED'}
                </small>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function CrewProfileDetail({ row, viewerId, characters, events, achievements, onClose }) {
  const viewerAwards = new Set(
    achievements.filter(item => item.user_id === viewerId).map(item => item.achievement_type)
  );
  const targetRows = achievements
    .filter(item => item.user_id === row.user.id)
    .sort((a, b) => new Date(b.unlocked_at || 0) - new Date(a.unlocked_at || 0));
  const targetAwards = new Set(targetRows.map(item => item.achievement_type));
  const shared = [...targetAwards].filter(id => viewerAwards.has(id)).length;
  const theirsOnly = [...targetAwards].filter(id => !viewerAwards.has(id)).length;
  const yoursOnly = [...viewerAwards].filter(id => !targetAwards.has(id)).length;
  const showcase = parseShowcase(row.user.showcase).map(dingAchievementById).filter(Boolean);
  const ownedCharacters = characters.filter(character => character.user_id === row.user.id && !character.is_archived);
  const recent = events
    .filter(event => event.user_id === row.user.id)
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 6);
  const byId = new Map(characters.map(character => [character.id, character]));

  return (
    <section className="ding-crew-profile mf-frame">
      <button className="ding-crew-profile-close" type="button" onClick={onClose} aria-label="Close crew profile">
        <X />
      </button>
      <div className="ding-profile-hero">
        <div className="ding-avatar" aria-hidden="true">
          {initials(row.user.username)}
        </div>
        <div>
          <span className="mf-kicker">{row.rank.name}</span>
          <h2>{row.user.username}</h2>
          <p>{row.user.tagline || 'No public excuse provided.'}</p>
        </div>
      </div>
      <div className="ding-stat-grid">
        <div className="stat">
          <span>DINGS</span>
          <strong>{row.dings}</strong>
          <small>tracked levels</small>
        </div>
        <div className="stat">
          <span>AWARDS</span>
          <strong>{row.awards}</strong>
          <small>{row.rank.xp} app XP</small>
        </div>
        <div className="stat">
          <span>SHARED</span>
          <strong>{shared}</strong>
          <small>same bad decisions</small>
        </div>
        <div className="stat">
          <span>DIFFERENCE</span>
          <strong>
            {theirsOnly}/{yoursOnly}
          </strong>
          <small>theirs / yours unique</small>
        </div>
      </div>
      <div className="ding-crew-profile-grid">
        <div>
          <h3>Characters</h3>
          {ownedCharacters.map(character => (
            <div className="ding-mini-row" key={character.id}>
              <span>
                <b>{character.name}</b>
                <small>
                  {character.class_name}
                  {character.spec ? ' · ' + character.spec : ''} · {character.realm}
                </small>
              </span>
              <strong>LVL {character.current_level}</strong>
            </div>
          ))}
          {!ownedCharacters.length && <div className="ding-muted">No active characters.</div>}
        </div>
        <div>
          <h3>Showcase</h3>
          <div className="ding-mini-awards">
            {showcase.map(item => (
              <div key={item.id}>
                <BadgeMedal icon={item.micon || item.icon} accent={item.accent} tier={item.tier} />
                <span>
                  <b>{item.name}</b>
                  <small>{item.tier}</small>
                </span>
              </div>
            ))}
            {!showcase.length && <div className="ding-muted">Nothing pinned yet.</div>}
          </div>
        </div>
      </div>
      <div className="ding-crew-profile-grid">
        <div>
          <h3>Recent Dings</h3>
          {recent.map(event => {
            const character = byId.get(event.character_id);
            return (
              <div className="ding-mini-row" key={event.id}>
                <span>
                  <b>
                    {character?.name || 'Character'} → {event.to_level}
                  </b>
                  <small>
                    {event.activity_type || 'other'}
                    {event.zone ? ' · ' + event.zone : ''}
                  </small>
                </span>
                <small>{event.timestamp ? new Date(event.timestamp).toLocaleDateString() : ''}</small>
              </div>
            );
          })}
          {!recent.length && <div className="ding-muted">No Dings recorded.</div>}
        </div>
        <div>
          <h3>Recent Awards</h3>
          {targetRows.slice(0, 6).map(rowItem => {
            const item = dingAchievementById(rowItem.achievement_type);
            return item ? (
              <div className="ding-mini-row" key={rowItem.id}>
                <span>
                  <b>{item.name}</b>
                  <small>
                    {item.tier} · {item.points} XP
                  </small>
                </span>
              </div>
            ) : null;
          })}
          {!targetRows.length && <div className="ding-muted">No awards yet.</div>}
        </div>
      </div>
    </section>
  );
}

export function CrewPane({ users, characters, events, achievements, viewerId }) {
  const viewerDings = events.filter(event => event.user_id === viewerId).length;
  const [selectedId, setSelectedId] = useState(null);
  const rows = useMemo(
    () =>
      users
        .map(user => {
          const active =
            characters.find(character => character.id === user.active_character_id) ||
            characters.find(character => character.user_id === user.id && !character.is_archived) ||
            null;
          const dings = events.filter(event => event.user_id === user.id).length;
          const awards = achievements.filter(item => item.user_id === user.id).length;
          return { user, active, dings, awards, rank: rankForUser(achievements, user.id) };
        })
        .sort((a, b) => b.dings - a.dings || a.user.username.localeCompare(b.user.username)),
    [users, characters, events, achievements]
  );
  const selected = rows.find(row => row.user.id === selectedId) || null;

  return (
    <div className="ding-crew-list">
      {selected && (
        <CrewProfileDetail
          row={selected}
          viewerId={viewerId}
          characters={characters}
          events={events}
          achievements={achievements}
          onClose={() => setSelectedId(null)}
        />
      )}
      {rows.map((row, index) => (
        <article className={'ding-crew-card mf-frame' + (row.user.id === viewerId ? ' self' : '')} key={row.user.id}>
          <button className="ding-crew-open" type="button" onClick={() => setSelectedId(row.user.id)}>
            <div className="ding-avatar small" aria-hidden="true">
              {initials(row.user.username)}
            </div>
            <div className="ding-crew-copy">
              <span className="mf-kicker">
                #{index + 1} · {row.rank.name}
              </span>
              <h3>{row.user.username}</h3>
              <p>{row.user.tagline || 'No public excuse provided.'}</p>
              <small>
                {row.active
                  ? `${row.active.name} · ${row.active.class_name} · LVL ${row.active.current_level}`
                  : 'No active character'}
              </small>
            </div>
            <div className="ding-crew-numbers">
              <b>
                {row.dings}
                <small>DINGS</small>
              </b>
              <b>
                {row.awards}
                <small>AWARDS</small>
              </b>
              {row.user.id !== viewerId && (
                <span className={row.dings >= viewerDings ? 'ahead' : 'behind'}>
                  {row.dings === viewerDings
                    ? 'TIED'
                    : row.dings > viewerDings
                      ? `+${row.dings - viewerDings}`
                      : `-${viewerDings - row.dings}`}
                </span>
              )}
            </div>
          </button>
        </article>
      ))}
      {!rows.length && (
        <div className="ding-empty mf-frame">
          <UsersRound /> Nobody else has emerged from the basement.
        </div>
      )}
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
        <div>
          <span>{toast.kind === 'achievement' ? 'CREW ACHIEVEMENT' : 'CREW DING'}</span>
          <b>{toast.title}</b>
          <small>{toast.body}</small>
        </div>
        <button type="button" onClick={onClose} aria-label="Dismiss activity notification">
          <X />
        </button>
      </motion.div>
    </div>,
    document.body
  );
}
