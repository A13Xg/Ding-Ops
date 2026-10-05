# Bust → DING conversion ledger

This ledger distinguishes reusable infrastructure from domain-specific behavior.

| Bust concept | DING target | Status |
| --- | --- | --- |
| `bust-webapp` package | `ding-ops` | bootstrap renamed |
| Bust GitHub Pages identity | Ding-Ops identity | bootstrap renamed where copied |
| `bust-ops.dev` synthetic auth | `ding-ops.dev` | bootstrap renamed |
| Bust storage/install globals | DING namespace | bootstrap renamed for known keys |
| `busts` table | `level_events` | pending Phase 2 |
| 2-hour cooldown | atomic monotonic character level transaction | pending Phase 2 |
| `last_bust_timestamp` | active-character progression state / last Ding metadata | pending |
| environmental context | leveling context | pending |
| BTC context | remove | pending |
| location/weather/tide | remove from primary action | pending |
| Bust explosion | arcane/void level-up burst | pending |
| Bust ranks | sweaty-gamer ranks | pending |
| Bust achievements | leveling achievement catalog | pending |
| bust notification kind | `ding` | pending |
| Bust inactivity cycle | configurable leveling inactivity cycle | pending |
| Bust Discord event tokens | DING character/level tokens | pending |
| Bust analytics | leveling pace/activity/character analytics | pending |

## Rules

1. Do not perform blind global `bust → ding` replacement. Database/domain names, prose, tests, and compatibility/history references require different treatment.
2. Old SQL stays under `supabase/legacy_bust_migrations/`.
3. Every copied production URL/project identifier/storage key must be audited before release.
4. Binary Bust branding/audio assets are intentionally not transplanted. DING gets original assets.
5. The conversion is complete only after an exhaustive case-insensitive residue scan is classified item-by-item.
