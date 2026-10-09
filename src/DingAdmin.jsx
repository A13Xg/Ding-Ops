import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  CheckCircle2,
  Database,
  FlaskConical,
  KeyRound,
  RefreshCw,
  Send,
  ServerCog,
  ShieldAlert,
  Smartphone,
  UsersRound,
} from 'lucide-react';
import { backend } from './backend.js';
import { CURRENT_BUILD_ID, readServiceWorkerVersion } from './appVersion.js';
import { dingAchievementById, dingAchievements } from './dingAchievements.js';
import { dingRankForXp } from './dingProgression.js';
import { describeDiscordTokens } from './discordTemplate.js';
import { describeTokens } from './broadcastTemplate.js';
import { getNotificationPermission } from './notifications.js';

function AdminStatus({ value }) {
  if (!value) return null;
  return (
    <div className={'ding-admin-status ' + (value.ok ? 'ok' : 'error')} role="status">
      {value.ok ? <CheckCircle2 /> : <ShieldAlert />}
      <span>{value.message}</span>
    </div>
  );
}

function SystemTab() {
  const [swVersion, setSwVersion] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let live = true;
    readServiceWorkerVersion()
      .then(version => {
        if (live) setSwVersion(version);
      })
      .finally(() => {
        if (live) setChecking(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const rows = [
    ['APP BUILD', CURRENT_BUILD_ID],
    ['SERVICE WORKER', checking ? 'CHECKING…' : swVersion || 'NOT CONTROLLING'],
    ['NOTIFICATIONS', getNotificationPermission().toUpperCase()],
    ['VAPID CLIENT KEY', backend.webPushPublicKey() ? 'CONFIGURED' : 'MISSING'],
    ['ONLINE', navigator.onLine ? 'YES' : 'NO'],
    ['PWA DISPLAY', window.matchMedia?.('(display-mode: standalone)')?.matches ? 'STANDALONE' : 'BROWSER'],
  ];

  return (
    <div className="ding-admin-grid">
      {rows.map(([label, value]) => (
        <div className="ding-admin-metric mf-frame" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function DeliveryTab() {
  const [state, setState] = useState({ loading: false, rows: [], unavailable: null, error: '' });

  async function load() {
    setState(previous => ({ ...previous, loading: true, error: '' }));
    try {
      const result = await backend.pushDeliveryReport();
      setState({ loading: false, rows: result.deliveries || [], unavailable: result.unavailable || null, error: '' });
    } catch (error) {
      setState(previous => ({ ...previous, loading: false, error: error.message }));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const rows = state.rows;
    const acked = rows.filter(row => row.ackedAt).length;
    return {
      total: rows.length,
      acked,
      unacked: rows.length - acked,
      recipients: new Set(rows.map(row => row.recipientName).filter(Boolean)).size,
    };
  }, [state.rows]);

  return (
    <div className="ding-admin-stack">
      <div className="ding-admin-toolbar">
        <button className="mf-button" type="button" disabled={state.loading} onClick={load}>
          <RefreshCw /> {state.loading ? 'LOADING…' : 'REFRESH DELIVERY LOG'}
        </button>
      </div>
      {state.error && <AdminStatus value={{ ok: false, message: state.error }} />}
      {state.unavailable && (
        <AdminStatus value={{ ok: false, message: 'Delivery table unavailable: ' + state.unavailable }} />
      )}
      <div className="ding-stat-grid">
        <div className="stat mf-frame">
          <span>ROWS</span>
          <strong>{summary.total}</strong>
          <small>latest 1000</small>
        </div>
        <div className="stat mf-frame">
          <span>ACKED</span>
          <strong>{summary.acked}</strong>
          <small>device receipts</small>
        </div>
        <div className="stat mf-frame">
          <span>UNACKED</span>
          <strong>{summary.unacked}</strong>
          <small>needs context</small>
        </div>
        <div className="stat mf-frame">
          <span>DEVICES/USERS</span>
          <strong>{summary.recipients}</strong>
          <small>named recipients</small>
        </div>
      </div>
      <div className="ding-admin-table-wrap mf-frame">
        <table className="ding-admin-table">
          <thead>
            <tr>
              <th>Sent</th>
              <th>Kind</th>
              <th>Actor</th>
              <th>Recipient</th>
              <th>Title</th>
              <th>ACK</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.slice(0, 250).map((row, index) => (
              <tr key={row.batchId + ':' + row.recipientName + ':' + index}>
                <td>{row.sentAt ? new Date(row.sentAt).toLocaleString() : '—'}</td>
                <td>{row.kind || '—'}</td>
                <td>{row.actorName || 'System'}</td>
                <td>{row.recipientName || 'Unknown'}</td>
                <td>{row.title || '—'}</td>
                <td>{row.ackedAt ? 'YES' : 'NO'}</td>
              </tr>
            ))}
            {!state.rows.length && !state.loading && (
              <tr>
                <td colSpan="6">No delivery rows returned.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BroadcastTab({ users }) {
  const [title, setTitle] = useState('{{SENDER}} → DING crew');
  const [body, setBody] = useState('{{USER}}, this is a push transport test. {{TIME}} UTC.');
  const [targets, setTargets] = useState([]);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await backend.broadcastTestNotification({
        title,
        body,
        userIds: targets.length ? targets : undefined,
      });
      setStatus({
        ok: true,
        message: `Attempted ${result.attempted ?? 0}; delivered ${result.delivered ?? 0}; pruned ${result.pruned ?? 0}.`,
      });
    } catch (error) {
      setStatus({ ok: false, message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ding-admin-stack">
      <section className="ding-panel mf-frame">
        <h2>Manual push broadcast</h2>
        <p className="ding-muted">
          Admin-gated server-side. This deliberately bypasses the event ledger so repeated test sends are possible.
        </p>
        <label className="ding-admin-field">
          TITLE
          <input maxLength={120} value={title} onChange={event => setTitle(event.target.value)} />
        </label>
        <label className="ding-admin-field">
          BODY
          <textarea maxLength={300} value={body} onChange={event => setBody(event.target.value)} />
        </label>
        <div className="ding-admin-targets">
          <strong>Targets</strong>
          <button type="button" onClick={() => setTargets([])}>
            ALL REGISTERED DEVICES
          </button>
          {users.map(user => {
            const checked = targets.includes(user.id);
            return (
              <label key={user.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setTargets(previous => (checked ? previous.filter(id => id !== user.id) : [...previous, user.id]))
                  }
                />
                {user.username}
              </label>
            );
          })}
        </div>
        <button className="mf-button" type="button" disabled={busy || (!title.trim() && !body.trim())} onClick={send}>
          <Send /> {busy ? 'SENDING…' : 'SEND TEST PUSH'}
        </button>
        <AdminStatus value={status} />
      </section>
      <section className="ding-panel mf-frame">
        <h2>Template tokens</h2>
        <div className="ding-token-grid">
          {describeTokens().map(token => (
            <div key={token.token}>
              <code>{token.token}</code>
              <span>{token.hint}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AccountsTab({ users }) {
  const [selected, setSelected] = useState(users[0]?.id || '');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await backend.adminSetPassword({ userId: selected, password });
      setStatus({ ok: true, message: `Password updated for ${result.username || 'account'}.` });
      setPassword('');
    } catch (error) {
      setStatus({ ok: false, message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ding-panel mf-frame">
      <h2>Account administration</h2>
      <p className="ding-muted">
        This endpoint can take over another account and is intentionally restricted by the server admin allowlist.
      </p>
      <label className="ding-admin-field">
        ACCOUNT
        <select value={selected} onChange={event => setSelected(event.target.value)}>
          {users.map(user => (
            <option value={user.id} key={user.id}>
              {user.username}
            </option>
          ))}
        </select>
      </label>
      <label className="ding-admin-field">
        NEW PASSWORD
        <input
          type="password"
          minLength={8}
          maxLength={200}
          autoComplete="new-password"
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
      </label>
      <button
        className="mf-button danger"
        type="button"
        disabled={busy || !selected || password.length < 8}
        onClick={save}
      >
        <KeyRound /> {busy ? 'UPDATING…' : 'SET PASSWORD'}
      </button>
      <AdminStatus value={status} />
    </section>
  );
}

const DISCORD_TEXT_FIELDS = [
  ['webhook_url', 'WEBHOOK URL'],
  ['bot_username', 'BOT USERNAME'],
  ['bot_avatar_url', 'BOT AVATAR URL'],
  ['footer_text', 'FOOTER'],
  ['ding_color', 'DING COLOR'],
  ['achievement_color', 'ACHIEVEMENT COLOR'],
  ['mention_content', 'MENTION CONTENT'],
  ['ding_title_template', 'DING TITLE TEMPLATE'],
  ['ding_description_template', 'DING BODY TEMPLATE'],
  ['achievement_title_template', 'ACHIEVEMENT TITLE TEMPLATE'],
  ['achievement_description_template', 'ACHIEVEMENT BODY TEMPLATE'],
];

function DiscordTab() {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(true);

  async function load() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await backend.getDiscordSettings();
      setSettings({ ...(result.defaults || {}), ...(result.settings || {}) });
    } catch (error) {
      setStatus({ ok: false, message: error.message });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await backend.updateDiscordSettings(settings);
      if (result.settings) setSettings(previous => ({ ...previous, ...result.settings }));
      setStatus({ ok: true, message: 'Discord settings saved.' });
    } catch (error) {
      setStatus({ ok: false, message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function test(kind) {
    setBusy(true);
    setStatus(null);
    try {
      const result = await backend.sendDiscordTestMessage({ kind, settings });
      setStatus({ ok: true, message: `${kind} test sent (HTTP ${result.status ?? 'OK'}).` });
    } catch (error) {
      setStatus({ ok: false, message: error.message });
    } finally {
      setBusy(false);
    }
  }

  if (!settings && busy) return <div className="ding-empty mf-frame">LOADING DISCORD CONTROL PLANE…</div>;

  return (
    <div className="ding-admin-stack">
      <section className="ding-panel mf-frame">
        <h2>Discord webhook integration</h2>
        <div className="ding-admin-switches">
          {[
            ['enabled', 'Integration enabled'],
            ['ding_enabled', 'Send Dings'],
            ['achievement_enabled', 'Send achievements'],
            ['include_thumbnail', 'Achievement thumbnail'],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(settings?.[key])}
                onChange={event => setSettings(previous => ({ ...previous, [key]: event.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="ding-admin-form-grid">
          {DISCORD_TEXT_FIELDS.map(([key, label]) => (
            <label className={'ding-admin-field ' + (key.includes('description') ? 'wide' : '')} key={key}>
              {label}
              {key.includes('description') ? (
                <textarea
                  value={settings?.[key] || ''}
                  onChange={event => setSettings(previous => ({ ...previous, [key]: event.target.value }))}
                />
              ) : (
                <input
                  value={settings?.[key] || ''}
                  onChange={event => setSettings(previous => ({ ...previous, [key]: event.target.value }))}
                />
              )}
            </label>
          ))}
        </div>
        <div className="ding-admin-toolbar">
          <button className="mf-button" type="button" disabled={busy || !settings} onClick={save}>
            <Database /> SAVE SETTINGS
          </button>
          <button className="mf-button ghost" type="button" disabled={busy || !settings} onClick={() => test('ding')}>
            <Bot /> TEST DING
          </button>
          <button
            className="mf-button ghost"
            type="button"
            disabled={busy || !settings}
            onClick={() => test('achievement')}
          >
            <Bot /> TEST AWARD
          </button>
          <button className="mf-button ghost" type="button" disabled={busy} onClick={load}>
            <RefreshCw /> RELOAD
          </button>
        </div>
        <AdminStatus value={status} />
      </section>
      <section className="ding-panel mf-frame">
        <h2>Discord tokens</h2>
        <div className="ding-token-grid">
          {describeDiscordTokens().map(token => (
            <div key={token.token}>
              <code>{token.token}</code>
              <span>{token.hint}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SandboxTab() {
  const [dings, setDings] = useState(1);
  const [xp, setXp] = useState(0);
  const [achievementId, setAchievementId] = useState('first_ding');
  const award = dingAchievementById(achievementId);
  const rank = dingRankForXp(xp);

  return (
    <div className="ding-admin-stack">
      <section className="ding-panel mf-frame">
        <h2>Local-only sandbox</h2>
        <p className="ding-muted">
          Nothing in this tab writes to Supabase or crew state. It exists for safe visual/progression checks.
        </p>
        <div className="ding-admin-sim-controls">
          <button type="button" onClick={() => setDings(value => Math.max(0, value - 1))}>
            − DING
          </button>
          <strong>{dings} simulated Dings</strong>
          <button type="button" onClick={() => setDings(value => value + 1)}>
            + DING
          </button>
          <button type="button" onClick={() => setXp(value => Math.max(0, value - 50))}>
            − 50 XP
          </button>
          <strong>{xp} simulated XP</strong>
          <button type="button" onClick={() => setXp(value => value + 50)}>
            + 50 XP
          </button>
        </div>
        <div className="ding-admin-sim-card">
          <FlaskConical />
          <div>
            <span>SIMULATED APP RANK</span>
            <strong>{rank.name}</strong>
            <small>{rank.maxed ? 'MAX RANK' : `${rank.remaining} XP to ${rank.next.name}`}</small>
          </div>
        </div>
        <label className="ding-admin-field">
          ACHIEVEMENT PREVIEW
          <select value={achievementId} onChange={event => setAchievementId(event.target.value)}>
            {dingAchievements.map(item => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {award && (
          <div className="ding-admin-award-preview">
            <b>{award.name}</b>
            <span>
              {award.tier.toUpperCase()} · {award.points} XP
            </span>
            <small>{award.desc}</small>
          </div>
        )}
      </section>
    </div>
  );
}

export function DingAdmin({ users }) {
  const [tab, setTab] = useState('system');
  const tabs = [
    ['system', ServerCog, 'SYSTEM'],
    ['delivery', Smartphone, 'DELIVERY'],
    ['broadcast', Bell, 'NOTIFY'],
    ['accounts', UsersRound, 'ACCOUNTS'],
    ['discord', Bot, 'DISCORD'],
    ['sandbox', FlaskConical, 'SANDBOX'],
  ];

  return (
    <div className="ding-admin">
      <nav className="ding-admin-tabs" aria-label="DING operations console tabs">
        {tabs.map(([id, Icon, label]) => (
          <button className={tab === id ? 'active' : ''} type="button" key={id} onClick={() => setTab(id)}>
            <Icon /> {label}
          </button>
        ))}
      </nav>
      {tab === 'system' && <SystemTab />}
      {tab === 'delivery' && <DeliveryTab />}
      {tab === 'broadcast' && <BroadcastTab users={users} />}
      {tab === 'accounts' && <AccountsTab users={users} />}
      {tab === 'discord' && <DiscordTab />}
      {tab === 'sandbox' && <SandboxTab />}
    </div>
  );
}
