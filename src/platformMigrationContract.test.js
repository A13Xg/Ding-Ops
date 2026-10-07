import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(process.cwd(), 'supabase', 'migrations', '20261005233500_platform_services.sql');
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('DING platform migration contract', () => {
  it('uses DING-native event kinds throughout delivery ledgers', () => {
    expect(sql).toContain("kind text not null check (kind in ('ding', 'achievement'))");
    expect(sql).not.toContain("kind in ('bust', 'achievement')");
  });

  it('resets inactivity state from level events using DING terminology', () => {
    expect(sql).toContain('cycle_ding_at timestamptz not null');
    expect(sql).toContain('after insert on public.level_events');
    expect(sql).toContain('reset_inactivity_reminder_on_ding');
  });

  it('keeps achievement persistence client-read-only', () => {
    expect(sql).toContain('alter table public.achievements enable row level security');
    expect(sql).toContain('create policy achievements_select');
    expect(sql).not.toMatch(/create policy\s+achievements_.*insert/);
    expect(sql).not.toMatch(/create policy\s+achievement_catalog_/);
  });

  it('does not expose push subscription key material through browser RLS policies', () => {
    expect(sql).toContain('no browser policies');
    expect(sql).not.toContain('create policy push_subscriptions_select');
    expect(sql).not.toContain('create policy push_subscriptions_insert');
    expect(sql).not.toContain('create policy push_subscriptions_update');
    expect(sql).not.toContain('create policy push_subscriptions_delete');
  });

  it('keeps one push endpoint per browser and records acknowledgement liveness', () => {
    expect(sql).toContain('push_subscriptions_endpoint_key');
    expect(sql).toContain('last_ack_at timestamptz');
    expect(sql).toContain('unacked_count integer not null default 0');
    expect(sql).toContain('record_push_ack');
    expect(sql).toContain('prune_dead_push_subscriptions');
  });

  it('uses DING-specific Discord settings and ledgers', () => {
    expect(sql).toContain('ding_enabled boolean not null default true');
    expect(sql).toContain('ding_title_template text');
    expect(sql).toContain('ding_description_template text');
    expect(sql).not.toContain('bust_title_template');
  });

  it('publishes all realtime surfaces required by the social shell', () => {
    for (const table of ['profiles', 'characters', 'level_events', 'achievements']) {
      expect(sql).toContain('alter publication supabase_realtime add table public.' + table);
    }
  });
});
