import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { syntheticAuthEmail } from '../src/authIdentity.js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (or SUPABASE_URL/SUPABASE_ANON_KEY).');
}

const token = Date.now().toString(36) + randomBytes(3).toString('hex');
const clients = [];
const accounts = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeClient() {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  clients.push(client);
  return client;
}

async function createAccount(label) {
  const client = makeClient();
  const username = (`Smoke${label}${token}`).slice(0, 30);
  const password = 'Ding!' + randomBytes(18).toString('base64url');
  const email = syntheticAuthEmail(username);

  console.log('[smoke] creating temporary auth user', username);
  const signup = await client.auth.signUp({ email, password });
  if (signup.error) throw signup.error;
  const userId = signup.data.user?.id;
  assert(userId, 'Signup did not return a user. Disable email confirmation for DING synthetic auth.');
  assert(signup.data.session, 'Signup did not create a session. Disable email confirmation for DING synthetic auth.');

  const profile = await client
    .from('profiles')
    .insert({ id: userId, username, avatar_seed: `smoke-${label}-${token}` })
    .select('*')
    .single();
  if (profile.error) throw profile.error;
  assert(profile.data.username === username, 'Profile insert/read contract failed.');

  const account = { client, username, userId, characterId: null, eventId: null };
  accounts.push(account);
  return account;
}

async function createCharacter(account, { name, level, faction }) {
  const inserted = await account.client
    .from('characters')
    .insert({
      user_id: account.userId,
      name,
      realm: 'CI Realm',
      region: 'US',
      class_name: faction === 'Alliance' ? 'Mage' : 'Warlock',
      spec: faction === 'Alliance' ? 'Arcane' : 'Destruction',
      race: faction === 'Alliance' ? 'Human' : 'Orc',
      faction,
      current_level: level,
      tracked_from_level: level,
    })
    .select('*')
    .single();
  if (inserted.error) throw inserted.error;
  account.characterId = inserted.data.id;

  const active = await account.client.rpc('set_active_character', { p_character_id: account.characterId });
  if (active.error) throw new Error('set_active_character: ' + active.error.message);
  return inserted.data;
}

async function rpc(account, name, args) {
  const result = await account.client.rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

async function cleanupAccount(account) {
  if (!account?.client) return;
  try {
    await account.client.functions.invoke('delete-account', { body: {} });
  } catch (error) {
    console.warn('[smoke] cleanup failed for', account.username, error?.message || error);
  }
}

async function expectDatabaseFailure(promise, message) {
  const result = await promise;
  assert(result.error, message);
  return result.error;
}

async function expectNoRowsChanged(promise, message) {
  const result = await promise;
  if (result.error) return result.error;
  const rows = Array.isArray(result.data) ? result.data : [];
  assert(rows.length === 0, message);
  return null;
}

async function expectFunctionDenied(promise, message) {
  const result = await promise;
  assert(result.error || Number(result.data?.status) === 403 || /not authorized|forbidden/i.test(String(result.data?.error || '')), message);
  return result;
}

async function subscribeForLevelEvent(client, expectedId) {
  let resolveEvent;
  let rejectEvent;
  const eventPromise = new Promise((resolve, reject) => {
    resolveEvent = resolve;
    rejectEvent = reject;
  });

  let resolveReady;
  let rejectReady;
  const readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const channel = client
    .channel(`ding-smoke-${expectedId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'level_events' }, payload => {
      if (payload?.new?.id === expectedId) resolveEvent(payload.new);
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') resolveReady();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') rejectReady(new Error(`Realtime subscription failed: ${status}`));
    });

  const readyTimer = setTimeout(() => rejectReady(new Error('Realtime subscription did not become ready within 15 seconds.')), 15_000);
  try {
    await readyPromise;
  } finally {
    clearTimeout(readyTimer);
  }

  const waitForEvent = async () => {
    const timeout = setTimeout(() => rejectEvent(new Error('Realtime level event was not observed within 15 seconds.')), 15_000);
    try {
      return await eventPromise;
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    waitForEvent,
    async close() {
      await client.removeChannel(channel);
    },
  };
}

try {
  const alice = await createAccount('A');
  const bob = await createAccount('B');

  const config = await alice.client.from('game_config').select('*').eq('id', 'current').single();
  if (config.error) throw config.error;
  const cap = Number(config.data.level_cap);
  assert(Number.isInteger(cap) && cap >= 4, 'Invalid game_config.level_cap.');

  const aliceInitial = Math.max(1, cap - 2);
  const bobInitial = Math.max(1, cap - 3);
  await createCharacter(alice, { name: 'Smokemage', level: aliceInitial, faction: 'Alliance' });
  await createCharacter(bob, { name: 'Smokelock', level: bobInitial, faction: 'Horde' });

  console.log('[smoke] testing shared reads and owner-only writes');
  const bobVisible = await alice.client.from('characters').select('id,user_id,name').eq('id', bob.characterId).single();
  if (bobVisible.error) throw bobVisible.error;
  assert(bobVisible.data.user_id === bob.userId, 'Crew character read policy did not expose the expected row.');

  await expectNoRowsChanged(
    alice.client.from('characters').update({ spec: 'Should Fail' }).eq('id', bob.characterId).select('id,spec'),
    'User A unexpectedly updated User B character metadata.'
  );

  const foreignActive = await alice.client.rpc('set_active_character', { p_character_id: bob.characterId });
  assert(foreignActive.error, 'User A unexpectedly selected User B character.');

  const forgedLevel = await alice.client.from('level_events').insert({
    id: randomUUID(),
    user_id: alice.userId,
    character_id: alice.characterId,
    from_level: aliceInitial,
    to_level: aliceInitial + 1,
    time_zone: 'UTC',
    local_date: '2026-10-06',
    local_hour: 12,
    time_bucket: 'Afternoon',
  });
  assert(forgedLevel.error, 'Browser direct level_event insert unexpectedly succeeded.');

  await expectNoRowsChanged(
    alice.client
      .from('characters')
      .update({ current_level: aliceInitial + 1 })
      .eq('id', alice.characterId)
      .select('id,current_level'),
    'Browser direct character level update unexpectedly succeeded.'
  );

  const unchangedCharacter = await alice.client
    .from('characters')
    .select('current_level')
    .eq('id', alice.characterId)
    .single();
  if (unchangedCharacter.error) throw unchangedCharacter.error;
  assert(
    Number(unchangedCharacter.data.current_level) === aliceInitial,
    'Character level changed despite browser UPDATE being blocked.'
  );

  await expectDatabaseFailure(
    alice.client.from('achievements').insert({ user_id: alice.userId, achievement_type: 'first_ding' }),
    'Browser direct achievement insert unexpectedly succeeded.'
  );

  await expectDatabaseFailure(
    alice.client.from('push_subscriptions').insert({
      user_id: alice.userId,
      endpoint: 'https://example.invalid/push',
      p256dh: 'A'.repeat(87),
      auth: 'B'.repeat(22),
    }),
    'Browser direct push subscription insert unexpectedly succeeded.'
  );

  await expectNoRowsChanged(
    alice.client
      .from('profiles')
      .update({ showcase: 'hundred_dings' })
      .eq('id', alice.userId)
      .select('id,showcase'),
    'Browser direct profile preference update unexpectedly succeeded.'
  );


  const firstId = randomUUID();
  alice.eventId = firstId;
  const firstArgs = {
    p_event_id: firstId,
    p_character_id: alice.characterId,
    p_expected_from_level: aliceInitial,
    p_zone: 'Smoke Zone',
    p_activity_type: 'questing',
    p_deaths: 0,
    p_session_minutes: 17,
    p_note: 'automated integration smoke test',
    p_time_zone: 'UTC',
  };

  console.log('[smoke] testing Realtime publication with a second authenticated account');
  const realtime = await subscribeForLevelEvent(bob.client, firstId);

  console.log('[smoke] testing same-UUID concurrent idempotency');
  const same = await Promise.all([alice.client.rpc('record_ding', firstArgs), alice.client.rpc('record_ding', firstArgs)]);
  for (const result of same) {
    if (result.error) throw new Error('same UUID retry failed: ' + result.error.message);
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    assert(row?.id === firstId, 'Same UUID did not resolve to the same event.');
    assert(Number(row?.to_level) === aliceInitial + 1, 'First Ding destination was wrong.');
  }

  const realtimeRow = await realtime.waitForEvent();
  assert(realtimeRow.id === firstId, 'Realtime delivered the wrong level event.');
  await realtime.close();

  const eventCount = await alice.client.from('level_events').select('id', { count: 'exact', head: true }).eq('id', firstId);
  if (eventCount.error) throw eventCount.error;
  assert(eventCount.count === 1, 'Same UUID created more than one level event.');

  console.log('[smoke] testing cross-account RPC ownership');
  const foreignDing = await alice.client.rpc('record_ding', {
    ...firstArgs,
    p_event_id: randomUUID(),
    p_character_id: bob.characterId,
    p_expected_from_level: bobInitial,
  });
  assert(foreignDing.error, 'User A unexpectedly recorded a Ding for User B character.');

  console.log('[smoke] testing conflicting concurrent next-level writes');
  const secondExpected = aliceInitial + 1;
  const secondCalls = [randomUUID(), randomUUID()].map(id =>
    alice.client.rpc('record_ding', {
      ...firstArgs,
      p_event_id: id,
      p_expected_from_level: secondExpected,
      p_note: 'concurrency race',
    })
  );
  const race = await Promise.all(secondCalls);
  const successes = race.filter(result => !result.error);
  const failures = race.filter(result => result.error);
  assert(successes.length === 1 && failures.length === 1, 'Exactly one competing Ding must win the character lock.');
  const winningRow = Array.isArray(successes[0].data) ? successes[0].data[0] : successes[0].data;
  assert(Number(winningRow?.to_level) === secondExpected + 1, 'Winning concurrent Ding advanced to the wrong level.');

  const character = await alice.client.from('characters').select('*').eq('id', alice.characterId).single();
  if (character.error) throw character.error;
  assert(Number(character.data.current_level) === secondExpected + 1, 'Character level was not updated atomically.');

  console.log('[smoke] testing note RPC ownership');
  const note = await rpc(alice, 'update_level_event_note', { p_event_id: firstId, p_note: 'edited by live smoke test' });
  assert(note?.note === 'edited by live smoke test', 'Note update RPC did not persist.');

  const foreignNote = await bob.client.rpc('update_level_event_note', {
    p_event_id: firstId,
    p_note: 'should never land',
  });
  assert(foreignNote.error, 'User B unexpectedly edited User A Ding note.');

  console.log('[smoke] creating a near-synchronous second-user Ding');
  const bobEventId = randomUUID();
  bob.eventId = bobEventId;
  const bobDing = await bob.client.rpc('record_ding', {
    p_event_id: bobEventId,
    p_character_id: bob.characterId,
    p_expected_from_level: bobInitial,
    p_zone: 'Smoke Zone',
    p_activity_type: 'dungeon',
    p_deaths: 1,
    p_session_minutes: 23,
    p_note: 'second-account smoke event',
    p_time_zone: 'UTC',
  });
  if (bobDing.error) throw new Error('User B Ding failed: ' + bobDing.error.message);

  await expectFunctionDenied(
    alice.client.functions.invoke('notify-event', { body: { kind: 'ding', id: bobEventId } }),
    'User A unexpectedly announced User B Ding.'
  );

  console.log('[smoke] testing full-crew achievement reconciliation');
  const achievements = await alice.client.functions.invoke('reconcile-achievements', { body: {} });
  if (achievements.error) throw achievements.error;
  assert(Array.isArray(achievements.data?.achievements), 'Achievement reconciliation response was invalid.');

  const aliceAwards = achievements.data.achievements.filter(row => row.user_id === alice.userId);
  const bobAwards = achievements.data.achievements.filter(row => row.user_id === bob.userId);
  assert(aliceAwards.some(row => row.achievement_type === 'first_ding'), 'User A First Ding achievement was not reconciled.');
  assert(bobAwards.some(row => row.achievement_type === 'first_ding'), 'User B First Ding achievement was not reconciled.');
  assert(aliceAwards.some(row => row.achievement_type === 'sync_pair'), 'User A synchronized crew award was not reconciled.');
  assert(bobAwards.some(row => row.achievement_type === 'sync_pair'), 'User B synchronized crew award was not reconciled.');

  console.log('[smoke] testing validated profile showcase writes');
  const forgedShowcase = await alice.client.rpc('update_profile_preferences', {
    p_tagline: 'smoke',
    p_avatar_seed: 'smoke',
    p_showcase: 'hundred_dings',
  });
  assert(forgedShowcase.error, 'Unearned showcase achievement was unexpectedly accepted.');

  const earnedShowcase = await alice.client.rpc('update_profile_preferences', {
    p_tagline: 'smoke',
    p_avatar_seed: 'smoke',
    p_showcase: 'first_ding,sync_pair',
  });
  if (earnedShowcase.error) throw new Error('Earned showcase update failed: ' + earnedShowcase.error.message);
  const earnedProfile = Array.isArray(earnedShowcase.data) ? earnedShowcase.data[0] : earnedShowcase.data;
  assert(earnedProfile?.showcase === 'first_ding,sync_pair', 'Earned showcase did not persist.');

  console.log('[smoke] testing privileged endpoints fail closed for ordinary users');
  await expectFunctionDenied(
    alice.client.functions.invoke('push-delivery-report', { body: {} }),
    'Ordinary user unexpectedly read the push delivery log.'
  );
  await expectFunctionDenied(
    alice.client.functions.invoke('broadcast-test-notification', {
      body: { title: 'smoke', body: 'should be denied' },
    }),
    'Ordinary user unexpectedly sent an admin broadcast.'
  );

  console.log('[smoke] PASS', {
    users: [alice.username, bob.username],
    characters: [alice.characterId, bob.characterId],
    cap,
    achievements: achievements.data.achievements.length,
    realtime: true,
    rls: true,
    concurrency: true,
  });
} finally {
  console.log('[smoke] deleting temporary accounts');
  for (const account of [...accounts].reverse()) await cleanupAccount(account);
  for (const client of clients) {
    try {
      await client.removeAllChannels();
      await client.auth.signOut();
    } catch {}
  }
}
