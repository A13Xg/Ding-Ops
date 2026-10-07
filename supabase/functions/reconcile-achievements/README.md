# DING achievement reconciliation Edge Function

`reconcile-achievements` is the authoritative achievement evaluator for the Supabase deployment.

It authenticates the caller, then uses the service-role client to read the complete paginated DING crew state required by the catalog:

- current level cap
- profiles
- level events
- characters
- existing achievements

It imports the canonical runtime catalog and evaluator from `src/dingAchievements.js`. The function evaluates every profile in one pass so synchronized crew achievements can use the full event stream, persists only known catalog IDs, and returns the full achievement collection plus only the caller's newly-earned IDs.

This design avoids duplicating achievement rules in SQL while still preventing browser clients from forging achievement rows.

## Deploy

The production workflow deploys this automatically after migrations:

```bash
supabase functions deploy reconcile-achievements
```

Supabase provides these server-side values to deployed functions:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or any `VITE_*` variable.

## Verification

Repository checks:

1. runtime/SQL achievement catalog IDs match exactly;
2. every rule family is deterministic from persisted DING fields;
3. cross-user synchronized award fixtures use the full crew event stream;
4. duplicate `(user_id, achievement_type)` rows are prevented;
5. function code typechecks under Deno against the checked-in DING schema types.

Live-project gate:

1. direct browser inserts into `public.achievements` must fail;
2. invoke reconciliation repeatedly and confirm idempotent results;
3. create synchronized events for multiple users and confirm each qualifying user earns the expected social award;
4. test more than 1,000 events/achievements to exercise pagination;
5. call without an Authorization header and confirm HTTP 401;
6. confirm newly inserted awards appear over Realtime and unannounced rows are picked up by the scheduled backstop.

## Deployment dependency

The function imports:

- `../../../src/dingAchievements.js`
- `../../../src/fetchAllPages.js`

Deploy from the repository root so the Supabase bundler resolves the canonical modules. JWT verification is explicitly enabled in `supabase/config.toml`.
