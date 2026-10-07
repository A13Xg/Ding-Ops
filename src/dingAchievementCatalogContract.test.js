import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dingAchievements } from './dingAchievements.js';

const migration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20261006212500_seed_initial_achievement_catalog.sql'),
  'utf8'
);

describe('DING achievement catalog migration contract', () => {
  it('keeps every runtime achievement ID seeded in Postgres and nothing extra', () => {
    const sqlIds = [...migration.matchAll(/\('([^']+)'\)/g)].map(match => match[1]).sort();
    const runtimeIds = dingAchievements.map(item => item.id).sort();
    expect(sqlIds).toEqual(runtimeIds);
  });

  it('keeps the catalog at production breadth', () => {
    expect(dingAchievements.length).toBe(136);
  });
});
