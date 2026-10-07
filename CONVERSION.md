# Bust → DING conversion ledger

This file records the completed architecture conversion and the deliberately retained lineage/reference boundaries.

| Bust concept | DING implementation | Status |
| --- | --- | --- |
| `bust-webapp` package | `ding-ops` | complete |
| Bust GitHub Pages identity | independent Ding-Ops Pages/PWA identity | complete |
| Bust synthetic auth domain | `ding-ops.dev` | complete |
| Bust storage/install/SW identifiers | DING-native namespace | complete |
| `busts` table | `level_events` | complete |
| 2-hour cooldown | atomic monotonic `record_ding` transaction | complete |
| profile cooldown timestamp | per-character current level + immutable event history | complete |
| environmental context | activity/zone/session/deaths/note leveling context | complete |
| Bitcoin/weather/tide/location telemetry | removed from active runtime | complete |
| liquid Bust explosion | arcane DING level-up burst | complete |
| Bust app ranks | DING sweaty-gamer app-XP ranks | complete |
| Bust achievement catalog | 136 DING leveling/social awards | complete |
| Bust notification kind | `ding` | complete |
| Bust inactivity cycle | explicit DING leveling inactivity cadence | complete |
| Bust Discord event tokens | DING character/level/activity tokens | complete |
| Bust analytics | DING pace/activity/character/social analytics | complete |
| inherited debug menu | DING operations console | complete |
| inherited PWA assets | original DING SVG/PNG icon family | complete |
| inherited deployment identity | dedicated credential-gated DING deploy | complete in repo; live project pending |

## Deliberately retained Bust references

The word “Bust” may remain only where it is useful and non-runtime:

1. source-lineage documentation;
2. negative regression assertions proving old identifiers are absent;
3. `supabase/legacy_bust_migrations/`, which is non-deployable historical reference.

It must not identify a production table, API route, Supabase project, notification tag, service-worker message, storage key, PWA asset, auth domain, or active UI copy.

## Conversion rules

1. Never perform a blind global rename on legacy reference material.
2. Never move legacy SQL into `supabase/migrations/`.
3. Never point DING at the Bust production Supabase project.
4. DING branding/assets are original and independent.
5. The production build is scanned for known legacy identifiers and demo fixture tokens.
6. Demo/screenshot mode must never be enabled by the production deployment workflow.

## Remaining conversion gate

The repository conversion is complete. Remaining work is environment validation:

- link the dedicated DING Supabase project;
- supply production/VAPID/cron secrets;
- run the deployment + self-cleaning live concurrency smoke test;
- validate two live accounts;
- validate installed iOS/Android PWA push behavior.
