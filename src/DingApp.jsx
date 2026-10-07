import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Bell, LogOut, Plus, Swords, Trophy, UsersRound, Wrench } from 'lucide-react';
import { backend } from './backend.js';
import { BadgeToast } from './BadgeToast.jsx';
import { dingAchievementById } from './dingAchievements.js';
import { CrewPane, CrewToast, ProfilePane, TrophyPane } from './DingSocial.jsx';
import { DingAnalyticsView } from './DingAnalyticsView.jsx';
import { DingAdmin } from './DingAdmin.jsx';
import { useAchievementQueue } from './useAchievementQueue.js';
import { GAME_CONFIG, WOW_CLASSES, mergeGameConfig } from './gameConfig.js';
import { createDingRequest, isMaxLevel, MAX_DEATHS_PER_LEVEL, MAX_SESSION_MINUTES, validateCharacterDraft } from './dingDomain.js';
import {
  checkPendingDing,
  clearPendingDing,
  readPendingDing,
  retryPendingDing,
  savePendingDing,
} from './dingPending.js';
import { Overlay } from './Overlay.jsx';
import { haptic } from './haptics.js';
import { CURRENT_BUILD_ID, checkForUpdate, shouldCheckNow } from './appVersion.js';
import { enablePushNotifications, getNotificationPermission } from './notifications.js';
import './dingShell.css';

const asset = path => import.meta.env.BASE_URL + String(path).replace(/^\//, '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function within(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Request timed out')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function fmt(timestamp) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Unknown time';
}

function mergeRow(rows, row) {
  if (!row?.id) return rows;
  return [row, ...rows.filter(item => item.id !== row.id)];
}

function DingLogin({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', inviteCode: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await backend[mode](form);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ding-login ding-root">
      <section className="ding-auth mf-frame">
        <img src={asset('ding-logo.svg')} alt="DING" />
        <p>Track levels. Judge your friends. Continue avoiding sunlight.</p>
        <form onSubmit={submit}>
          <label>
            Username
            <input
              value={form.username}
              onChange={event => setForm({ ...form, username: event.target.value })}
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })}
            />
          </label>
          {mode === 'signup' && (
            <label>
              Invite code
              <input value={form.inviteCode} onChange={event => setForm({ ...form, inviteCode: event.target.value })} />
            </label>
          )}
          <button className="mf-button" disabled={busy}>
            {busy ? 'CONNECTING…' : mode === 'login' ? 'ENTER BASEMENT' : 'CREATE DEGENERATE'}
          </button>
        </form>
        {error && <div className="error">{error}</div>}
        <button className="text-link" type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Need an account?' : 'Already have one?'}
        </button>
      </section>
    </main>
  );
}

function FirstRunIntro({ config }) {
  return (
    <section className="ding-first-run">
      <div className="ding-first-run-copy">
        <span className="mf-kicker">FIRST LOGIN</span>
        <h1>Pick a character. Make the number bigger.</h1>
        <p>
          DING tracks one-level progression events, crew activity, achievements and leveling pace. Manual characters are
          fully supported; no Battle.net account is required.
        </p>
      </div>
      <div className="ding-first-run-steps">
        <div className="mf-frame">
          <b>1</b>
          <span>
            <strong>ADD A CHARACTER</strong>
            <small>Name, realm, class and current level.</small>
          </span>
        </div>
        <div className="mf-frame">
          <b>2</b>
          <span>
            <strong>PRESS DING</strong>
            <small>Each press advances exactly one server-validated level.</small>
          </span>
        </div>
        <div className="mf-frame">
          <b>3</b>
          <span>
            <strong>GET JUDGED</strong>
            <small>Realtime crew feed, app XP, awards and analytics.</small>
          </span>
        </div>
      </div>
      <small className="ding-muted">
        Current configured cap: {config.levelCap} · {config.expansionName}
      </small>
    </section>
  );
}

function CharacterForm({ config, initial = null, onCreated, onSaved, onArchived, onCancel }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    realm: initial?.realm || '',
    region: initial?.region || 'US',
    className: initial?.class_name || 'Warrior',
    currentLevel: Number(initial?.current_level) || Math.min(80, config.levelCap),
    faction: initial?.faction || 'Alliance',
    spec: initial?.spec || '',
    race: initial?.race || '',
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const result = validateCharacterDraft(form, config);
    setErrors(result.errors);
    if (!result.ok) return;

    setBusy(true);
    setServerError('');
    try {
      if (editing) {
        const character = await backend.updateCharacter(initial.id, result.value);
        await onSaved?.(character);
      } else {
        const character = await backend.createCharacter(result.value);
        await onCreated?.(character);
      }
    } catch (err) {
      setServerError(err.message);
      setBusy(false);
    }
  }

  async function archive() {
    if (!editing || !window.confirm(`Archive ${initial.name}? Level history stays intact.`)) return;
    setBusy(true);
    setServerError('');
    try {
      const character = await backend.updateCharacter(initial.id, { is_archived: true });
      await onArchived?.(character);
    } catch (err) {
      setServerError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="ding-character-form mf-frame" onSubmit={submit}>
      <h2>{editing ? 'EDIT CHARACTER' : 'ADD CHARACTER'}</h2>
      <p>
        {editing
          ? 'Metadata can change. Level progression stays server-authoritative because we are not animals.'
          : 'Pick the poor soul whose XP bar is about to become your personality.'}
      </p>
      <div className="ding-form-grid">
        <label>
          Character
          <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
          {errors.name && <small>{errors.name}</small>}
        </label>
        <label>
          Realm
          <input value={form.realm} onChange={event => setForm({ ...form, realm: event.target.value })} />
          {errors.realm && <small>{errors.realm}</small>}
        </label>
        <label>
          Region
          <select value={form.region} onChange={event => setForm({ ...form, region: event.target.value })}>
            {config.regions.map(region => (
              <option key={region}>{region}</option>
            ))}
          </select>
        </label>
        <label>
          Class
          <select value={form.className} onChange={event => setForm({ ...form, className: event.target.value })}>
            {WOW_CLASSES.map(className => (
              <option key={className}>{className}</option>
            ))}
          </select>
        </label>
        <label>
          Current level
          <input
            type="number"
            min={config.minLevel}
            max={config.levelCap}
            value={form.currentLevel}
            disabled={editing}
            onChange={event => setForm({ ...form, currentLevel: Number(event.target.value) })}
          />
          {errors.current_level && <small>{errors.current_level}</small>}
        </label>
        <label>
          Faction
          <select value={form.faction} onChange={event => setForm({ ...form, faction: event.target.value })}>
            {config.factions.map(faction => (
              <option key={faction}>{faction}</option>
            ))}
          </select>
        </label>
        <label>
          Spec
          <input
            maxLength={40}
            value={form.spec}
            placeholder="Optional"
            onChange={event => setForm({ ...form, spec: event.target.value })}
          />
        </label>
        <label>
          Race
          <input
            maxLength={40}
            value={form.race}
            placeholder="Optional"
            onChange={event => setForm({ ...form, race: event.target.value })}
          />
        </label>
      </div>
      {serverError && <div className="error">{serverError}</div>}
      <div className="ding-form-actions split">
        <div>
          {editing && (
            <button className="mf-button danger" type="button" onClick={archive} disabled={busy}>
              ARCHIVE
            </button>
          )}
        </div>
        <div>
          {onCancel && (
            <button className="mf-button ghost" type="button" onClick={onCancel} disabled={busy}>
              CANCEL
            </button>
          )}
          <button className="mf-button" disabled={busy}>
            {busy ? 'SAVING…' : editing ? 'SAVE CHARACTER' : 'ADD CHARACTER'}
          </button>
        </div>
      </div>
    </form>
  );
}

function DingBurst({ id }) {
  return (
    <motion.div
      key={id}
      className="ding-burst"
      initial={{ opacity: 1, scale: 0.4 }}
      animate={{ opacity: 0, scale: 2.4 }}
      transition={{ duration: 1.15, ease: 'easeOut' }}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
    </motion.div>
  );
}

function DingButton({ phase, character, config, onDing }) {
  const maxed = character ? isMaxLevel(character, config) : false;
  const label = maxed
    ? 'MAX LEVEL'
    : phase === 'charge'
      ? 'SWEATING…'
      : phase === 'saving'
        ? 'LOGGING…'
        : phase === 'pending'
          ? 'PENDING'
          : 'DING';

  return (
    <motion.button
      className="ding-button"
      disabled={!character || maxed || phase !== 'idle'}
      onClick={onDing}
      animate={phase === 'charge' ? { scale: [1, 1.04, 0.98, 1.06, 1] } : {}}
      transition={{ duration: 0.32, repeat: phase === 'charge' ? Infinity : 0 }}
    >
      <span>{label}</span>
      {character && (
        <small>
          LVL {character.current_level} → {Math.min(character.current_level + 1, config.levelCap)}
        </small>
      )}
    </motion.button>
  );
}

function DingContextEditor({ value, onChange, config, disabled }) {
  return (
    <details className="ding-context mf-frame">
      <summary>
        LEVEL CONTEXT <span>optional · feeds analytics + achievements</span>
      </summary>
      <div className="ding-context-grid">
        <label>
          Activity
          <select
            value={value.activityType}
            disabled={disabled}
            onChange={event => onChange({ ...value, activityType: event.target.value })}
          >
            {config.activityTypes.map(activity => (
              <option key={activity.id} value={activity.id}>
                {activity.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zone
          <input
            maxLength={80}
            value={value.zone}
            disabled={disabled}
            placeholder="Optional zone"
            onChange={event => onChange({ ...value, zone: event.target.value })}
          />
        </label>
        <label>
          Minutes on level
          <input
            type="number"
            min="0"
            max={MAX_SESSION_MINUTES}
            inputMode="numeric"
            value={value.sessionMinutes}
            disabled={disabled}
            placeholder="—"
            onChange={event => onChange({ ...value, sessionMinutes: event.target.value })}
          />
        </label>
        <label>
          Deaths
          <input
            type="number"
            min="0"
            max={MAX_DEATHS_PER_LEVEL}
            inputMode="numeric"
            value={value.deaths}
            disabled={disabled}
            placeholder="—"
            onChange={event => onChange({ ...value, deaths: event.target.value })}
          />
        </label>
      </div>
    </details>
  );
}

function EventCard({ event, character, onOpen }) {
  return (
    <button className="ding-event-card mf-frame" type="button" onClick={() => onOpen(event)}>
      <div className="ding-event-level">{event.to_level}</div>
      <div>
        <strong>
          {event.username || 'Unknown'} · {character?.name || 'Unknown character'}
        </strong>
        <span>
          {character?.class_name || 'Unknown class'} · {fmt(event.timestamp)}
        </span>
        <p>{event.note || String(event.from_level) + ' → ' + String(event.to_level) + '. Grass remains untouched.'}</p>
      </div>
    </button>
  );
}

function EventDetail({ event, character, viewerId, onClose, onUpdated }) {
  const [note, setNote] = useState(event.note || '');
  const [busy, setBusy] = useState(false);
  const own = event.user_id === viewerId;

  return (
    <div className="ding-detail-back" onClick={onClose}>
      <section className="ding-detail mf-frame" onClick={click => click.stopPropagation()}>
        <button className="detail-close" type="button" onClick={onClose} aria-label="Close Ding detail">
          ×
        </button>
        <span className="mf-kicker">LEVEL EVENT</span>
        <h2>
          {character?.name || 'Character'} dinged {event.to_level}
        </h2>
        <p>
          {fmt(event.timestamp)} · {event.time_bucket || 'Unknown window'}
        </p>
        <div className="ding-detail-grid">
          <div>
            <small>PLAYER</small>
            <strong>{event.username || 'Unknown'}</strong>
          </div>
          <div>
            <small>CLASS</small>
            <strong>{character?.class_name || '—'}</strong>
          </div>
          <div>
            <small>ZONE</small>
            <strong>{event.zone || '—'}</strong>
          </div>
          <div>
            <small>ACTIVITY</small>
            <strong>{event.activity_type || '—'}</strong>
          </div>
          <div>
            <small>DEATHS</small>
            <strong>{event.deaths ?? '—'}</strong>
          </div>
          <div>
            <small>SESSION</small>
            <strong>{event.session_minutes != null ? String(event.session_minutes) + 'm' : '—'}</strong>
          </div>
        </div>
        {own ? (
          <label className="ding-note">
            OPTIONAL EXCUSE
            <textarea
              maxLength={240}
              value={note}
              onChange={change => setNote(change.target.value)}
              placeholder="Why did this level take so long?"
            />
            <button
              type="button"
              className="mf-button"
              disabled={busy || note === (event.note || '')}
              onClick={async () => {
                setBusy(true);
                try {
                  const updated = await backend.patchLevelEventNote(event.id, note);
                  onUpdated(updated);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'SAVING…' : 'SAVE NOTE'}
            </button>
          </label>
        ) : (
          <blockquote>{event.note || 'No excuse was submitted.'}</blockquote>
        )}
      </section>
    </div>
  );
}

function CharacterPane({ user, characters, config, onSelected, onCreated, onUpdated, onArchived }) {
  const own = characters.filter(character => character.user_id === user.id && !character.is_archived);
  const [adding, setAdding] = useState(own.length === 0);
  const [editing, setEditing] = useState(null);

  if (adding) {
    return (
      <CharacterForm
        config={config}
        onCreated={async character => {
          await onCreated(character);
          setAdding(false);
        }}
        onCancel={own.length ? () => setAdding(false) : null}
      />
    );
  }

  if (editing) {
    return (
      <CharacterForm
        config={config}
        initial={editing}
        onSaved={async character => {
          await onUpdated(character);
          setEditing(null);
        }}
        onArchived={async character => {
          await onArchived(character);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="ding-character-list">
      <button className="mf-button" type="button" onClick={() => setAdding(true)}>
        <Plus /> ADD CHARACTER
      </button>
      {own.map(character => (
        <article
          className={'ding-character-row mf-frame' + (user.active_character_id === character.id ? ' active' : '')}
          key={character.id}
        >
          <button className="ding-character-select" type="button" onClick={() => onSelected(character)}>
            <span>
              <strong>{character.name}</strong>
              <small>
                {character.class_name}
                {character.spec ? ` · ${character.spec}` : ''} · {character.realm} · {character.region}
              </small>
            </span>
            <b>LVL {character.current_level}</b>
          </button>
          <button className="ding-character-manage" type="button" onClick={() => setEditing(character)}>
            MANAGE
          </button>
        </article>
      ))}
    </div>
  );
}

function DingDashboard({ user, setUser }) {
  const [users, setUsers] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [events, setEvents] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [config, setConfig] = useState(GAME_CONFIG);
  const [phase, setPhase] = useState('idle');
  const [pending, setPending] = useState(() => readPendingDing(sessionStorage, user.id));
  const [selected, setSelected] = useState(null);
  const [overlay, setOverlay] = useState(() => {
    if (import.meta.env.VITE_DEMO_MODE !== 'true') return null;
    const requested = new URLSearchParams(window.location.search).get('panel');
    return ['analytics', 'profile', 'crew', 'trophy', 'feed', 'characters', 'ops'].includes(requested)
      ? requested
      : null;
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [burstId, setBurstId] = useState(null);
  const [crewToast, setCrewToast] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dingContext, setDingContext] = useState({
    activityType: 'other',
    zone: '',
    sessionMinutes: '',
    deaths: '',
  });
  const dismissCrewToast = useCallback(() => setCrewToast(null), []);
  const { current: badgeToast, enqueue: enqueueBadge } = useAchievementQueue(5200);

  useEffect(() => {
    let live = true;
    Promise.all([backend.dingDashboard(), backend.gameConfig().catch(() => null)])
      .then(([snapshot, remoteConfig]) => {
        if (!live) return;
        setUsers(snapshot.users);
        setCharacters(snapshot.characters);
        setEvents(snapshot.levelEvents);
        setAchievements(snapshot.achievements || []);
        const freshUser = snapshot.users.find(profile => profile.id === user.id);
        if (freshUser) setUser(freshUser);
        if (remoteConfig) setConfig(mergeGameConfig(remoteConfig));
      })
      .catch(error => {
        if (live) setStatus(error.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    const unsubscribe = backend.subscribeDing({
      onLevelEvent: (event, action) => {
        setEvents(previous =>
          action === 'deleted' ? previous.filter(row => row.id !== event.id) : mergeRow(previous, event)
        );
        if (action === 'created' && event.user_id !== user.id) {
          setCrewToast({
            id: `ding:${event.id}`,
            kind: 'ding',
            title: `${event.username || 'Someone'} dinged ${event.to_level}`,
            body: event.note || 'Another level secured. Grass exposure remains unconfirmed.',
          });
        }
      },
      onCharacter: (character, action) => {
        setCharacters(previous =>
          action === 'deleted' ? previous.filter(row => row.id !== character.id) : mergeRow(previous, character)
        );
      },
      onProfile: (profile, action) => {
        setUsers(previous =>
          action === 'deleted' ? previous.filter(row => row.id !== profile.id) : mergeRow(previous, profile)
        );
        if (profile.id === user.id && action !== 'deleted') setUser(profile);
      },
      onAchievement: (achievement, action) => {
        setAchievements(previous =>
          action === 'deleted' ? previous.filter(row => row.id !== achievement.id) : mergeRow(previous, achievement)
        );
        if (action === 'created' && achievement.user_id !== user.id) {
          const item = dingAchievementById(achievement.achievement_type);
          if (item) {
            setCrewToast({
              id: `achievement:${achievement.id}`,
              kind: 'achievement',
              title: `${achievement.username || 'Someone'} unlocked ${item.name}`,
              body: `${item.tier.toUpperCase()} · ${item.points} XP`,
            });
          }
        }
      },
    });

    return () => {
      live = false;
      unsubscribe();
    };
  }, [setUser, user.id]);

  useEffect(() => {
    if (!burstId) return undefined;
    const timer = setTimeout(() => setBurstId(null), 1300);
    return () => clearTimeout(timer);
  }, [burstId]);

  useEffect(() => {
    const serviceWorker = navigator.serviceWorker;
    if (!serviceWorker?.addEventListener) return undefined;

    const onWorkerMessage = event => {
      const message = event.data || {};
      if (message.type === 'ding-push-resubscribed' && message.subscription) {
        void backend
          .registerPushSubscription(message.subscription, { userAgent: navigator.userAgent || null })
          .catch(error => console.warn('[push resubscribe]', error));
        return;
      }

      if (message.type === 'ding-notification-click') {
        setOverlay('feed');
        return;
      }

      if (message.type !== 'ding-push') return;
      const payload = message.payload || {};
      const kind = payload?.data?.kind;
      const sourceId = payload?.data?.sourceId;
      if (kind === 'ding' && sourceId) {
        void backend
          .levelEventById(sourceId)
          .then(row => {
            if (row) setEvents(previous => mergeRow(previous, row));
          })
          .catch(error => console.warn('[push refresh ding]', error));
      } else if (kind === 'achievement') {
        void backend
          .reconcileAchievements()
          .then(result => setAchievements(result.achievements))
          .catch(error => console.warn('[push refresh achievements]', error));
      }
    };

    serviceWorker.addEventListener('message', onWorkerMessage);
    return () => serviceWorker.removeEventListener('message', onWorkerMessage);
  }, []);

  useEffect(() => {
    if (getNotificationPermission() !== 'granted') return;
    void enablePushNotifications({
      backend,
      workerPath: asset('sw.js'),
      interactive: false,
    }).catch(error => {
      console.warn('[push rearm]', error);
    });
  }, [user.id]);

  useEffect(() => {
    let live = true;
    let lastCheckedAt = null;
    let timer = null;

    const check = async () => {
      const now = Date.now();
      if (!shouldCheckNow(lastCheckedAt, now)) return;
      lastCheckedAt = now;
      const stale = await checkForUpdate({
        url: asset('version.json'),
        currentBuildId: CURRENT_BUILD_ID,
      });
      if (live && stale) setUpdateAvailable(true);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };

    void check();
    timer = setInterval(check, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', check);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', check);
    };
  }, [user.id]);

  const ownCharacters = useMemo(
    () => characters.filter(character => character.user_id === user.id && !character.is_archived),
    [characters, user.id]
  );
  const activeCharacter =
    ownCharacters.find(character => character.id === user.active_character_id) || ownCharacters[0] || null;

  async function reconcileLocalAchievements() {
    try {
      const result = await backend.reconcileAchievements();
      setAchievements(result.achievements);
      const freshItems = result.newlyEarned.map(dingAchievementById).filter(Boolean);
      if (freshItems.length) enqueueBadge(freshItems);

      const announceable = [...freshItems].sort((a, b) => (b.points || 0) - (a.points || 0))[0];
      if (!announceable) return;
      const row = result.achievements.find(
        achievement => achievement.user_id === user.id && achievement.achievement_type === announceable.id
      );
      if (row) {
        void backend.notifyEvent('achievement', row.id).catch(error => {
          console.warn('[achievement notify]', error);
        });
      }
    } catch (error) {
      console.warn('[achievement reconcile]', error);
    }
  }

  function acceptCommitted(event) {
    if (!event) return;
    setEvents(previous => mergeRow(previous, event));
    setCharacters(previous =>
      previous.map(character =>
        character.id === event.character_id ? { ...character, current_level: event.to_level } : character
      )
    );
    clearPendingDing(sessionStorage, user.id);
    setPending(null);
    setDingContext({ activityType: 'other', zone: '', sessionMinutes: '', deaths: '' });
    setSelected(event);
    setPhase('idle');
    setStatus('');
    setBurstId(event.id);
    haptic('ding');

    // The Ding is already durable at this point. Notification and achievement
    // failures are post-commit side effects and must never turn it into a
    // false failed-save state.
    void backend.notifyEvent('ding', event.id).catch(error => {
      console.warn('[ding notify]', error);
    });
    void reconcileLocalAchievements();
  }

  async function startDing() {
    if (!activeCharacter || pending || phase !== 'idle' || isMaxLevel(activeCharacter, config)) return;

    let request;
    try {
      request = createDingRequest({
        character: activeCharacter,
        eventId: crypto.randomUUID(),
        zone: dingContext.zone,
        activityType: dingContext.activityType,
        deaths: dingContext.deaths,
        sessionMinutes: dingContext.sessionMinutes,
        config,
      });
    } catch (error) {
      setStatus(error.message);
      return;
    }

    const pendingState = savePendingDing(sessionStorage, user.id, { request });
    setPending(pendingState);
    setPhase('charge');
    setStatus('');
    haptic('charge');
    await sleep(500);
    setPhase('saving');

    let committed;
    try {
      committed = await within(backend.recordDing(request), 10000);
    } catch (error) {
      try {
        committed = await within(backend.levelEventById(request.p_event_id, user.id), 3000);
      } catch {
        committed = null;
      }
      if (!committed) {
        setPhase('idle');
        setStatus(error.message + '. Confirmation is pending; check status before doing anything else.');
        return;
      }
    }
    acceptCommitted(committed);
  }

  async function checkPending() {
    if (!pending) return;
    setStatus('Checking the ledger…');
    try {
      const result = await checkPendingDing(pending, (id, actorId) => backend.levelEventById(id, actorId));
      if (result.status === 'committed') acceptCommitted(result.event);
      else setStatus('Still unconfirmed. Retry only reuses the exact same event ID.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function retryPending() {
    if (!pending) return;
    setPhase('saving');
    try {
      const committed = await retryPendingDing(pending, request => backend.recordDing(request));
      acceptCommitted(committed);
    } catch (error) {
      setPhase('idle');
      setStatus(error.message);
    }
  }

  async function selectCharacter(character) {
    try {
      const updated = await backend.setActiveCharacter(character.id);
      setUser(updated);
      setOverlay(null);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function createCharacter(character) {
    const updated = await backend.setActiveCharacter(character.id);
    setCharacters(previous => mergeRow(previous, character));
    setUser(updated);
    void reconcileLocalAchievements();
  }

  async function updateCharacter(character) {
    setCharacters(previous => mergeRow(previous, character));
    void reconcileLocalAchievements();
  }

  async function archiveCharacter(character) {
    setCharacters(previous => mergeRow(previous, character));
    if (user.active_character_id === character.id) {
      const next = ownCharacters.find(row => row.id !== character.id) || null;
      const updated = await backend.setActiveCharacter(next?.id || null);
      setUser(updated);
    }
    void reconcileLocalAchievements();
  }

  if (loading) {
    return <main className="ding-root ding-loading">OPENING THE BASEMENT DOOR…</main>;
  }

  const characterById = new Map(characters.map(character => [character.id, character]));

  return (
    <main className={'ding-root' + (phase === 'charge' ? ' ding-charging' : '')}>
      <div className="ding-grid-bg" />
      <header className="ding-topbar">
        <button className="ding-player-chip" type="button" onClick={() => setOverlay('profile')}>
          <UsersRound />
          <span>
            <b>{user.username}</b>
            <small>
              {activeCharacter
                ? activeCharacter.name + ' · LVL ' + String(activeCharacter.current_level)
                : 'No character'}
            </small>
          </span>
        </button>
        <img className="ding-brand" src={asset('ding-logo.svg')} alt="DING" />
        <div className="ding-actions">
          <button type="button" onClick={() => setOverlay('feed')} aria-label="Activity feed">
            <Bell />
          </button>
          <button type="button" onClick={() => setOverlay('crew')} aria-label="Crew roster">
            <UsersRound />
          </button>
          <button type="button" onClick={() => setOverlay('trophy')} aria-label="Trophy cabinet">
            <Trophy />
          </button>
          <button type="button" onClick={() => setOverlay('characters')} aria-label="Characters">
            <Swords />
          </button>
          <button type="button" onClick={() => setOverlay('ops')} aria-label="Operations console">
            <Wrench />
          </button>
        </div>
      </header>

      {updateAvailable && (
        <div className="ding-update-banner" role="status">
          <span>
            <b>NEW BUILD AVAILABLE</b>
            <small>The raid leader patched DING while this tab was asleep.</small>
          </span>
          <button type="button" onClick={() => window.location.reload()}>
            RELOAD
          </button>
        </div>
      )}
      {status && <div className="ding-status">{status}</div>}
      {pending && (
        <div className="ding-pending">
          Ding confirmation pending.
          <button type="button" onClick={checkPending}>
            CHECK
          </button>
          <button type="button" onClick={retryPending}>
            RETRY SAME EVENT
          </button>
        </div>
      )}

      <section className="ding-stage">
        {activeCharacter ? (
          <>
            <div className="ding-character-heading">
              <span>{activeCharacter.class_name}</span>
              <h1>{activeCharacter.name}</h1>
              <p>
                {activeCharacter.realm} · {activeCharacter.region} · {config.expansionName}
              </p>
            </div>
            <DingButton
              phase={pending && phase === 'idle' ? 'pending' : phase}
              character={activeCharacter}
              config={config}
              onDing={startDing}
            />
            <DingContextEditor
              value={dingContext}
              onChange={setDingContext}
              config={config}
              disabled={phase !== 'idle' || Boolean(pending)}
            />
          </>
        ) : (
          <div className="ding-first-run-wrap">
            <FirstRunIntro config={config} />
            <CharacterForm config={config} onCreated={createCharacter} />
          </div>
        )}
      </section>

      <button className="ding-drawer-handle" type="button" onClick={() => setOverlay('analytics')}>
        <BarChart3 /> SWEAT ANALYTICS
      </button>

      <AnimatePresence>
        {burstId && <DingBurst id={burstId} />}
        {badgeToast && <BadgeToast key={badgeToast.id} badge={badgeToast} />}
      </AnimatePresence>
      <CrewToast toast={crewToast} onClose={dismissCrewToast} />

      {overlay === 'analytics' && (
        <Overlay title="SWEAT ANALYTICS" onClose={() => setOverlay(null)} showScrollTop>
          <DingAnalyticsView
            events={events}
            users={users}
            characters={characters}
            achievements={achievements}
            viewerId={user.id}
          />
        </Overlay>
      )}

      {overlay === 'profile' && (
        <Overlay title="OPERATOR PROFILE" onClose={() => setOverlay(null)} showScrollTop>
          <ProfilePane
            user={user}
            characters={characters}
            events={events}
            achievements={achievements}
            onUserUpdated={updated => {
              setUser(updated);
              setUsers(previous => mergeRow(previous, updated));
            }}
            onLoggedOut={() => setUser(null)}
            onDeleted={() => setUser(null)}
          />
        </Overlay>
      )}

      {overlay === 'crew' && (
        <Overlay title="CREW ROSTER" onClose={() => setOverlay(null)} showScrollTop>
          <CrewPane
            users={users}
            characters={characters}
            events={events}
            achievements={achievements}
            viewerId={user.id}
          />
        </Overlay>
      )}

      {overlay === 'trophy' && (
        <Overlay title="TROPHY CABINET" onClose={() => setOverlay(null)} showScrollTop>
          <TrophyPane userId={user.id} achievements={achievements} />
        </Overlay>
      )}

      {overlay === 'ops' && (
        <Overlay title="DING OPS CONSOLE" onClose={() => setOverlay(null)} showScrollTop>
          <DingAdmin users={users} />
        </Overlay>
      )}

      {overlay === 'feed' && (
        <Overlay title="DING FEED" onClose={() => setOverlay(null)} showScrollTop>
          <div className="ding-feed">
            {events.length ? (
              events.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  character={characterById.get(event.character_id)}
                  onOpen={setSelected}
                />
              ))
            ) : (
              <div className="ding-empty mf-frame">Nobody has leveled yet. Concerning.</div>
            )}
          </div>
        </Overlay>
      )}

      {overlay === 'characters' && (
        <Overlay title="CHARACTERS" onClose={() => setOverlay(null)} showScrollTop>
          <CharacterPane
            user={user}
            characters={characters}
            config={config}
            onSelected={selectCharacter}
            onCreated={createCharacter}
            onUpdated={updateCharacter}
            onArchived={archiveCharacter}
          />
          <div className="ding-account-actions">
            <button
              className="mf-button ghost"
              type="button"
              onClick={async () => {
                await backend.logout();
                setUser(null);
              }}
            >
              <LogOut /> LOG OUT
            </button>
          </div>
        </Overlay>
      )}

      {selected && (
        <EventDetail
          event={selected}
          character={characterById.get(selected.character_id)}
          viewerId={user.id}
          onClose={() => setSelected(null)}
          onUpdated={updated => {
            setSelected(updated);
            setEvents(previous => mergeRow(previous, updated));
            void reconcileLocalAchievements();
          }}
        />
      )}
    </main>
  );
}

export function DingApp() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    backend
      .me()
      .then(setUser)
      .catch(() => {})
      .finally(() => setBooting(false));
  }, []);

  if (booting) return <main className="ding-root ding-loading">LOADING ADDONS…</main>;
  return user ? <DingDashboard key={user.id} user={user} setUser={setUser} /> : <DingLogin onAuthed={setUser} />;
}
