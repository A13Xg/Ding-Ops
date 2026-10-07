const USERNAME_CHARS = /^[a-zA-Z0-9_ -]+$/;

export function normalizeDingUsername(value) {
  const username = String(value ?? '').trim();
  if (username.length < 2 || username.length > 32 || !USERNAME_CHARS.test(username)) {
    throw new Error('Username must be 2-32 letters, numbers, spaces, underscores, or hyphens');
  }
  return username;
}

export function syntheticAuthEmail(value) {
  const username = normalizeDingUsername(value).toLowerCase();
  const bytes = new TextEncoder().encode(username);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `u-${encoded}@ding-ops.dev`;
}
