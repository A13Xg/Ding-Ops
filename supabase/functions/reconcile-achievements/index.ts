import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Database } from '../_shared/database.types.ts';
import { dingAchievements, computeDingAchievementUnlocks } from '../../../src/dingAchievements.js';
import { fetchAllPages } from '../../../src/fetchAllPages.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const validAchievementIds = new Set(dingAchievements.map(item => item.id));

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = req.headers.get('Authorization');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Supabase function environment is incomplete');
    if (!authorization) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient<Database>(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const userId = authData.user.id;

    const [configResult, events, characters, existing] = await Promise.all([
      admin.from('game_config').select('level_cap').eq('id', 'current').single(),
      fetchAllPages((from, to) =>
        admin
          .from('level_events')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        admin
          .from('characters')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        admin
          .from('achievements')
          .select('*')
          .order('unlocked_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      ),
    ]);

    if (configResult.error || !configResult.data) {
      throw new Error(configResult.error?.message || 'DING game configuration is missing');
    }

    const earned = computeDingAchievementUnlocks({
      userId,
      events,
      characters,
      existing,
      levelCap: configResult.data.level_cap,
    }).filter(id => validAchievementIds.has(id));

    if (earned.length) {
      const { error } = await admin.from('achievements').upsert(
        earned.map(achievement_type => ({ user_id: userId, achievement_type })),
        { onConflict: 'user_id,achievement_type', ignoreDuplicates: true }
      );
      if (error) throw new Error(error.message);
    }

    const achievementRows = await fetchAllPages((from, to) =>
      admin
        .from('achievements')
        .select('*')
        .order('unlocked_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
    );

    return new Response(JSON.stringify({ achievements: achievementRows, newlyEarned: earned }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[reconcile-achievements]', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Reconciliation failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
