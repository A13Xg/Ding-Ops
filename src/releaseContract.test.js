import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

function filesUnder(path, predicate = () => true) {
  const base = join(root, path);
  return readdirSync(base, { withFileTypes: true }).flatMap(entry => {
    const relative = join(path, entry.name);
    if (entry.isDirectory()) return filesUnder(relative, predicate);
    return predicate(relative) ? [relative] : [];
  });
}

describe('DING release contract', () => {
  it('keeps legacy Bust identity out of active runtime and deployable backend code', () => {
    const runtimeFiles = [
      ...filesUnder(
        'src',
        path => /\.(js|jsx|css)$/.test(path) && !/\.test\./.test(path) && path !== 'src/demoBackend.js'
      ),
      ...filesUnder('public', path => /\.(js|json|webmanifest|svg)$/.test(path)),
      ...filesUnder('supabase/migrations', path => path.endsWith('.sql')),
      ...filesUnder('supabase/functions', path => /\.(ts|js|json)$/.test(path)),
    ];
    const forbidden = [
      'yuorggekucycvxrtqvvp',
      'bust4me',
      'bust-push',
      'bust-sw-version',
      'bust_haptics',
      'bitcoin_price',
      'ding4me',
    ];

    for (const path of runtimeFiles) {
      const content = read(path);
      for (const token of forbidden) {
        expect(content, `${path} contains retired token ${token}`).not.toContain(token);
      }
    }
  });

  it('declares an explicit JWT mode for every Edge Function', () => {
    const config = read('supabase/config.toml');
    const functionDirs = readdirSync(join(root, 'supabase', 'functions'), { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
      .filter(entry => existsSync(join(root, 'supabase', 'functions', entry.name, 'index.ts')))
      .map(entry => entry.name)
      .sort();
    const configured = [...config.matchAll(/^\[functions\.([^\]]+)\]\s*\nverify_jwt\s*=\s*(true|false)/gm)]
      .map(match => ({ name: match[1], verifyJwt: match[2] === 'true' }))
      .sort((a, b) => a.name.localeCompare(b.name));

    expect(configured.map(item => item.name)).toEqual(functionDirs);
    expect(configured.filter(item => !item.verifyJwt).map(item => item.name).sort()).toEqual([
      'ack-push',
      'dispatch-inactivity-reminders',
      'dispatch-push-backstop',
      'signup-account',
    ]);
  });

  it('keeps signup invite enforcement server-side', () => {
    const backend = read('src/backend.js');
    const signup = read('supabase/functions/signup-account/index.ts');
    const config = read('supabase/config.toml');
    const deploy = read('.github/workflows/deploy.yml');

    expect(backend).toContain("functions.invoke('signup-account'");
    expect(backend).not.toContain('const INVITE_CODE');
    expect(signup).toContain('DING_INVITE_CODE');
    expect(signup).toContain('admin.auth.admin.createUser');
    expect(config).toMatch(/\[functions\.signup-account\][\s\S]*?verify_jwt\s*=\s*false/);
    expect(deploy).toContain('DING_INVITE_CODE');
  });

  it('keeps the Ops console behind a server-confirmed admin capability', () => {
    const app = read('src/DingApp.jsx');
    const backend = read('src/backend.js');
    const config = read('supabase/config.toml');
    const status = read('supabase/functions/admin-status/index.ts');

    expect(app).toContain('{isAdmin && (');
    expect(app).toContain("overlay === 'ops' && isAdmin");
    expect(backend).toContain("functions.invoke('admin-status'");
    expect(status).toContain('requireAdmin');
    expect(config).toMatch(/\[functions\.admin-status\][\s\S]*?verify_jwt\s*=\s*true/);
  });

  it('never enables visual demo mode in production deployment', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).not.toMatch(/VITE_DEMO_MODE\s*:/);
    expect(deploy).toContain('VITE_SUPABASE_URL');
    expect(deploy).toContain('VITE_SUPABASE_ANON_KEY');
    expect(deploy).toContain('npm run test:integration');
  });

  it('ships every PWA icon referenced by the manifest', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest'));
    expect(manifest.name).toBe('DING');
    expect(manifest.short_name).toBe('DING');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      expect(existsSync(join(root, 'public', icon.src)), `missing manifest icon ${icon.src}`).toBe(true);
    }
  });

  it('keeps the service worker on DING-native message and asset names', () => {
    const worker = read('public/sw.js');
    expect(worker).toContain('ding-push');
    expect(worker).toContain('ding-sw-version');
    expect(worker).not.toContain('bust-push');
    expect(worker).not.toContain('bust-sw-version');
  });

  it('keeps direct browser progression writes disabled', () => {
    const schema = read('supabase/migrations/20261005230000_core_ding_domain.sql');
    expect(schema).toContain('Deliberately no browser INSERT/UPDATE policy for level_events');
    expect(schema).not.toMatch(/create\s+policy[^;]*level_events[^;]*for\s+(insert|update)/i);
    expect(schema).toContain('create or replace function public.record_ding');
  });

  it('keeps service-role and private push secrets out of VITE variables', () => {
    const env = read('.env.example');
    expect(env).not.toMatch(/VITE_.*SERVICE_ROLE/i);
    expect(env).not.toMatch(/VITE_.*PRIVATE/i);
    expect(env).toContain('VAPID_PRIVATE_KEY');
    expect(env).toContain('REMINDER_CRON_SECRET');
  });
});
