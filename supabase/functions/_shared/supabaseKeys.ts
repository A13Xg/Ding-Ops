function namedKey(dictionaryName: string) {
  const raw = Deno.env.get(dictionaryName);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const preferred = parsed.default;
    if (typeof preferred === 'string' && preferred) return preferred;
    return Object.values(parsed).find(value => typeof value === 'string' && value) as string | undefined || null;
  } catch {
    return null;
  }
}

export function supabasePublishableKey() {
  return namedKey('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_ANON_KEY') || null;
}

export function supabaseSecretKey() {
  return namedKey('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || null;
}

export function supabaseFunctionEnvironment() {
  return {
    url: Deno.env.get('SUPABASE_URL') || null,
    publishableKey: supabasePublishableKey(),
    secretKey: supabaseSecretKey(),
  };
}
