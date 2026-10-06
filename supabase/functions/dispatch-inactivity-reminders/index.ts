/*
 * dispatch-inactivity-reminders — scheduled DING re-engagement nags.
 *
 * Every successful Ding resets public.inactivity_reminders through the
 * ding_reset_inactivity_reminder trigger. The reminder row is therefore the
 * authoritative cycle anchor; profiles do not duplicate a "last Ding" field.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Database } from '../_shared/database.types.ts';
import { fetchAllPages } from '../../../src/fetchAllPages.js';
import {
  isInactivityReminderDue,
  markInactivityReminderSent,
  pickInactivityReminderMessage,
  reconcileInactivityReminderState,
} from '../../../src/inactivityReminder.js';
import { authorizeCron, corsHeaders, json, sendToSubscriptions } from '../_shared/push.ts';

const BATCH_SIZE = 200;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase function environment is incomplete');
    if (!authorizeCron(req, serviceRoleKey)) return json(401, { error: 'Unauthorized' });

    const admin = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const now = Date.now();

    const reminderRows = await fetchAllPages(
      (from: number, to: number) =>
        admin
          .from('inactivity_reminders')
          .select('user_id,cycle_ding_at,scheduled_for,last_sent_at,last_message_index')
          .order('user_id', { ascending: true })
          .range(from, to),
      BATCH_SIZE,
    );

    let sentCount = 0;
    let failedCount = 0;
    let scheduledCount = 0;
    let prunedSubscriptions = 0;

    for (let offset = 0; offset < reminderRows.length; offset += BATCH_SIZE) {
      const batch = reminderRows.slice(offset, offset + BATCH_SIZE);
      const userIds = batch.map((row: { user_id: string }) => row.user_id);
      if (!userIds.length) continue;

      const subscriptionRows = (await fetchAllPages((from: number, to: number) =>
        admin
          .from('push_subscriptions')
          .select('id,user_id,endpoint,p256dh,auth')
          .in('user_id', userIds)
          .range(from, to)
      )) as Array<{ id: number; user_id: string; endpoint: string; p256dh: string; auth: string }>;

      const subscriptionsByUser = new Map<
        string,
        Array<{ id: number; user_id: string; endpoint: string; p256dh: string; auth: string }>
      >();
      for (const sub of subscriptionRows) {
        if (!subscriptionsByUser.has(sub.user_id)) subscriptionsByUser.set(sub.user_id, []);
        subscriptionsByUser.get(sub.user_id)?.push(sub);
      }

      const upserts: Database['public']['Tables']['inactivity_reminders']['Insert'][] = [];

      for (const row of batch) {
        const state = {
          cycleDingAt: row.cycle_ding_at,
          scheduledFor: row.scheduled_for,
          lastSentAt: row.last_sent_at,
          lastMessageIndex: row.last_message_index,
        };
        const reconciled = reconcileInactivityReminderState({
          state,
          latestDingAt: row.cycle_ding_at,
          now,
        });
        if (!reconciled) continue;

        const subscriptions = subscriptionsByUser.get(row.user_id) || [];
        let nextState = reconciled;

        if (subscriptions.length && isInactivityReminderDue(reconciled, row.cycle_ding_at, now)) {
          const chosen = pickInactivityReminderMessage({ lastMessageIndex: reconciled.lastMessageIndex });
          const result = await sendToSubscriptions(
            admin,
            subscriptions,
            {
              title: 'DING is judging your inactivity',
              body: chosen.text,
              tag: `ding-inactivity-${row.user_id}`,
              kind: 'inactivity',
              data: { kind: 'inactivity' },
            },
            { ttlSeconds: 6 * 60 * 60, actorId: row.user_id },
          );
          prunedSubscriptions += result.pruned;

          const advanced = markInactivityReminderSent(reconciled, {
            now,
            messageIndex: result.delivered > 0 ? chosen.index : reconciled.lastMessageIndex,
          });
          if (advanced) nextState = advanced;
          if (result.delivered > 0) sentCount += 1;
          else failedCount += 1;
        }

        upserts.push({
          user_id: row.user_id,
          cycle_ding_at: nextState.cycleDingAt,
          scheduled_for: nextState.scheduledFor,
          last_sent_at: nextState.lastSentAt,
          last_message_index: nextState.lastMessageIndex,
          updated_at: new Date(now).toISOString(),
        });
      }

      if (upserts.length) {
        const { error: upsertError } = await admin.from('inactivity_reminders').upsert(upserts);
        if (upsertError) throw new Error(upsertError.message);
        scheduledCount += upserts.length;
      }
    }

    return json(200, {
      ok: true,
      sent: sentCount,
      undelivered: failedCount,
      usersScheduled: scheduledCount,
      staleSubscriptionsRemoved: prunedSubscriptions,
    });
  } catch (error) {
    console.error('[dispatch-inactivity-reminders]', error);
    return json(500, { error: error instanceof Error ? error.message : 'Dispatch failed' });
  }
});
