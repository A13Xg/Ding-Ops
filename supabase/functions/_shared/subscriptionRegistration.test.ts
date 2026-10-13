import { assertEquals } from 'jsr:@std/assert@1.0.19';
import { registrationLiveness } from './subscriptionRegistration.ts';

const existing = {
  user_id: 'user-a',
  p256dh: 'key-a',
  auth: 'auth-a',
  failure_count: 7,
  unacked_count: 4,
  last_success_at: '2026-10-13T10:00:00Z',
  last_ack_at: '2026-10-13T10:01:00Z',
};

Deno.test('routine DING push re-registration preserves liveness evidence', () => {
  assertEquals(registrationLiveness(existing, 'user-a', 'key-a', 'auth-a'), {
    identityChanged: false,
    failure_count: 7,
    unacked_count: 4,
    last_success_at: '2026-10-13T10:00:00Z',
    last_ack_at: '2026-10-13T10:01:00Z',
  });
});

Deno.test('account or key changes reset inherited DING push liveness', () => {
  for (const [userId, p256dh, auth] of [
    ['user-b', 'key-a', 'auth-a'],
    ['user-a', 'key-b', 'auth-a'],
    ['user-a', 'key-a', 'auth-b'],
  ] as const) {
    assertEquals(registrationLiveness(existing, userId, p256dh, auth), {
      identityChanged: true,
      failure_count: 0,
      unacked_count: 0,
      last_success_at: null,
      last_ack_at: null,
    });
  }
});

Deno.test('new DING push endpoints start with clean liveness', () => {
  assertEquals(registrationLiveness(null, 'user-a', 'key-a', 'auth-a'), {
    identityChanged: true,
    failure_count: 0,
    unacked_count: 0,
    last_success_at: null,
    last_ack_at: null,
  });
});
