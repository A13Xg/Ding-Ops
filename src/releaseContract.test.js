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
    expect(configured.every(item => item.verifyJwt === false)).toBe(true);
  });

  it('keeps user/admin Edge authorization explicit in function code', () => {
    const userFunctions = [
      'delete-account/index.ts',
      'notify-event/index.ts',
      'reconcile-achievements/index.ts',
      'register-push-subscription/index.ts',
    ];
    for (const relative of userFunctions) {
      const content = read(`supabase/functions/${relative}`);
      expect(content).toContain('auth.getUser()');
    }

    for (const relative of [
      'admin-status/index.ts',
      'broadcast-test-notification/index.ts',
      'admin-set-password/index.ts',
      'push-delivery-report/index.ts',
      'admin-discord-settings/index.ts',
      'discord-test-notification/index.ts',
    ]) {
      const content = read(`supabase/functions/${relative}`);
      expect(content).toContain('requireAdmin');
    }
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
  it('disables direct Supabase Auth signup in production config', () => {
    const config = read('supabase/config.toml');
    const deploy = read('.github/workflows/deploy.yml');

    expect(config).toMatch(/\[auth\][\s\S]*?enable_signup\s*=\s*false/);
    expect(config).toMatch(/\[auth\.email\][\s\S]*?enable_signup\s*=\s*false/);
    expect(config).toMatch(/\[auth\.sms\][\s\S]*?enable_signup\s*=\s*false/);
    expect(config).toContain('enable_anonymous_sign_ins = false');
    expect(deploy).toContain('https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth');
    expect(deploy).toContain('\"disable_signup\":true');
    expect(deploy).toContain('\"external_anonymous_users_enabled\":false');
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
    expect(config).toMatch(/\[functions\.admin-status\][\s\S]*?verify_jwt\s*=\s*false/);
  });

  it('keeps the production deployment sequence singular and ordered', () => {
    const deploy = read('.github/workflows/deploy.yml');
    const count = token => deploy.split(token).length - 1;

    expect(count('supabase link --project-ref')).toBe(1);
    expect(count('supabase db push --linked --include-all --dry-run')).toBe(1);
    expect(count('supabase db push --linked --include-all --yes')).toBe(1);
    expect(count('supabase functions deploy --use-api --prune --project-ref')).toBe(1);
    expect(count('actions/deploy-pages@v4')).toBe(1);
    expect(count('Lock down public Supabase Auth signup')).toBe(1);
    expect(count('Ensure dedicated DING Supabase API keys')).toBe(1);

    const apiKeys = deploy.indexOf('Ensure dedicated DING Supabase API keys');
    const link = deploy.indexOf('supabase link --project-ref');
    const auth = deploy.indexOf('Lock down public Supabase Auth signup');
    const preview = deploy.indexOf('supabase db push --linked --include-all --dry-run');
    const migrations = deploy.indexOf('supabase db push --linked --include-all --yes');
    const functions = deploy.indexOf('supabase functions deploy --use-api --prune --project-ref');
    const smoke = deploy.indexOf('npm run test:integration');
    const retireLegacy = deploy.indexOf('Disable legacy Supabase API keys after modern-key smoke passes');
    const build = deploy.lastIndexOf('npm run build');
    const pages = deploy.indexOf('actions/deploy-pages@v4');

    expect(apiKeys).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(apiKeys);
    expect(auth).toBeGreaterThan(link);
    expect(preview).toBeGreaterThan(auth);
    expect(migrations).toBeGreaterThan(preview);
    expect(functions).toBeGreaterThan(migrations);
    expect(smoke).toBeGreaterThan(functions);
    expect(retireLegacy).toBeGreaterThan(smoke);
    expect(build).toBeGreaterThan(retireLegacy);
    expect(pages).toBeGreaterThan(build);
  });

  it('uses API bundling and pruning for canonical modules imported from outside supabase/', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).toContain('supabase functions deploy --use-api --prune --project-ref');
    expect(read('supabase/functions/reconcile-achievements/index.ts')).toContain('../../../src/dingAchievements.js');
    expect(read('supabase/functions/_shared/push.ts')).toContain('../../../src/fetchAllPages.js');
  });

  it('keeps standalone live smoke singular, pinned to the named DING browser key, and safety-gated', () => {
    const workflow = read('.github/workflows/live-smoke.yml');
    const count = token => workflow.split(token).length - 1;

    expect(count('- name: Verify linked DING backend')).toBe(1);
    expect(count('/api-keys?reveal=true')).toBe(1);
    expect(count('item?.name === "ding-web"')).toBe(1);
    expect(workflow).toContain("grep -Eq '^[a-z0-9]+
  it('hard-refuses the known Bust production Supabase project', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).toContain('yuorggekucycvxrtqvvp');
    expect(deploy).toContain('Refusing to deploy DING into the known Bust production Supabase project');
  });

  it('retires deprecated Supabase API keys only after modern-key live verification', () => {
    const deploy = read('.github/workflows/deploy.yml');
    const smoke = deploy.indexOf('npm run test:integration');
    const retire = deploy.indexOf('/api-keys/legacy?enabled=false');
    expect(smoke).toBeGreaterThan(-1);
    expect(retire).toBeGreaterThan(smoke);
    expect(deploy).toContain('modern DING keys already passed the live smoke');
  });

  it('hard-refuses Bust production in every unattended maintenance path', () => {
    const scheduled = read('.github/workflows/scheduled-maintenance.yml');
    const bustRef = 'yuorggekucycvxrtqvvp';
    const refusal = 'Refusing to run DING maintenance against the known Bust production Supabase project.';

    expect(scheduled.split(bustRef).length - 1).toBe(2);
    expect(scheduled.split(refusal).length - 1).toBe(2);
  });

  it('keeps production setup to the five intended required secrets', () => {
    const deploy = read('.github/workflows/deploy.yml');
    const scheduled = read('.github/workflows/scheduled-maintenance.yml');

    for (const name of [
      'SUPABASE_ACCESS_TOKEN',
      'SUPABASE_DB_PASSWORD',
      'SUPABASE_PROJECT_REF',
      'VAPID_KEYS_JSON',
      'DING_INVITE_CODE',
    ]) {
      expect(deploy).toContain(`secrets.${name}`);
    }
    expect(deploy).not.toContain('secrets.REMINDER_CRON_SECRET');
    expect(deploy).not.toContain('secrets.VAPID_PUBLIC_KEY');
    expect(deploy).not.toContain('secrets.VAPID_PRIVATE_KEY');
    expect(scheduled).not.toContain('SUPABASE_SECRET_KEY');
    expect(scheduled).not.toContain('Authorization: Bearer');
    expect(scheduled).toContain('ding-cron-v1:');
    expect(scheduled).toContain('x-cron-secret: $cron_secret');
    expect(deploy).toContain('"REMINDER_CRON_SECRET=$REMINDER_CRON_SECRET"');
  });

  it('authenticates formatter-triggered CI dispatches', () => {
    const formatter = read('.github/workflows/format-ding-social-once.yml');
    expect(formatter).toContain('actions: write');
    expect(formatter).toContain('GH_TOKEN: ${{ github.token }}');
    expect(formatter).toContain('gh workflow run ci.yml --ref main');
  });

  it('never enables visual demo mode in production deployment', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).not.toMatch(/VITE_DEMO_MODE\s*:/);
    expect(deploy).toContain('SUPABASE_PROJECT_REF');
    expect(deploy).toContain('/api-keys?reveal=true');
    expect(deploy).toContain('"name":"ding-web"');
    expect(deploy).toContain('"name":"ding-edge"');
    expect(deploy).toContain('"role":"service_role"');
    expect(deploy).toContain('VITE_SUPABASE_PUBLISHABLE_KEY=$publishable');
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

  it('constrains notification navigation and delivery acknowledgements', () => {
    const worker = read('public/sw.js');
    expect(worker).toContain('function safeAppUrl');
    expect(worker).toContain('target.origin !== scope.origin');
    expect(worker).toContain('target.pathname.startsWith(prefix)');
    expect(worker).toContain('function safeAckUrl');
    expect(worker).toContain("target.protocol !== 'https:'");
    expect(worker).toContain("target.pathname.endsWith('/functions/v1/ack-push')");
    expect(worker).toContain('const target = safeAppUrl');
    expect(worker).toContain('const ackUrl = safeAckUrl');
  });

  it('pins public-schema creation privileges away from browser roles', () => {
    const schema = read('supabase/migrations/20261005230000_core_ding_domain.sql').toLowerCase();
    expect(schema).toContain('revoke create on schema public from public, anon, authenticated');
    expect(schema).toContain('grant usage on schema public to anon, authenticated');
  });

  it('does not expose internal signup failures to unauthenticated callers', () => {
    const signup = read('supabase/functions/signup-account/index.ts');
    expect(signup).toContain("console.error('[signup-account]', error)");
    expect(signup).toContain("return json(500, { error: 'Account creation failed' })");
    expect(signup).not.toContain('return json(500, { error: error instanceof Error ? error.message');
  });

  it('keeps unexpected user-facing Edge failures opaque while logging server details', () => {
    const expectations = [
      ['signup-account/index.ts', 'Account creation failed'],
      ['delete-account/index.ts', 'Account deletion failed'],
      ['notify-event/index.ts', 'Notification dispatch failed'],
      ['reconcile-achievements/index.ts', 'Reconciliation failed'],
      ['register-push-subscription/index.ts', 'Push registration failed'],
    ];
    for (const [relative, publicMessage] of expectations) {
      const content = read(`supabase/functions/${relative}`);
      expect(content).toContain('console.error');
      expect(content).toContain(publicMessage);
      expect(content).not.toMatch(/json\(500,\s*\{\s*error:\s*(?:error|\(error as Error\))/);
      expect(content).not.toMatch(/JSON\.stringify\(\{\s*error:\s*error instanceof Error/);
    }
  });

  it('announces newly persisted achievement bursts server-side, including synchronized remote awards', () => {
    const reconcile = read('supabase/functions/reconcile-achievements/index.ts');
    const app = read('src/DingApp.jsx');
    expect(reconcile).toContain("import { announceAchievement } from '../_shared/announce.ts'");
    expect(reconcile).toContain('insertedRows.map(row => announceAchievement(admin, row))');
    expect(app).not.toContain("notifyEvent('achievement'");
  });

  it('does not age healthy push endpoints when delivery receipt logging failed', () => {
    const push = read('supabase/functions/_shared/push.ts');
    expect(push).toContain('let ackReceiptsPersisted = accepted.length === 0');
    expect(push).toContain('if (ackReceiptsPersisted)');
    expect(push.indexOf('if (ackReceiptsPersisted)')).toBeLessThan(push.indexOf("admin.rpc('mark_push_sent'"));
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
  });
  it('prefers modern Supabase Edge publishable/secret keys over deprecated legacy keys', () => {
    const helper = read('supabase/functions/_shared/supabaseKeys.ts');
    expect(helper).toContain('SUPABASE_PUBLISHABLE_KEYS');
    expect(helper).toContain('SUPABASE_SECRET_KEYS');
    expect(helper.indexOf('SUPABASE_PUBLISHABLE_KEYS')).toBeLessThan(helper.indexOf('SUPABASE_ANON_KEY'));
    expect(helper.indexOf('SUPABASE_SECRET_KEYS')).toBeLessThan(helper.indexOf('SUPABASE_SERVICE_ROLE_KEY'));
  });

  it('centralizes deprecated Edge-key fallback in one compatibility helper', () => {
    const functionFiles = filesUnder('supabase/functions', path => path.endsWith('.ts')).filter(
      path => path !== 'supabase/functions/_shared/supabaseKeys.ts'
    );

    for (const path of functionFiles) {
      const content = read(path);
      expect(content, `${path} directly reads deprecated SUPABASE_ANON_KEY`).not.toContain(
        "Deno.env.get('SUPABASE_ANON_KEY')"
      );
      expect(content, `${path} directly reads deprecated SUPABASE_SERVICE_ROLE_KEY`).not.toContain(
        "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')"
      );
    }
  });
});
");
    expect(workflow).toContain('yuorggekucycvxrtqvvp');
    expect(workflow).toContain('DING_INVITE_CODE must be at least 24 characters');
    expect(workflow).toContain('Named ding-web publishable key was not found. Run Deploy DING first.');
  });

  it('hard-refuses the known Bust production Supabase project', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).toContain('yuorggekucycvxrtqvvp');
    expect(deploy).toContain('Refusing to deploy DING into the known Bust production Supabase project');
  });

  it('retires deprecated Supabase API keys only after modern-key live verification', () => {
    const deploy = read('.github/workflows/deploy.yml');
    const smoke = deploy.indexOf('npm run test:integration');
    const retire = deploy.indexOf('/api-keys/legacy?enabled=false');
    expect(smoke).toBeGreaterThan(-1);
    expect(retire).toBeGreaterThan(smoke);
    expect(deploy).toContain('modern DING keys already passed the live smoke');
  });

  it('keeps production setup to the five intended required secrets', () => {
    const deploy = read('.github/workflows/deploy.yml');
    const scheduled = read('.github/workflows/scheduled-maintenance.yml');

    for (const name of [
      'SUPABASE_ACCESS_TOKEN',
      'SUPABASE_DB_PASSWORD',
      'SUPABASE_PROJECT_REF',
      'VAPID_KEYS_JSON',
      'DING_INVITE_CODE',
    ]) {
      expect(deploy).toContain(`secrets.${name}`);
    }
    expect(deploy).not.toContain('secrets.REMINDER_CRON_SECRET');
    expect(deploy).not.toContain('secrets.VAPID_PUBLIC_KEY');
    expect(deploy).not.toContain('secrets.VAPID_PRIVATE_KEY');
    expect(scheduled).not.toContain('SUPABASE_SECRET_KEY');
    expect(scheduled).not.toContain('Authorization: Bearer');
    expect(scheduled).toContain('ding-cron-v1:');
    expect(scheduled).toContain('x-cron-secret: $cron_secret');
    expect(deploy).toContain('"REMINDER_CRON_SECRET=$REMINDER_CRON_SECRET"');
  });

  it('never enables visual demo mode in production deployment', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).not.toMatch(/VITE_DEMO_MODE\s*:/);
    expect(deploy).toContain('SUPABASE_PROJECT_REF');
    expect(deploy).toContain('/api-keys?reveal=true');
    expect(deploy).toContain('"name":"ding-web"');
    expect(deploy).toContain('"name":"ding-edge"');
    expect(deploy).toContain('"role":"service_role"');
    expect(deploy).toContain('VITE_SUPABASE_PUBLISHABLE_KEY=$publishable');
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

  it('constrains notification navigation and delivery acknowledgements', () => {
    const worker = read('public/sw.js');
    expect(worker).toContain('function safeAppUrl');
    expect(worker).toContain('target.origin !== scope.origin');
    expect(worker).toContain('target.pathname.startsWith(prefix)');
    expect(worker).toContain('function safeAckUrl');
    expect(worker).toContain("target.protocol !== 'https:'");
    expect(worker).toContain("target.pathname.endsWith('/functions/v1/ack-push')");
    expect(worker).toContain('const target = safeAppUrl');
    expect(worker).toContain('const ackUrl = safeAckUrl');
  });

  it('pins public-schema creation privileges away from browser roles', () => {
    const schema = read('supabase/migrations/20261005230000_core_ding_domain.sql').toLowerCase();
    expect(schema).toContain('revoke create on schema public from public, anon, authenticated');
    expect(schema).toContain('grant usage on schema public to anon, authenticated');
  });

  it('does not expose internal signup failures to unauthenticated callers', () => {
    const signup = read('supabase/functions/signup-account/index.ts');
    expect(signup).toContain("console.error('[signup-account]', error)");
    expect(signup).toContain("return json(500, { error: 'Account creation failed' })");
    expect(signup).not.toContain('return json(500, { error: error instanceof Error ? error.message');
  });

  it('keeps unexpected user-facing Edge failures opaque while logging server details', () => {
    const expectations = [
      ['signup-account/index.ts', 'Account creation failed'],
      ['delete-account/index.ts', 'Account deletion failed'],
      ['notify-event/index.ts', 'Notification dispatch failed'],
      ['reconcile-achievements/index.ts', 'Reconciliation failed'],
      ['register-push-subscription/index.ts', 'Push registration failed'],
    ];
    for (const [relative, publicMessage] of expectations) {
      const content = read(`supabase/functions/${relative}`);
      expect(content).toContain('console.error');
      expect(content).toContain(publicMessage);
      expect(content).not.toMatch(/json\(500,\s*\{\s*error:\s*(?:error|\(error as Error\))/);
      expect(content).not.toMatch(/JSON\.stringify\(\{\s*error:\s*error instanceof Error/);
    }
  });

  it('announces newly persisted achievement bursts server-side, including synchronized remote awards', () => {
    const reconcile = read('supabase/functions/reconcile-achievements/index.ts');
    const app = read('src/DingApp.jsx');
    expect(reconcile).toContain("import { announceAchievement } from '../_shared/announce.ts'");
    expect(reconcile).toContain('insertedRows.map(row => announceAchievement(admin, row))');
    expect(app).not.toContain("notifyEvent('achievement'");
  });

  it('does not age healthy push endpoints when delivery receipt logging failed', () => {
    const push = read('supabase/functions/_shared/push.ts');
    expect(push).toContain('let ackReceiptsPersisted = accepted.length === 0');
    expect(push).toContain('if (ackReceiptsPersisted)');
    expect(push.indexOf('if (ackReceiptsPersisted)')).toBeLessThan(push.indexOf("admin.rpc('mark_push_sent'"));
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
  });
  it('prefers modern Supabase Edge publishable/secret keys over deprecated legacy keys', () => {
    const helper = read('supabase/functions/_shared/supabaseKeys.ts');
    expect(helper).toContain('SUPABASE_PUBLISHABLE_KEYS');
    expect(helper).toContain('SUPABASE_SECRET_KEYS');
    expect(helper.indexOf('SUPABASE_PUBLISHABLE_KEYS')).toBeLessThan(helper.indexOf('SUPABASE_ANON_KEY'));
    expect(helper.indexOf('SUPABASE_SECRET_KEYS')).toBeLessThan(helper.indexOf('SUPABASE_SERVICE_ROLE_KEY'));
  });

  it('centralizes deprecated Edge-key fallback in one compatibility helper', () => {
    const functionFiles = filesUnder('supabase/functions', path => path.endsWith('.ts')).filter(
      path => path !== 'supabase/functions/_shared/supabaseKeys.ts'
    );

    for (const path of functionFiles) {
      const content = read(path);
      expect(content, `${path} directly reads deprecated SUPABASE_ANON_KEY`).not.toContain(
        "Deno.env.get('SUPABASE_ANON_KEY')"
      );
      expect(content, `${path} directly reads deprecated SUPABASE_SERVICE_ROLE_KEY`).not.toContain(
        "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')"
      );
    }
  });
});
