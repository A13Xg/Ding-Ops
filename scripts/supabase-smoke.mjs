import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (or SUPABASE_URL/SUPABASE_ANON_KEY).');
}

const token = Date.now().toString(36) + randomBytes(3).toString('hex');
const username = ('Smoke' + token).slice(0, 30);
const email = username.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '@ding-ops.dev';
const password = 'Ding!' + randomBytes(18).toString('base64url');
const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
let created = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function rpc(name, args) {
  const result = await client.rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

async function cleanup() {
  if (!created) return;
  try {
    await client.functions.invoke('delete-account', { body: {} });
  } catch (error) {
    console.warn('[smoke] cleanup failed:', error?.message || error);
  }
}

try {
  console.log('[smoke] creating temporary auth user', username);
  const signup = await client.auth.signUp({ email, password });
  if (signup.error) throw signup.error;
  const userId = signup.data.user?.id;
  assert(userId, 'Signup did not return a user. Disable email confirmation for DING synthetic auth.');
  assert(signup.data.session, 'Signup did not create a session. Disable email confirmation for DING synthetic auth.');
  created = true;

  const profileInsert = await client
    .from('profiles')
    .insert({ id: userId, username, avatar_seed: 'smoke-' + token })
    .select('*')
    .single();
  if (profileInsert.error) throw profileInsert.error;
  assert(profileInsert.data.username === username, 'Profile insert/read contract failed.');

  const config = await client.from('game_config').select('*').eq('id', 'current').single();
  if (config.error) throw config.error;
  const cap = Number(config.data.level_cap);
  assert(Number.isInteger(cap) && cap >= 3, 'Invalid game_config.level_cap.');

  const initialLevel = Math.max(1, cap - 2);
  const characterInsert = await client
    .from('characters')
    .insert({
      user_id: userId,
      name: 'Smokemage',
      realm: 'CI Realm',
      region: 'US',
      class_name: 'Mage',
      spec: 'Arcane',
      race: 'Human',
      faction: 'Alliance',
      current_level: initialLevel,
      tracked_from_level: initialLevel,
    })
    .select('*')
    .single();
  if (characterInsert.error) throw characterInsert.error;
  const characterId = characterInsert.data.id;
  await rpc('set_active_character', { p_character_id: characterId });

  const firstId = randomUUID();
  const firstArgs = {
    p_event_id: firstId,
    p_character_id: characterId,
    p_expected_from_level: initialLevel,
    p_zone: 'Smoke Zone',
    p_activity_type: 'questing',
    p_deaths: 0,
    p_session_minutes: 17,
    p_note: 'automated integration smoke test',
    p_time_zone: 'UTC',
  };

  console.log('[smoke] testing same-UUID concurrent idempotency');
  const same = await Promise.all([client.rpc('record_ding', firstArgs), client.rpc('record_ding', firstArgs)]);
  for (const result of same) {
    if (result.error) throw new Error('same UUID retry failed: ' + result.error.message);
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    assert(row?.id === firstId, 'Same UUID did not resolve to the same event.');
    assert(Number(row?.to_level) === initialLevel + 1, 'First Ding destination was wrong.');
  }

  const eventCount = await client.from('level_events').select('id', { count: 'exact', head: true }).eq('id', firstId);
  if (eventCount.error) throw eventCount.error;
  assert(eventCount.count === 1, 'Same UUID created more than one level event.');

  console.log('[smoke] testing conflicting concurrent next-level writes');
  const secondExpected = initialLevel + 1;
  const secondCalls = [randomUUID(), randomUUID()].map(id =>
    client.rpc('record_ding', {
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

  const character = await client.from('characters').select('*').eq('id', characterId).single();
  if (character.error) throw character.error;
  assert(Number(character.data.current_level) === secondExpected + 1, 'Character level was not updated atomically.');

  console.log('[smoke] testing note RPC');
  const note = await rpc('update_level_event_note', { p_event_id: firstId, p_note: 'edited by live smoke test' });
  assert(note?.note === 'edited by live smoke test', 'Note update RPC did not persist.');

  console.log('[smoke] testing achievement reconciliation Edge Function');
  const achievements = await client.functions.invoke('reconcile-achievements', { body: {} });
  if (achievements.error) throw achievements.error;
  assert(Array.isArray(achievements.data?.achievements), 'Achievement reconciliation response was invalid.');
  assert(achievements.data.achievements.some(row => row.achievement_type === 'first_ding'), 'First Ding achievement was not reconciled.');

  console.log('[smoke] PASS', {
    username,
    characterId,
    cap,
    achievements: achievements.data.achievements.length,
  });
} finally {
  console.log('[smoke] deleting temporary account');
  await cleanup();
}
