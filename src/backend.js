/*
 * Backend adapter. Talks to Supabase directly (auth, postgrest, realtime) —
 * requires VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY at build time. This is
 * what makes a GitHub Pages deployment work.
 */
import { fetchAllPages } from './fetchAllPages.js';
import { normalizeCharacterDraft } from './dingDomain.js';
import { normalizeDingUsername, syntheticAuthEmail } from './authIdentity.js';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const WEB_PUSH_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || '';

/* ---------------------------------- static / Supabase mode ---------------------------------- */
let supa = null;
let profileCache = new Map();
/* supabase-js reports a non-2xx Edge Function response as a generic
 * FunctionsHttpError and tucks the real response on `context`. Without this the
 * UI can only say "Edge Function returned a non-2xx status code". */
async function readFunctionError(error) {
  try {
    const payload = await error?.context?.json?.();
    return payload?.error || null;
  } catch {
    return null;
  }
}

async function getSupa() {
  if (!supa) {
    const { createClient } = await import('@supabase/supabase-js');
    supa = createClient(SUPA_URL, SUPA_KEY);
  }
  return supa;
}
/* Compared case-insensitively and trimmed. This code ships inside the client
 * bundle either way, so guarding its capitalisation buys nothing and only makes
 * it annoying to type. */
const INVITE_CODE = 'ding4me';
function toUser(p) {
  return p
    ? {
        id: p.id,
        username: p.username,
        avatar_seed: p.avatar_seed,
        created_at: p.created_at,
        active_character_id: p.active_character_id || null,
        tagline: p.tagline || null,
        showcase: p.showcase || null,
      }
    : null;
}
function toCharacter(row) {
  return row
    ? { ...row, current_level: Number(row.current_level), tracked_from_level: Number(row.tracked_from_level) }
    : null;
}
function joinLevelEvent(row) {
  const p = profileCache.get(row.user_id) || {};
  return { ...row, username: p.username || 'Unknown', avatar_seed: p.avatar_seed || 'ding' };
}
function joinAchievement(row) {
  const p = profileCache.get(row.user_id) || {};
  return { ...row, username: p.username || 'Unknown' };
}
async function refreshProfiles(sb) {
  const data = await fetchAllPages((from, to) =>
    sb
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  );
  profileCache = new Map(data.map(p => [p.id, p]));
  return data;
}
async function myProfile(sb) {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw new Error(error.message);
  return toUser(data);
}

const staticBackend = {
  async me() {
    const sb = await getSupa();
    return myProfile(sb);
  },
  async login({ username, password }) {
    const sb = await getSupa();
    const { error } = await sb.auth.signInWithPassword({ email: syntheticAuthEmail(username), password });
    if (error) throw new Error('Invalid username or password');
    return myProfile(sb);
  },
  async signup({ username, password, inviteCode }) {
    if (String(inviteCode).trim().toLowerCase() !== INVITE_CODE)
      throw new Error('That secret handshake is not on the list.');
    const wanted = normalizeDingUsername(username);
    if (String(password).length < 6) throw new Error('Password must be at least 6 characters');
    const sb = await getSupa();
    // Exact-match courtesy check only. ILIKE treats "_" as a wildcard and "_"
    // is itself a valid DING username character. The synthetic auth identity
    // and lower(username) unique index are the authoritative case-insensitive
    // collision guards.
    const taken = await sb.from('profiles').select('id').eq('username', wanted).maybeSingle();
    if (taken.data) throw new Error('Username already exists');
    const { data, error } = await sb.auth.signUp({ email: syntheticAuthEmail(wanted), password });
    if (error) throw new Error(/already/i.test(error.message) ? 'Username already exists' : error.message);
    const uid = data.user?.id;
    if (!uid || !data.session) {
      if (data.user?.identities && data.user.identities.length === 0) {
        throw new Error('Username already exists');
      }
      throw new Error('Signup failed — is email confirmation disabled in Supabase Auth settings?');
    }
    const profile = { id: uid, username: wanted, avatar_seed: `${wanted}-${Date.now()}` };
    const ins = await sb.from('profiles').insert(profile).select().single();
    if (ins.error) {
      try {
        await sb.functions.invoke('delete-account', { body: {} });
      } catch {
        await sb.auth.signOut();
      }
      throw new Error(
        ins.error.code === '23505' || /profiles_username_lower_key/.test(ins.error.message || '')
          ? 'Username already exists'
          : ins.error.message
      );
    }
    return toUser(ins.data);
  },
  async logout() {
    const sb = await getSupa();
    await sb.auth.signOut();
  },
  async updateOwnPassword(password) {
    const value = String(password || '');
    if (value.length < 6) throw new Error('Password must be at least 6 characters');
    if (value.length > 200) throw new Error('Password is too long');
    const sb = await getSupa();
    const { error } = await sb.auth.updateUser({ password: value });
    if (error) throw new Error(error.message || 'Password update failed');
    return { ok: true };
  },
  // DING domain methods are intentionally additive during migration. The
  // Character/level-event methods are the authoritative DING domain surface.
  async gameConfig() {
    const sb = await getSupa();
    const { data, error } = await sb.from('game_config').select('*').eq('id', 'current').single();
    if (error) throw new Error(error.message);
    return data;
  },
  async characters({ includeArchived = false } = {}) {
    const sb = await getSupa();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) throw new Error('Not signed in');
    let query = sb.from('characters').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
    if (!includeArchived) query = query.eq('is_archived', false);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(toCharacter);
  },
  async createCharacter(input) {
    const sb = await getSupa();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const draft = normalizeCharacterDraft(input);
    const row = { ...draft, user_id: user.id };
    const { data, error } = await sb.from('characters').insert(row).select().single();
    if (error) throw new Error(error.message);
    return toCharacter(data);
  },
  async updateCharacter(characterId, patch = {}) {
    const sb = await getSupa();
    const current = (await this.characters({ includeArchived: true })).find(row => row.id === characterId);
    if (!current) throw new Error('Character not found');
    const draft = normalizeCharacterDraft({ ...current, ...patch });
    const { data, error } = await sb.rpc('update_character_metadata', {
      p_character_id: characterId,
      p_name: draft.name,
      p_realm: draft.realm,
      p_region: draft.region,
      p_class_name: draft.class_name,
      p_spec: draft.spec,
      p_race: draft.race,
      p_faction: draft.faction,
      p_is_archived: Boolean(patch.is_archived ?? current.is_archived),
    });
    if (error) throw new Error(error.message);
    return toCharacter(Array.isArray(data) ? data[0] : data);
  },
  async setActiveCharacter(characterId) {
    const sb = await getSupa();
    const { data, error } = await sb.rpc('set_active_character', { p_character_id: characterId || null });
    if (error) throw new Error(error.message);
    return toUser(Array.isArray(data) ? data[0] : data);
  },
  async levelEvents(limit = 200) {
    const sb = await getSupa();
    const result = await sb
      .from('level_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .order('id', { ascending: false })
      .limit(Math.max(1, Math.min(1000, Number(limit) || 200)));
    if (result.error) throw new Error(result.error.message);
    if (!profileCache.size) {
      try {
        await refreshProfiles(sb);
      } catch {}
    }
    return (result.data || []).map(joinLevelEvent);
  },
  async levelEventById(id, actorId) {
    const sb = await getSupa();
    let query = sb.from('level_events').select('*').eq('id', id);
    if (actorId) query = query.eq('user_id', actorId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return data ? joinLevelEvent(data) : null;
  },
  async recordDing(request) {
    const sb = await getSupa();
    const { data, error } = await sb.rpc('record_ding', request);
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return row ? joinLevelEvent(row) : null;
  },
  async patchLevelEventNote(id, note) {
    const sb = await getSupa();
    const { data, error } = await sb.rpc('update_level_event_note', {
      p_event_id: id,
      p_note: String(note || '').slice(0, 240),
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return row ? joinLevelEvent(row) : null;
  },
  /* Deletes the auth user, not just the profile. Removing only the profile left
   * the auth.users row behind holding this username's synthetic email, so
   * signing up again with the same name failed as "Username already exists".
   * Deleting the auth user cascades the profile away and frees the name. */
  async deleteAccount() {
    const sb = await getSupa();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const { data, error } = await sb.functions.invoke('delete-account', { body: {} });
    if (error) {
      const detail = await readFunctionError(error);
      throw new Error(detail || error.message || 'Account deletion failed');
    }
    if (data?.error) throw new Error(data.error);
    await sb.auth.signOut();
  },
  async dingDashboard() {
    const sb = await getSupa();
    const [profiles, characters, levelEvents, achievements] = await Promise.all([
      refreshProfiles(sb),
      fetchAllPages((from, to) =>
        sb
          .from('characters')
          .select('*')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        sb
          .from('level_events')
          .select('*')
          .order('timestamp', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        sb
          .from('achievements')
          .select('*')
          .order('unlocked_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to)
      ),
    ]);
    return {
      users: profiles.map(toUser),
      characters: characters.map(toCharacter),
      levelEvents: levelEvents.map(joinLevelEvent),
      achievements: achievements.map(joinAchievement),
    };
  },
  async reconcileAchievements() {
    const sb = await getSupa();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const { data, error } = await sb.functions.invoke('reconcile-achievements', { body: {} });
    if (error) throw new Error(error.message || 'Achievement reconciliation failed');
    if (data?.error) throw new Error(data.error);
    if (!Array.isArray(data?.achievements)) throw new Error('Achievement reconciliation returned an invalid response');
    return {
      achievements: data.achievements,
      newlyEarned: Array.isArray(data?.newlyEarned) ? data.newlyEarned : [],
    };
  },
  async saveAchievements() {
    return (await this.reconcileAchievements()).achievements;
  },
  async registerPushSubscription(subscription, meta = {}) {
    if (!subscription) return { ok: false, reason: 'missing_subscription' };
    const sb = await getSupa();
    const { data, error } = await sb.functions.invoke('register-push-subscription', {
      body: { subscription, ...meta },
    });
    if (error) {
      // The SDK reports every non-2XX as "Edge Function returned a non-2xx
      // status code", which hides the function's own reason — a 401 from an
      // unrestored session reads identically to a 500 from a failed upsert, and
      // the 401 paths log nothing server-side. Surface the body, and the status
      // when there is no body to read.
      const detail = await readFunctionError(error);
      const status = error?.context?.status;
      throw new Error(
        detail ||
          (status ? `Push registration failed (HTTP ${status})` : error.message) ||
          'Push subscription registration failed'
      );
    }
    if (data?.error) throw new Error(data.error);
    return data || { ok: true };
  },
  /* Debug-menu only: the push delivery log. Admin-gated server-side, the same
   * way the broadcast is — the log records which account received what. */
  async pushDeliveryReport() {
    const sb = await getSupa();
    const { data, error } = await sb.functions.invoke('push-delivery-report', { body: {} });
    if (error) {
      const detail = await readFunctionError(error);
      throw new Error(detail || error.message || 'Delivery report failed');
    }
    if (data?.error) throw new Error(data.error);
    return { deliveries: data?.deliveries || [], unavailable: data?.unavailable || null };
  },
  /* Announce one of the caller's own rows to the rest of the crew. Fire-and-forget
   * from the caller's perspective: dispatch-push-backstop re-sends anything this
   * call loses, and the push_events ledger stops it arriving twice. */
  async notifyEvent(kind, id) {
    if (!kind || !id) return { ok: false, reason: 'missing_event' };
    const sb = await getSupa();
    const { data, error } = await sb.functions.invoke('notify-event', { body: { kind, id } });
    if (error) throw new Error(error.message || 'Crew notification failed');
    if (data?.error) throw new Error(data.error);
    return data || { ok: true };
  },
  /* Debug-menu only: push an arbitrary message to EVERY registered device,
   * including the caller's own. Server-side an allowlist decides who may do
   * this; deliberately not run through the push_events ledger, because a
   * manual test send is something you may legitimately want to repeat. */
  async broadcastTestNotification({ title, body, userIds } = {}) {
    if (!String(title || '').trim() && !String(body || '').trim()) return { ok: false, reason: 'empty_message' };
    const sb = await getSupa();
    const { data, error } = await sb.functions.invoke('broadcast-test-notification', {
      body: { title, body, userIds },
    });
    if (error) {
      // The function returns 403 for a non-allowlisted caller; surface the
      // function's own message rather than the SDK's generic wrapper.
      const detail = await readFunctionError(error);
      throw new Error(detail || error.message || 'Broadcast failed');
    }
    if (data?.error) throw new Error(data.error);
    return data || { ok: true };
  },
  /* Debug-menu only: set another account's password outright. The service-role
   * key that makes this possible never leaves the Edge Function; the same
   * allowlist that gates broadcasting gates this, and it is strictly more
   * powerful — it is account takeover. */
  async adminSetPassword({ userId, password } = {}) {
    if (!userId) return { ok: false, reason: 'missing_user' };
    if (String(password || '').length < 6) return { ok: false, reason: 'password_too_short' };
    const sb = await getSupa();
    const { data, error } = await sb.functions.invoke('admin-set-password', { body: { userId, password } });
    if (error) {
      const detail = await readFunctionError(error);
      throw new Error(detail || error.message || 'Password update failed');
    }
    if (data?.error) throw new Error(data.error);
    return data || { ok: true };
  },
  async getDiscordSettings() {
    const sb = await getSupa();
    const { data, error } = await sb.functions.invoke('admin-discord-settings', { body: { action: 'get' } });
    if (error) {
      const detail = await readFunctionError(error);
      throw new Error(detail || error.message || 'Could not load Discord settings');
    }
    if (data?.error) throw new Error(data.error);
    return data || { ok: true, settings: null, defaults: null };
  },
  async updateDiscordSettings(patch = {}) {
    const sb = await getSupa();
    const { data, error } = await sb.functions.invoke('admin-discord-settings', { body: { action: 'update', patch } });
    if (error) {
      const detail = await readFunctionError(error);
      throw new Error(detail || error.message || 'Could not update Discord settings');
    }
    if (data?.error) throw new Error(data.error);
    return data || { ok: true };
  },
  async sendDiscordTestMessage({ kind, settings } = {}) {
    const sb = await getSupa();
    const { data, error } = await sb.functions.invoke('discord-test-notification', {
      body: { kind: kind === 'achievement' ? 'achievement' : 'ding', settings: settings || undefined },
    });
    if (error) {
      const detail = await readFunctionError(error);
      throw new Error(detail || error.message || 'Discord test send failed');
    }
    if (data?.error) throw new Error(data.error);
    return data || { ok: true };
  },
  webPushPublicKey() {
    return WEB_PUSH_PUBLIC_KEY;
  },
  async patchProfile(patch) {
    const sb = await getSupa();
    const current = await myProfile(sb);
    const tagline = patch.tagline != null ? String(patch.tagline).slice(0, 80) : current.tagline || '';
    const avatarSeed =
      patch.avatar_seed != null ? String(patch.avatar_seed).slice(0, 64) : current.avatar_seed || '';
    const showcase =
      patch.showcase != null
        ? String(patch.showcase)
            .split(',')
            .map(value => value.trim())
            .filter(Boolean)
            .slice(0, 3)
            .join(',')
        : current.showcase || '';

    const { data, error } = await sb.rpc('update_profile_preferences', {
      p_tagline: tagline,
      p_avatar_seed: avatarSeed,
      p_showcase: showcase,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    profileCache.set(row.id, row);
    return toUser(row);
  },
  subscribeDing({ onLevelEvent, onCharacter, onProfile, onAchievement, onStatus }) {
    let channel;
    let unsubscribed = false;
    getSupa().then(sb => {
      if (unsubscribed) return;
      channel = sb
        .channel('ding-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'level_events' }, async payload => {
          if (!profileCache.has(payload.new.user_id)) {
            try {
              await refreshProfiles(sb);
            } catch {}
          }
          if (!unsubscribed) onLevelEvent?.(joinLevelEvent(payload.new), 'created');
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'level_events' }, async payload => {
          if (!profileCache.has(payload.new.user_id)) {
            try {
              await refreshProfiles(sb);
            } catch {}
          }
          if (!unsubscribed) onLevelEvent?.(joinLevelEvent(payload.new), 'updated');
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'level_events' }, payload => {
          if (!unsubscribed) onLevelEvent?.(payload.old, 'deleted');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, payload => {
          if (unsubscribed) return;
          const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
          onCharacter?.(toCharacter(row), payload.eventType.toLowerCase());
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, payload => {
          if (unsubscribed) return;
          profileCache.set(payload.new.id, payload.new);
          onProfile?.(toUser(payload.new), 'created');
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
          if (unsubscribed) return;
          profileCache.set(payload.new.id, payload.new);
          onProfile?.(toUser(payload.new), 'updated');
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'profiles' }, payload => {
          if (unsubscribed) return;
          profileCache.delete(payload.old.id);
          onProfile?.(payload.old, 'deleted');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'achievements' }, async payload => {
          if (unsubscribed) return;
          const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
          if (row?.user_id && !profileCache.has(row.user_id)) {
            try {
              await refreshProfiles(sb);
            } catch {}
          }
          onAchievement?.(payload.eventType === 'DELETE' ? row : joinAchievement(row), payload.eventType.toLowerCase());
        })
        .subscribe(status => {
          if (!unsubscribed) onStatus?.(status);
        });
    });
    return () => {
      unsubscribed = true;
      channel?.unsubscribe();
      onStatus?.('CLOSED');
    };
  },
};

function createDemoBackendProxy() {
  let modulePromise = null;
  const load = () => {
    if (!modulePromise) modulePromise = import('./demoBackend.js').then(module => module.demoBackend);
    return modulePromise;
  };

  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'webPushPublicKey') return () => '';
        if (property === 'subscribeDing') {
          return handlers => {
            let cancelled = false;
            let unsubscribe = () => {};
            void load().then(demo => {
              if (cancelled) return;
              unsubscribe = demo.subscribeDing(handlers);
            });
            return () => {
              cancelled = true;
              unsubscribe();
            };
          };
        }
        return (...args) => load().then(demo => demo[property](...args));
      },
    }
  );
}

export const backend = import.meta.env.VITE_DEMO_MODE === 'true' ? createDemoBackendProxy() : staticBackend;
