import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Database } from '../_shared/database.types.ts';
import { syntheticAuthEmail, normalizeDingUsername } from '../../../src/authIdentity.js';
import { corsHeaders, json } from '../_shared/push.ts';

const MIN_PASSWORD_LENGTH = 8;

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function constantTimeEqual(left: string, right: string) {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index % a.length] ?? 0) ^ (b[index % b.length] ?? 0);
  }
  return diff === 0;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const inviteSecret = Deno.env.get('DING_INVITE_CODE') || '';
    if (!supabaseUrl || !serviceRoleKey || !inviteSecret) {
      throw new Error('Signup service is not configured');
    }

    const body = await req.json().catch(() => ({}));
    const inviteCode = typeof body?.inviteCode === 'string' ? body.inviteCode.trim() : '';
    if (!inviteCode || !(await constantTimeEqual(inviteCode, inviteSecret))) {
      return json(403, { error: 'Invalid invite code' });
    }

    let username: string;
    try {
      username = normalizeDingUsername(body?.username);
    } catch (error) {
      return json(400, { error: error instanceof Error ? error.message : 'Invalid username' });
    }

    const password = typeof body?.password === 'string' ? body.password : '';
    if (password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
      return json(400, { error: `Password must be ${MIN_PASSWORD_LENGTH}-200 characters` });
    }

    const admin = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const email = syntheticAuthEmail(username);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { ding_username: username },
    });

    const userId = created.user?.id;
    if (createError || !userId) {
      const message = String(createError?.message || '');
      if (/already|registered|exists/i.test(message)) return json(409, { error: 'Username already exists' });
      throw new Error(message || 'Account creation failed');
    }

    try {
      const { error: profileError } = await admin.from('profiles').insert({
        id: userId,
        username,
        avatar_seed: `${username}-${Date.now()}`,
      });
      if (profileError) {
        if (profileError.code === '23505' || /profiles_username_lower_key/i.test(profileError.message || '')) {
          await admin.auth.admin.deleteUser(userId);
          return json(409, { error: 'Username already exists' });
        }
        throw new Error(profileError.message);
      }
    } catch (error) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw error;
    }

    return json(201, { ok: true, username });
  } catch (error) {
    console.error('[signup-account]', error);
    return json(500, { error: error instanceof Error ? error.message : 'Account creation failed' });
  }
});
