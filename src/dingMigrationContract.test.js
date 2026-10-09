import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(process.cwd(), 'supabase', 'migrations', '20261005230000_core_ding_domain.sql');
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('atomic Ding migration contract', () => {
  it('makes event UUID retry idempotency precede the character mutation path', () => {
    const existingLookup = sql.indexOf('from public.level_events where id = p_event_id');
    const characterLock = sql.indexOf('where id = p_character_id for update');
    expect(existingLookup).toBeGreaterThan(-1);
    expect(characterLock).toBeGreaterThan(existingLookup);
  });

  it('re-checks event UUID after the character lock before stale-level validation', () => {
    const characterLock = sql.indexOf('where id = p_character_id for update');
    const retryLookup = sql.indexOf('from public.level_events where id = p_event_id', characterLock);
    const staleCheck = sql.indexOf('v_character.current_level <> p_expected_from_level');
    expect(characterLock).toBeGreaterThan(-1);
    expect(retryLookup).toBeGreaterThan(characterLock);
    expect(staleCheck).toBeGreaterThan(retryLookup);
  });

  it('serializes character progression and rejects genuinely stale client levels', () => {
    expect(sql).toContain('for update');
    expect(sql).toContain("raise exception 'ding_stale_level'");
    expect(sql).toContain('v_character.current_level <> p_expected_from_level');
  });

  it('pins one destination level per character and exactly one-level transitions', () => {
    expect(sql).toContain('unique (character_id, to_level)');
    expect(sql).toContain('check (to_level = from_level + 1)');
  });

  it('uses the configured server-side cap', () => {
    expect(sql).toContain("from public.game_config where id = 'current'");
    expect(sql).toContain("raise exception 'ding_max_level'");
  });

  it('does not expose direct browser progression writes', () => {
    expect(sql).not.toMatch(/create policy\s+level_events_.*insert/);
    expect(sql).not.toMatch(/create policy\s+characters_.*update/);
    expect(sql).toContain('grant execute on function public.record_ding');
  });

  it('routes mutable profile preferences through a validated RPC', () => {
    expect(sql).not.toMatch(/create policy\s+profiles_update_own\s+on public\.profiles\s+for update/);
    expect(sql).toContain('create or replace function public.update_profile_preferences');
    expect(sql).toContain("raise exception 'ding_showcase_not_earned'");
    expect(sql).toContain('grant execute on function public.update_profile_preferences');
  });

  it('updates the locked character from the inserted server event', () => {
    expect(sql).toContain('set current_level = v_event.to_level');
    expect(sql).toContain('p_event_id,v_actor,v_character.id,v_character.current_level,v_character.current_level+1');
  });
});
