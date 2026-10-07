import { assertEquals } from 'jsr:@std/assert@1.0.19';
import { adminAllowlist, isAllowedAdmin, sha256Hex } from './adminAuth.ts';

Deno.test('admin allowlist fails closed until BROADCAST_ADMINS is explicitly configured', async () => {
  const previous = Deno.env.get('BROADCAST_ADMINS');
  try {
    Deno.env.delete('BROADCAST_ADMINS');
    assertEquals(adminAllowlist(), []);
    assertEquals(await isAllowedAdmin('user-id', 'Alex'), false);

    const usernameHash = await sha256Hex('alex');
    Deno.env.set('BROADCAST_ADMINS', usernameHash);
    assertEquals(adminAllowlist(), [usernameHash]);
    assertEquals(await isAllowedAdmin('other-id', 'Alex'), true);
    assertEquals(await isAllowedAdmin('other-id', 'NotAlex'), false);
  } finally {
    if (previous == null) Deno.env.delete('BROADCAST_ADMINS');
    else Deno.env.set('BROADCAST_ADMINS', previous);
  }
});
