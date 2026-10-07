import { describe, expect, it } from 'vitest';
import { normalizeDingUsername, syntheticAuthEmail } from './authIdentity.js';

describe('DING synthetic auth identity', () => {
  it('is case-insensitive because profile usernames are case-insensitively unique', () => {
    expect(syntheticAuthEmail('Alex')).toBe(syntheticAuthEmail('  aLeX  '));
  });

  it('does not collide distinct allowed username spellings', () => {
    const values = ['Alex G', 'Alex_G', 'Alex-G', 'Alex  G', 'Alex_G-2'];
    const emails = values.map(syntheticAuthEmail);
    expect(new Set(emails).size).toBe(values.length);
  });

  it('stays within a normal email local-part length at the maximum username size', () => {
    const email = syntheticAuthEmail('A'.repeat(32));
    const [local] = email.split('@');
    expect(local.length).toBeLessThanOrEqual(64);
    expect(email).toMatch(/^[A-Za-z0-9_-]+@ding-ops\.dev$/);
  });

  it('rejects whitespace-only, too-short and unsupported usernames after trimming', () => {
    for (const value of ['  ', 'a', 'a@example', 'name%test']) {
      expect(() => normalizeDingUsername(value)).toThrow(/Username must be 2-32/);
    }
  });
});
