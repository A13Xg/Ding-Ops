import { assertEquals } from 'jsr:@std/assert@1.0.19';
import {
  supabaseFunctionEnvironment,
  supabasePublishableKey,
  supabaseSecretKey,
} from './supabaseKeys.ts';

function withEnv(values: Record<string, string | null>, run: () => void) {
  const previous = new Map<string, string | undefined>();
  try {
    for (const [name, value] of Object.entries(values)) {
      previous.set(name, Deno.env.get(name));
      if (value == null) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
    run();
  } finally {
    for (const [name, value] of previous) {
      if (value == null) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
}

Deno.test('Supabase Edge key helper prefers modern named keys', () => {
  withEnv(
    {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'sb_publishable_modern' }),
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_modern' }),
      SUPABASE_ANON_KEY: 'legacy-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-service',
    },
    () => {
      assertEquals(supabasePublishableKey(), 'sb_publishable_modern');
      assertEquals(supabaseSecretKey(), 'sb_secret_modern');
      assertEquals(supabaseFunctionEnvironment(), {
        url: 'https://example.supabase.co',
        publishableKey: 'sb_publishable_modern',
        secretKey: 'sb_secret_modern',
      });
    },
  );
});

Deno.test('Supabase Edge key helper falls back to another named key when default is absent', () => {
  withEnv(
    {
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ ding: 'sb_publishable_ding' }),
      SUPABASE_SECRET_KEYS: JSON.stringify({ ding: 'sb_secret_ding' }),
      SUPABASE_ANON_KEY: null,
      SUPABASE_SERVICE_ROLE_KEY: null,
    },
    () => {
      assertEquals(supabasePublishableKey(), 'sb_publishable_ding');
      assertEquals(supabaseSecretKey(), 'sb_secret_ding');
    },
  );
});

Deno.test('Supabase Edge key helper keeps legacy fallback for local/backward compatibility', () => {
  withEnv(
    {
      SUPABASE_PUBLISHABLE_KEYS: null,
      SUPABASE_SECRET_KEYS: null,
      SUPABASE_ANON_KEY: 'legacy-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-service',
    },
    () => {
      assertEquals(supabasePublishableKey(), 'legacy-anon');
      assertEquals(supabaseSecretKey(), 'legacy-service');
    },
  );
});

Deno.test('malformed modern key dictionaries do not mask a valid legacy fallback', () => {
  withEnv(
    {
      SUPABASE_PUBLISHABLE_KEYS: '{not-json',
      SUPABASE_SECRET_KEYS: '[]',
      SUPABASE_ANON_KEY: 'legacy-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-service',
    },
    () => {
      assertEquals(supabasePublishableKey(), 'legacy-anon');
      assertEquals(supabaseSecretKey(), 'legacy-service');
    },
  );
});
