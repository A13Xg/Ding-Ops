import { assertEquals } from 'jsr:@std/assert@1.0.19';
import { supabasePublishableKey, supabaseSecretKey } from './supabaseKeys.ts';

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(values)) {
    previous.set(name, Deno.env.get(name));
    if (value == null) Deno.env.delete(name);
    else Deno.env.set(name, value);
  }
  try {
    fn();
  } finally {
    for (const [name, value] of previous) {
      if (value == null) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
}

Deno.test('DING Edge key helper prefers dedicated named modern keys', () => {
  withEnv(
    {
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({
        default: 'sb_publishable_default',
        'ding-web': 'sb_publishable_ding',
      }),
      SUPABASE_SECRET_KEYS: JSON.stringify({
        default: 'sb_secret_default',
        'ding-edge': 'sb_secret_ding',
      }),
      SUPABASE_PUBLISHABLE_KEY: undefined,
      SUPABASE_SECRET_KEY: undefined,
      SUPABASE_ANON_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    () => {
      assertEquals(supabasePublishableKey(), 'sb_publishable_ding');
      assertEquals(supabaseSecretKey(), 'sb_secret_ding');
    },
  );
});

Deno.test('DING Edge key helper falls back through modern then legacy single keys', () => {
  withEnv(
    {
      SUPABASE_PUBLISHABLE_KEYS: undefined,
      SUPABASE_SECRET_KEYS: undefined,
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_single',
      SUPABASE_SECRET_KEY: 'sb_secret_single',
      SUPABASE_ANON_KEY: 'legacy-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-service',
    },
    () => {
      assertEquals(supabasePublishableKey(), 'sb_publishable_single');
      assertEquals(supabaseSecretKey(), 'sb_secret_single');
    },
  );
});
