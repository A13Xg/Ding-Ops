# DING End-to-End Roadmap

## Status legend

- [ ] Not started
- [~] In progress
- [x] Complete
- [>] Deferred intentionally; not blocking current work
- [!] Blocked on user/external dependency

## Execution rules

- Commit directly to `main`.
- Keep the app runnable at phase boundaries.
- Defer user-dependent checkpoints as long as productive work can continue without them.
- Never point DING at the Bust production backend.
- Preserve old Bust SQL only as conversion reference; active DING migrations are written cleanly from scratch.
- When a phase has a deferred external validation item, continue to later dependency-free work and return to the validation item once credentials/device access exist.
- Update this file after meaningful implementation batches so it remains the persistent execution ledger.

## 1. Repository bootstrap + source transplant — COMPLETE

- [x] Inspect `Ding-Ops`, establish `main`, and preserve existing user files.
- [x] Transplant the reusable Bust production baseline.
- [x] Exclude production Bust secrets/backend identity and binary branding/media.
- [x] Add `PROJECT.md`, `ROADMAP.md`, `.env.example`, and `CONVERSION.md`.
- [x] Rename package/PWA/storage/install/synthetic-auth namespaces.
- [x] Move old Bust SQL into `supabase/legacy_bust_migrations/` so it cannot be deployed accidentally.
- [x] Establish CI/static sanity checks.
- [x] Make DING the only application entry point; the legacy Bust application is no longer runtime-selectable.
- [x] No user checkpoint required.

## 2. Domain conversion: accounts → characters → Ding events — COMPLETE, LIVE DB VERIFICATION DEFERRED

- [x] Add first-class `characters`.
- [x] Add DING-native `level_events`.
- [x] Add active-character selection.
- [x] Support name, realm, region, class, optional spec/race/faction, current level, tracked-from level, archive state.
- [x] Centralize expansion/level-cap/activity configuration.
- [x] Replace Bust's two-hour cooldown with the atomic server-authoritative `record_ding` RPC.
- [x] Enforce ownership, row locking, monotonic `current+1`, max-level protection, UUID idempotency, duplicate-destination protection, and server timestamps.
- [x] Preserve pending-event save/check/retry recovery using the exact same UUID.
- [x] Add pure/static migration-contract and pending-event tests.
- [>] Run true concurrent database tests once a DING Supabase project is linked. This does not block frontend/domain work.

## 3. Supabase project + DING platform schema — IN PROGRESS

### Repository work
- [x] Create DING-native core schema migrations from scratch.
- [x] Create `profiles`, `characters`, `level_events`, and `game_config`.
- [x] Add DING RLS/RPC foundations.
- [x] Add achievement persistence schema.
- [x] Add push subscriptions, exactly-once event ledger, delivery acknowledgements, and liveness helpers.
- [x] Add inactivity reminder state using Ding terminology.
- [x] Add Discord settings/event ledgers using Ding terminology.
- [x] Add Realtime publication declarations for profiles/characters/level events/achievements.
- [~] Translate inherited Edge Functions from Bust rows/event kinds to DING rows/event kinds.
- [ ] Replace inherited generated Bust database typings with DING schema typings.
- [ ] Add integration fixtures/scripts for a linked Supabase project.

### USER CHECKPOINT — DEFERRED UNTIL NEEDED
- [>] Create/link a dedicated DING Supabase project.
- [>] Add GitHub secrets:
  - `SUPABASE_ACCESS_TOKEN`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- [>] Disable email confirmation for synthetic username-based auth.
- [>] Apply migrations and regenerate database types.
- [>] Run live concurrency/RLS/RPC verification.

This checkpoint is intentionally deferred while repository-only work can continue.

## 4. Primary DING vertical slice — IN PROGRESS

- [x] Login/signup UI using DING identity.
- [x] Character creation UI.
- [x] Active-character selection.
- [x] Full-screen DING dashboard.
- [x] Arcane charge → save → level-up burst interaction.
- [x] Server-RPC Ding submission path.
- [x] Pending save/status/retry recovery.
- [x] Realtime subscription adapter for profiles/characters/level events.
- [x] Activity feed.
- [x] Level-event detail surface.
- [x] Post-Ding note editing.
- [x] Max-level action state.
- [x] Basic DING analytics surface.
- [ ] Wire achievement evaluation/reconciliation into a successful Ding.
- [ ] Wire DING/achievement realtime toasts and announcements into the new shell.
- [ ] Add first-run/empty-character onboarding polish.
- [ ] Add robust account/profile surface to the DING shell.
- [>] USER CHECKPOINT: real two-account Supabase smoke test once Phase 3 credentials are available.

## 5. WoW visual system — PARTIAL

- [x] Establish slate/blue/purple DING shell palette.
- [x] Add an original DING SVG logo placeholder/working asset.
- [x] Add arcane level-up burst instead of the Bust liquid explosion for the primary DING flow.
- [~] Convert shared design tokens away from orange/milk assumptions.
- [ ] Replace/generated PWA icon family with final DING artwork.
- [ ] Retheme shared badges, rank shimmer, drawer chrome, profile surfaces, empty states and debug tools.
- [ ] Audit narrow-phone/tablet/desktop behavior.
- [ ] Preserve PR #12 behavior: portalled drawers, reachable X, backdrop dismissal, focus ownership, safe areas, centered award cards, stable particles, haptics and reduced-motion handling.

## 6. Full copy/verbiage conversion — NOT STARTED AS A COMPLETE PASS

- [ ] Exhaustive source scan for `Bust`, `BUST`, `bust`, `busts`, old URLs, storage keys, notification tags, synthetic domains and old SQL/function names.
- [ ] Classify every remaining occurrence as remove/translate/reference-only.
- [ ] Rewrite UI/system/error/empty-state copy into varied WoW/sweaty-gamer language.
- [ ] Build deterministic DING notification catalogs.
- [ ] Remove old location/weather/tide/Bitcoin copy and runtime dependencies from the shipped app.

## 7. Achievement/progression rebuild

- [ ] Preserve catalog/tier/points/reconciliation/showcase/history/comparison architecture.
- [ ] Replace the Bust catalog with roughly equivalent breadth (~132 awards) focused on leveling.
- [ ] Add families for level milestones, pace, late-night, streaks, dungeons, delves, questing, zones, alts, deaths, group synchronicity, calendars, notes and max-level/meta behavior.
- [ ] Ensure every rule is computable from persisted DING data.
- [ ] Preserve all-awards-persisted / one-achievement-announcement-per-Ding behavior.
- [ ] Add deterministic tests for every rule family.

## 8. Profiles, roster, characters and social comparison

- [ ] Separate player profile from WoW characters in all surfaces.
- [ ] Show active/main character prominently.
- [ ] Expose tracked alts.
- [ ] Port roster/guild-style list.
- [ ] Port recent activity, badge showcase, earned history and comparisons.
- [ ] Preserve realtime profile/award updates.

## 9. Analytics conversion

- [~] Basic DING analytics shell exists.
- [ ] Preserve/refactor reusable chart primitives.
- [ ] Group Dings / active grinders / today / rank.
- [ ] 30-day trend, daypart share, hour histogram, weekly volume and heatmap.
- [ ] Minutes-per-level and pace trends.
- [ ] Activity-type distribution.
- [ ] Character contribution.
- [ ] App-XP ranking.
- [ ] Fastest/slowest level, most levels/day, longest streak, late-night records and death records where data exists.
- [ ] Remove charts whose source fields no longer exist; never fabricate metrics.

## 10. Push notifications

- [~] DING-native database schema/ledger exists.
- [ ] Translate client event kinds/tags/copy from `bust` to `ding`.
- [ ] Translate Edge Function dispatch and backstop logic.
- [ ] Preserve VAPID validation, service-worker delivery, ack receipts, ghost-endpoint rotation and delivery diagnostics.
- [ ] Preserve exactly-once behavior and achievement announcement pacing.

### USER CHECKPOINT — DEFERRED
- [>] Generate/add:
  - `VITE_WEB_PUSH_PUBLIC_KEY`
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`
  - `REMINDER_CRON_SECRET`
  - optional `BROADCAST_ADMINS`

## 11. Discord

- [~] DING-native persistence schema exists.
- [ ] Translate Edge Functions and browser admin UI.
- [ ] Add tokens: USER, CHARACTER, LEVEL, CLASS, SPEC, REALM, ZONE, ACTIVITY, NOTE, DATE, TIME, ACHIEVEMENT, TIER, POINTS, PUSH_TITLE, PUSH_BODY.
- [ ] Preserve independent dedupe/retry behavior.
- [>] USER CHECKPOINT: optional webhook URL after the integration is ready.

## 12. Inactivity / re-engagement

- [~] DING-native reminder persistence/reset trigger exists.
- [ ] Move cadence into explicit configuration.
- [ ] Translate scheduling code and Edge Function fields from Bust terminology.
- [ ] Rewrite weighted message catalog around leveling inactivity.
- [ ] Preserve failed-attempt cycle-advance behavior.

## 13. PWA / install / versioning

- [x] Independent DING manifest identity established.
- [x] DING storage/install namespace begun.
- [ ] Complete service-worker tag/copy audit.
- [ ] Generate final icon family.
- [ ] Verify stale-build banner and update flow.
- [ ] Verify iOS install/push constraints with DING copy.
- [>] USER CHECKPOINT: installed iOS/Android validation once a hosted build exists.

## 14. Battle.net integration boundary

- [ ] Add provider-neutral character import adapter/DTO.
- [ ] Keep manual characters fully functional and authoritative.
- [ ] Add Battle.net OAuth/profile provider only after core product stability.
- [>] USER CHECKPOINT: Battle.net client ID/secret only if this optional integration is enabled.

## 15. Debug/admin tooling

- [ ] Convert Bust debug menu to DING.
- [ ] Simulated characters/Dings/app-XP/achievements.
- [ ] Push diagnostics/device rotation.
- [ ] Account admin tools.
- [ ] Discord preview/settings.
- [ ] Delivery log.
- [ ] Keep sandbox mutations isolated from real crew state.

## 16. CI/CD + GitHub Pages

- [x] Baseline CI workflow transplanted.
- [ ] Ensure CI reflects only active DING code and DING Edge Functions.
- [ ] Restore/enable deployment workflow only after Supabase project identity is known.
- [ ] Migration-before-function deployment.
- [ ] DING GitHub Pages build/deploy.
- [ ] Remove all Bust production refs.
- [>] USER CHECKPOINT: GitHub Pages source/settings and final deployment secrets.

## 17. Full adversarial audit

- [ ] Compare DING against current Bust `main`, especially PR #12 behavior.
- [ ] Exhaustive Bust-residue classification.
- [ ] Concurrency/retry/data-integrity tests.
- [ ] Push and achievement dedupe audit.
- [ ] Narrow phone/tablet/desktop responsive checks.
- [ ] Accessibility/focus/reduced-motion checks.
- [ ] Security/RLS/schema review.
- [ ] Run lint, format, browser typecheck, Deno lint/typecheck/tests, Vitest and production build.
- [ ] Fix all Critical/Major findings.
- [ ] Repeat the audit from scratch after fixes.

## 18. Physical-device release gate

- [>] USER CHECKPOINT: pull `main` and run the final desktop + installed-phone verification matrix.
- [ ] Fix discovered release issues.
- [ ] Repeat until release-ready.
