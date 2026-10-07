# Active DING migrations

Only DING-native deployable SQL belongs in this directory.

Current migration set:

- `20261005230000_core_ding_domain.sql` — game config, profiles, characters, level events, RLS and atomic Ding RPCs.
- `20261005233500_platform_services.sql` — achievements, Realtime publication, push delivery/liveness, inactivity and Discord persistence.
- `20261006212500_seed_initial_achievement_catalog.sql` — runtime achievement catalog IDs.

Historical Bust SQL is isolated under `../legacy_bust_migrations/` for reference only and must never be copied or applied wholesale to the DING project.

The production `Deploy DING` workflow links the dedicated project and runs `supabase db push --linked --include-all` before deploying Edge Functions.
