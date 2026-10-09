import { requireAdmin } from '../_shared/adminAuth.ts';
import { corsHeaders, json } from '../_shared/push.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const auth = await requireAdmin(req, json);
    if (auth.denied) return auth.denied;
    return json(200, {
      ok: true,
      isAdmin: true,
      username: auth.context.senderName,
    });
  } catch (error) {
    console.error('[admin-status]', error);
    return json(500, { error: error instanceof Error ? error.message : 'Admin status failed' });
  }
});
