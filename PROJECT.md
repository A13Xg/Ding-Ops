# DING — project brief

This file is the architectural source of truth for coding agents working on DING.

## 1. Product

DING is a private, mobile-first, satirical World of Warcraft leveling tracker. The interaction model deliberately preserves the strongest parts of Bust-App: one dominant action, realtime crew activity, dense progression, achievements, social profiles, analytics, mobile-first PWA behavior, push notifications, Discord mirroring, haptics, and deliberately excessive instrumentation.

The primary domain event is a **Ding**: one tracked character advances exactly one level.

The WoW level cap is configuration, not schema. Initial product configuration targets the contemporary cap used when this project was created; future expansion changes must not require schema redesign.

## 2. Source lineage

The reusable implementation baseline comes from `A13Xg/Bust-Webapp` `main` as reviewed in October 2026, including the mobile drawer/achievement/haptics work from Bust PR #12.

DING is not allowed to share:
- Supabase project identity or data
- GitHub Pages identity
- VAPID keys
- Discord settings
- local/session storage namespace
- service-worker notification tags
- synthetic auth email domain
- PWA identity/assets

Legacy Bust SQL is kept only in `supabase/legacy_bust_migrations/` as implementation reference. Never move those files wholesale into `supabase/migrations/`.

## 3. Target domain

### Profiles
One row per DING account. Usernames are immutable identities as in Bust. Profile progression/achievement XP is independent from actual WoW character level.

### Characters
A profile owns zero or more characters. Target fields include:
- id / owner
- name
- realm
- region
- class
- optional spec
- optional race
- optional faction
- current_level
- tracked_from_level
- active/archive state
- timestamps

A profile has one selected active character at a time.

### Level events
A Ding is an immutable progression event with a client-generated UUID and server-authoritative timestamp. Target fields include:
- id
- user_id
- character_id
- from_level / to_level
- timestamp / local time bucket
- optional zone
- optional activity type
- optional session duration / derived prior-level duration
- optional deaths
- optional note

## 4. Critical invariant: atomic Ding

Do not copy Bust's two-hour cooldown.

The authoritative database operation must:
1. authenticate the actor;
2. lock the character row;
3. verify ownership;
4. verify the character is below configured cap;
5. verify `to_level = current_level + 1`;
6. make a client event UUID idempotent;
7. prevent duplicate destination levels for one character;
8. use the server timestamp;
9. insert the level event and update `characters.current_level` atomically.

An uncertain network result must be recoverable by event ID before another ambiguous submission is allowed.

## 5. Architecture to preserve from Bust

Preserve/adapt rather than rewrite:
- React/Vite application shell
- Supabase backend adapter boundary
- Auth model
- RLS discipline
- Realtime feed
- achievement catalog/evaluation/reconciliation pattern
- XP/rank engine
- profiles/roster/social comparisons
- chart primitives and analytics drawer
- achievement queue/toasts
- portalled mobile drawers, focus ownership and safe-area handling
- haptics/SFX abstractions
- service-worker push delivery
- endpoint acknowledgements and ghost-endpoint rotation
- exactly-once push event ledger/backstop
- Discord webhook settings/dedupe
- inactivity scheduling
- build/version stale-PWA detection
- debug/admin tooling
- CI rigor

## 6. Configuration

Keep game configuration centralized. At minimum:
- current expansion identifier/display name
- level cap
- allowed regions
- activity types
- reminder cadence

Do not scatter literal level-cap assumptions throughout UI/rules/SQL.

## 7. Current implementation state

The DING schema and platform services are implemented under `supabase/migrations/` and the active Edge Functions are DING-native. Legacy Bust SQL remains isolated under `supabase/legacy_bust_migrations/` and must never be applied to a DING project.

The checked-in database types mirror the repository migrations so Edge Functions typecheck before a live project exists. After the dedicated DING Supabase project is linked and migrated, regenerate the types from that project and compare them against the checked-in contract.

Production deployment is intentionally credential-gated by `.github/workflows/deploy.yml`. It applies migrations before functions, configures secrets, runs the live concurrency smoke test, then deploys GitHub Pages.

The only remaining release blockers should be external project linkage/secrets and hosted/physical-device verification, not unfinished repository architecture.

## 8. Testing philosophy

Carry forward or improve Bust's tests. DING additionally requires adversarial tests for:
- concurrent Dings
- duplicate event UUID
- duplicate destination level
- out-of-order/stale client level
- max-level rejection
- retry/status-check behavior
- parallel characters
- account switching
- achievement reconciliation and announcement pacing
- synchronized cross-user achievement reconciliation
- exact reconciliation-burst sibling suppression under rapid separate Dings
- production bundle isolation from demo/legacy identity
- installed PWA push delivery and endpoint ACK recovery

## 9. Execution ledger

`ROADMAP.md` is the persistent implementation plan. Mark tasks complete as work lands and defer external/user checkpoints whenever productive local/repository work can continue.
