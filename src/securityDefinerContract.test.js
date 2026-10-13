import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationDir = join(process.cwd(), 'supabase', 'migrations');
const sql = readdirSync(migrationDir)
  .filter(name => name.endsWith('.sql'))
  .sort()
  .map(name => readFileSync(join(migrationDir, name), 'utf8'))
  .join('\n')
  .toLowerCase();

describe('DING security definer privilege contract', () => {
  it('revokes default PUBLIC execute on every deployable security-definer function', () => {
    const functions = [...sql.matchAll(/create or replace function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)[\s\S]*?security definer/g)]
      .map(match => match[1]);

    expect(functions.length).toBeGreaterThan(0);
    for (const name of new Set(functions)) {
      expect(
        sql,
        `security-definer function ${name} must explicitly revoke default execute privileges`
      ).toMatch(new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${name}\\s*\\(`, 'i'));
    }
  });

  it('keeps browser-callable security-definer RPCs authenticated-only', () => {
    for (const name of [
      'set_active_character',
      'update_character_metadata',
      'record_ding',
      'update_level_event_note',
      'update_profile_preferences',
    ]) {
      expect(sql).toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\s*\\([^;]+?\\)\\s+to\\s+authenticated`, 'i'));
      expect(sql).not.toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\s*\\([^;]+?\\)\\s+to\\s+(anon|public)`, 'i'));
    }
  });

  it('keeps maintenance RPCs service-role-only', () => {
    for (const name of [
      'bump_push_failure',
      'mark_push_sent',
      'record_push_ack',
      'prune_dead_push_subscriptions',
      'push_subscription_health',
    ]) {
      expect(sql).toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\s*\\([^;]*?\\)\\s+to\\s+service_role`, 'i'));
      expect(sql).not.toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\s*\\([^;]*?\\)\\s+to\\s+(anon|authenticated|public)`, 'i'));
    }
  });
});
