import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Bell, LogOut, Plus, Swords, Trophy, UsersRound } from 'lucide-react';
import { backend } from './backend.js';
import { BadgeToast } from './BadgeToast.jsx';
import { dingAchievementById } from './dingAchievements.js';
import { CrewPane, CrewToast, ProfilePane, TrophyPane } from './DingSocial.jsx';
import { useAchievementQueue } from './useAchievementQueue.js';
import { GAME_CONFIG, WOW_CLASSES, mergeGameConfig } from './gameConfig.js';
import { createDingRequest, deriveLevelDurationSeconds, isMaxLevel, validateCharacterDraft } from './dingDomain.js';
import {
  checkPendingDing,
  clearPendingDing,
  readPendingDing,
  retryPendingDing,
  savePendingDing,
} from './dingPending.js';
import { Overlay } from './Overlay.jsx';
import { haptic } from './haptics.js';
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

function CharacterForm({ config, onCreated, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    realm: '',
    region: 'US',
    className: 'Warrior',
    currentLevel: Math.min(80, config.levelCap),
    faction: 'Alliance',
  });
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
      const character = await backend.createCharacter(result.value);
      await onCreated(character);
    } catch (err) {
      setServerError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="ding-character-form mf-frame" onSubmit={submit}>
      <h2>ADD CHARACTER</h2>
      <p>Pick the poor soul whose XP bar is about to become your personality.</p>
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
      </div>
      {serverError && <div className="error">{serverError}</div>}
      <div className="ding-form-actions">
        {onCancel && (
          <button className="mf-button ghost" type="button" onClick={onCancel} disabled={busy}>
            CANCEL
          </button>
        )}
        <button className="mf-button" disabled={busy}>
          {busy ? 'SUMMONING…' : 'ADD CHARACTER'}
        </button>
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

function AnalyticsPane({ events, users, characters, viewerId }) {
  const today = new Date().toDateString();
  const own = events.filter(event => event.user_id === viewerId);
  const durations = own
    .map(event => deriveLevelDurationSeconds(own, event))
    .filter(value => Number.isFinite(value) && value > 0);
  const averageSeconds = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : null;
  const ranking = users
    .map(user => ({ user, count: events.filter(event => event.user_id === user.id).length }))
    .sort((a, b) => b.count - a.count);
  const dayparts = events.reduce((acc, event) => {
    const key = event.time_bucket || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="ding-analytics">
      <div className="ding-stat-grid">
        <div className="stat mf-frame">
          <span>GROUP DINGS</span>
          <strong>{events.length}</strong>
          <small>all tracked levels</small>
        </div>
        <div className="stat mf-frame">
          <span>TODAY</span>
          <strong>{events.filter(event => new Date(event.timestamp).toDateString() === today).length}</strong>
          <small>local viewer day</small>
        </div>
        <div className="stat mf-frame">
          <span>YOUR DINGS</span>
          <strong>{own.length}</strong>
          <small>tracked levels</small>
        </div>
        <div className="stat mf-frame">
          <span>AVG PACE</span>
          <strong>{averageSeconds ? String(Math.round(averageSeconds / 60)) + 'm' : '—'}</strong>
          <small>between your Dings</small>
        </div>
      </div>
      <section className="ding-panel mf-frame">
        <h2>Leaderboard</h2>
        {ranking.map((row, index) => (
          <div className="ding-rank-row" key={row.user.id}>
            <b>#{index + 1}</b>
            <span>{row.user.username}</span>
            <strong>{row.count} Dings</strong>
          </div>
        ))}
      </section>
      <section className="ding-panel mf-frame">
        <h2>Daypart share</h2>
        {Object.entries(dayparts).map(([label, count]) => (
          <div className="ding-rank-row" key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </section>
      <section className="ding-panel mf-frame">
        <h2>Tracked characters</h2>
        {characters.map(character => (
          <div className="ding-rank-row" key={character.id}>
            <span>
              {character.name} · {character.class_name}
            </span>
            <strong>LVL {character.current_level}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}

function CharacterPane({ user, characters, config, onSelected, onCreated }) {
  const own = characters.filter(character => character.user_id === user.id && !character.is_archived);
  const [adding, setAdding] = useState(own.length === 0);

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

  return (
    <div className="ding-character-list">
      <button className="mf-button" type="button" onClick={() => setAdding(true)}>
        <Plus /> ADD CHARACTER
      </button>
      {own.map(character => (
        <button
          className={'ding-character-row mf-frame' + (user.active_character_id === character.id ? ' active' : '')}
          type="button"
          key={character.id}
          onClick={() => onSelected(character)}
        >
          <div>
            <strong>{character.name}</strong>
            <span>
              {character.class_name} · {character.realm} · {character.region}
            </span>
          </div>
          <b>LVL {character.current_level}</b>
        </button>
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
  const [overlay, setOverlay] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [burstId, setBurstId] = useState(null);
  const [crewToast, setCrewToast] = useState(null);
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

  const ownCharacters = useMemo(
    () => characters.filter(character => character.user_id === user.id && !character.is_archived),
    [characters, user.id]
  );
  const activeCharacter =
    ownCharacters.find(character => character.id === user.active_character_id) || ownCharacters[0] || null;

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
    void backend
      .reconcileAchievements()
      .then(result => {
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
      })
      .catch(error => {
        console.warn('[achievement reconcile]', error);
      });
  }

  async function startDing() {
    if (!activeCharacter || pending || phase !== 'idle' || isMaxLevel(activeCharacter, config)) return;

    let request;
    try {
      request = createDingRequest({ character: activeCharacter, eventId: crypto.randomUUID(), config });
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
        </div>
      </header>

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
          </>
        ) : (
          <CharacterForm config={config} onCreated={createCharacter} />
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
          <AnalyticsPane events={events} users={users} characters={characters} viewerId={user.id} />
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
