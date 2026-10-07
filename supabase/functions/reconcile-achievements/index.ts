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
    const callerId = authData.user.id;

    const [configResult, profiles, allEvents, allCharacters, existing] = await Promise.all([
      admin.from('game_config').select('level_cap').eq('id', 'current').single(),
      fetchAllPages((from, to) =>
        admin.from('profiles').select('id').order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to)
      ),
      fetchAllPages((from, to) =>
        admin
          .from('level_events')
          .select('*')
          .order('timestamp', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        admin
          .from('characters')
          .select('*')
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

    const rowsToInsert: { user_id: string; achievement_type: string }[] = [];

    for (const profile of profiles) {
      const userId = profile.id;
      const ownedEvents = allEvents.filter(event => event.user_id === userId);
      const ownedCharacters = allCharacters.filter(character => character.user_id === userId);
      const earned = computeDingAchievementUnlocks({
        userId,
        events: ownedEvents,
        allEvents,
        characters: ownedCharacters,
        existing,
        levelCap: configResult.data.level_cap,
      }).filter(id => validAchievementIds.has(id));

      if (!earned.length) continue;
      rowsToInsert.push(...earned.map(achievement_type => ({ user_id: userId, achievement_type })));
    }

    let insertedRows: { user_id: string; achievement_type: string }[] = [];
    if (rowsToInsert.length) {
      const { data, error } = await admin
        .from('achievements')
        .upsert(rowsToInsert, { onConflict: 'user_id,achievement_type', ignoreDuplicates: true })
        .select('user_id,achievement_type');
      if (error) throw new Error(error.message);
      insertedRows = data || [];
    }

    const achievementRows = await fetchAllPages((from, to) =>
      admin
        .from('achievements')
        .select('*')
        .order('unlocked_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
    );

    return new Response(
      JSON.stringify({
        achievements: achievementRows,
        newlyEarned: insertedRows
          .filter(row => row.user_id === callerId)
          .map(row => row.achievement_type),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[reconcile-achievements]', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Reconciliation failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
