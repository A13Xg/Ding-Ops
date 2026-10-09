# DING End-to-End Roadmap

## Status legend

- [ ] Not started
- [~] In progress
- [x] Complete in repository
- [>] Deferred intentionally / optional
- [!] Blocked on external credential, hosted environment, or physical-device access

## Execution rules

- Commit directly to `main`.
- Keep the application runnable at phase boundaries.
- Defer external/user checkpoints while repository-only work remains.
- Never point DING at the Bust production backend.
- Keep legacy Bust SQL reference-only under `supabase/legacy_bust_migrations/`.
- Do not declare live reliability until the linked Supabase and physical-device gates pass.
- This file is the persistent execution ledger.

---

## 1. Repository bootstrap + source transplant — COMPLETE

- [x] Establish `Ding-Ops` on `main`.
- [x] Preserve the reusable mature Bust architecture without sharing production identity/data.
- [x] Rename package, auth namespace, PWA identity, service-worker tags and storage identity.
- [x] Separate deployable DING migrations from legacy reference migrations.
- [x] Add `PROJECT.md`, `ROADMAP.md`, `CONVERSION.md`, `.env.example`.
- [x] Make DING the only runtime application.
- [x] Remove retired Bust-only frontend/runtime modules.

## 2. DING domain + atomic progression — COMPLETE, LIVE DB TEST BLOCKED

- [x] First-class profiles, characters and level events.
- [x] Active-character selection.
- [x] Character metadata: name, realm, region, class, optional spec/race/faction, current/tracked-from level, archive state.
- [x] Central client game configuration and authoritative DB level cap.
- [x] Replace Bust cooldown with `record_ding`.
- [x] Server auth, character row lock, ownership check, archive check, cap check and expected-current-level check.
- [x] Exactly +1 destination invariant.
- [x] Client UUID idempotency.
- [x] Unique character/destination-level protection.
- [x] Server timestamp/local-date/hour/daypart derivation.
- [x] Atomic event insert + character level update.
- [x] Narrow note-edit RPC.
- [x] Pending-event save/check/same-UUID retry recovery.
- [x] Static migration and domain tests.
- [!] Live concurrent Postgres/RLS/RPC verification requires linked DING Supabase. Automated smoke test is already committed.

## 3. DING Supabase platform — REPOSITORY COMPLETE, EXTERNAL LINKAGE BLOCKED

- [x] DING-native schema written from scratch.
- [x] RLS foundations.
- [x] Realtime publication for profiles, characters, level events and achievements.
- [x] Achievement persistence/catalog.
- [x] Push subscriptions, event ledger, delivery receipts and liveness helpers.
- [x] Inactivity reminder persistence/reset.
- [x] Discord settings + independent event ledger.
- [x] DING database typings checked into Edge Function build.
- [x] DING-native Edge Functions:
  - reconciliation
  - event announce
  - push registration/ACK
  - push backstop
  - inactivity dispatch
  - push delivery report
  - admin broadcast
  - admin password reset
  - account deletion
  - Discord settings/test
- [x] Live integration script creates two invite-gated disposable accounts/characters; validates RLS/ownership, Realtime, UUID idempotency, concurrent Dings, notes, synchronized achievements, profile-showcase integrity and admin fail-closed behavior; then self-deletes.
- [x] Manual rerunnable `DING Live Smoke` workflow.
- [!] Create/link dedicated DING Supabase project.
- [!] Add required GitHub/Supabase credentials.
- [!] Apply migrations/deploy functions and run live smoke.

## 4. Primary vertical slice — COMPLETE, HOSTED TWO-ACCOUNT TEST BLOCKED

- [x] Login/signup.
- [x] First-run onboarding.
- [x] Character creation/select/edit/archive.
- [x] Full-screen DING dashboard.
- [x] Arcane charge/save/level-up interaction.
- [x] Haptics.
- [x] Optional activity/zone/session/death context.
- [x] Pending confirmation recovery.
- [x] Realtime profile/character/Ding/achievement updates.
- [x] Activity feed and level detail.
- [x] Post-Ding note editing.
- [x] Max-level state.
- [x] Realtime remote Ding/award toasts.
- [x] Successful Ding notification and achievement side effects are post-commit and cannot falsify persistence.
- [x] Two-account hosted behavior is covered by the credential-gated live smoke workflow; execution remains blocked only until the backend/secrets exist.

## 5. Visual system + mobile behavior — REPOSITORY COMPLETE, PHYSICAL QA BLOCKED

- [x] Slate/blue/purple/arcane DING design system.
- [x] Original DING logo/icon/badge SVGs.
- [x] Generated PNG favicon/touch/PWA/maskable/badge family.
- [x] DING-native shared CSS; old 64 KB Bust stylesheet removed.
- [x] Arcane level burst; old liquid/explosion runtime removed.
- [x] DING award/rank visuals and mythic shimmer.
- [x] Profile, crew, analytics, admin, onboarding and empty-state styling.
- [x] Mobile portalled drawers.
- [x] Reachable persistent X outside drawer scroll content.
- [x] Backdrop dismissal, Escape, body-scroll lock, focus return/trapping and safe areas.
- [x] Centered constrained mobile achievement cards.
- [x] Reduced-motion behavior.
- [x] Automated desktop Chrome and iPhone/WebKit screenshots.
- [!] Physical narrow-phone/tablet/desktop review after hosted deployment.

## 6. Copy + legacy-residue conversion — COMPLETE

- [x] Exhaustive search for Bust runtime/backend/storage/push identity.
- [x] Old Bust project ref absent.
- [x] Old invite code absent.
- [x] Old notification/service-worker/storage identifiers absent.
- [x] Weather/tide/Bitcoin/location telemetry removed from active runtime.
- [x] Legacy occurrences classified as source-lineage docs, negative regression assertions, or files under `supabase/legacy_bust_migrations/`.
- [x] Sweaty-WoW copy throughout active user surfaces.
- [x] Release-contract tests prevent major legacy identity from returning.
- [x] Production bundle scan prevents known legacy/development identifiers from shipping.

## 7. Achievement + progression rebuild — COMPLETE, LIVE RECONCILIATION TEST BLOCKED

- [x] Tier/points/catalog/reconciliation/showcase/history architecture.
- [x] **136** DING achievements at production breadth.
- [x] Volume milestones.
- [x] Configured-cap and level milestones.
- [x] Daily-volume and calendar-day streak families.
- [x] Late-night/early-morning/daypart families.
- [x] Questing/dungeon/delve/PvP/grinding/campaign/profession/other families.
- [x] Pace/session-time families.
- [x] Death/flawless families.
- [x] Alt/class/realm/faction/zone families.
- [x] Note/weekend/active-day families.
- [x] Max-level-character families.
- [x] Synchronized two-/three-/four-player Ding awards.
- [x] All criteria derive from persisted DING fields.
- [x] Full-crew reconciliation supports cross-user synchronized awards.
- [x] All awards persist; mobile push is capped to one award per exact reconciliation burst.
- [x] Exact sibling-burst retirement prevents rapid separate Dings from suppressing one another.
- [x] SQL/runtime catalog parity test.
- [x] Rule-family unit coverage.
- [!] Validate reconciliation and concurrent inserts against live Supabase.

## 8. Profiles, roster, characters + social comparison — COMPLETE

- [x] Player profile separate from WoW characters.
- [x] Active character prominent.
- [x] Tracked alts exposed.
- [x] Character edit/archive management.
- [x] Guild/crew-style roster.
- [x] Profile tagline/avatar identity.
- [x] Award showcase.
- [x] Recent Dings and recent awards.
- [x] Shared/theirs-only/yours-only achievement comparisons.
- [x] DING app-XP rank ladder.
- [x] Realtime profile/award refresh.
- [x] Self-service password/logout/account deletion.

## 9. Analytics — COMPLETE

- [x] Pure deterministic analytics derivation separated from rendering.
- [x] Group Dings, active grinders, today, viewer rank.
- [x] 30-day trend.
- [x] Weekly volume.
- [x] Daypart share.
- [x] Hour histogram.
- [x] Actor-local weekday × hour heatmap.
- [x] Activity distribution.
- [x] Character contribution.
- [x] App-XP ranking.
- [x] Measured minutes-per-level trend.
- [x] Persisted-data-only records: fastest/slowest, deaths, Dings/day, top character, most alts.
- [x] No fabricated weather/tide/Bitcoin/location charts.

## 10. Push notifications — REPOSITORY COMPLETE, VAPID/DEVICE TEST BLOCKED

- [x] DING-native push schema and event kinds.
- [x] Browser service-worker delivery.
- [x] VAPID public-key validation.
- [x] User opt-in/re-arm UI.
- [x] Silent re-arm for already-granted permission.
- [x] Device subscription ACKs.
- [x] Ghost endpoint rotation/pruning.
- [x] Delivery log and admin diagnostics.
- [x] Exactly-once event ledger.
- [x] Instant notify path.
- [x] Scheduled 15-minute backstop.
- [x] One achievement push per exact reconciliation burst.
- [x] Suppressed siblings are explicitly claimed so backstop cannot leak them later.
- [x] No-recipient award burst is still retired correctly.
- [!] Add VAPID secrets.
- [!] Validate installed-browser/iOS/Android delivery and ACK rotation.

## 11. Discord — REPOSITORY COMPLETE, OPTIONAL LIVE WEBHOOK TEST BLOCKED

- [x] DING-native settings persistence.
- [x] Independent Discord dedupe/retry ledger.
- [x] USER/CHARACTER/LEVEL/CLASS/SPEC/REALM/ZONE/ACTIVITY/NOTE/DATE/TIME/ACHIEVEMENT/TIER/POINTS/PUSH_TITLE/PUSH_BODY tokens.
- [x] Masked webhook handling.
- [x] Admin settings UI.
- [x] Unsaved preview/test send.
- [x] Every Ding/achievement independent from mobile push pacing.
- [x] Discord failure cannot fail a committed Ding.
- [>] `DISCORD_WEBHOOK_URL` is optional.
- [!] Live webhook verification if Discord is enabled.

## 12. Inactivity / re-engagement — REPOSITORY COMPLETE, LIVE SCHEDULE TEST BLOCKED

- [x] DING reminder persistence/reset trigger.
- [x] Explicit cadence in game config.
- [x] Weighted DING-specific inactivity copy.
- [x] Failed-attempt cycle behavior preserved.
- [x] Scheduled workflow every 6 hours.
- [!] Validate real scheduled invocation after Supabase/cron secret exists.

## 13. PWA / install / versioning — REPOSITORY COMPLETE, INSTALLED-DEVICE TEST BLOCKED

- [x] Independent DING manifest identity.
- [x] DING service-worker cache/message/tag identity.
- [x] Complete icon family.
- [x] Native `beforeinstallprompt` flow.
- [x] iOS Safari Add-to-Home-Screen guidance.
- [x] Push guidance notes installed-mode requirement on iOS.
- [x] Stale-build check/reload banner.
- [x] SW push-resubscribe messages persisted back to Supabase.
- [x] Real desktop/iPhone screenshot coverage.
- [!] Hosted installed iOS/Android verification.

## 14. Battle.net integration boundary — CORE COMPLETE, PROVIDER OPTIONAL

- [x] Provider-neutral character import DTO.
- [x] Same domain validation for manual/imported characters.
- [x] Provider registry.
- [x] Battle.net stub establishes the integration boundary.
- [x] Manual character flow remains fully authoritative and requires no Blizzard credentials.
- [>] Actual Battle.net OAuth/API import is optional post-v1 and requires client credentials only if enabled.

## 15. Debug/admin tooling — COMPLETE

- [x] Active DING operations console.
- [x] Build/service-worker/PWA/push diagnostics.
- [x] Delivery log.
- [x] Targeted/all-device admin push.
- [x] Admin password-reset tool.
- [x] Discord settings/test tool.
- [x] Local-only simulated Dings/app-XP/achievement preview.
- [x] Privileged mutations remain server-side allowlisted.
- [x] Sandbox does not mutate real crew state.

## 16. CI/CD + GitHub Pages — REPOSITORY COMPLETE, DEPLOYMENT BLOCKED

- [x] CI covers formatting, ESLint, browser TypeScript, Deno lint/check/tests, Vitest, coverage and production build.
- [x] Production dependency audit gate.
- [x] Production bundle isolation gate.
- [x] Automated real-app screenshots.
- [x] Bot formatter/icon/screenshot commits rebase before push.
- [x] Credential-gated `Deploy DING` workflow.
- [x] Deployment order: migrations → Edge secrets → functions → live smoke → build → Pages.
- [x] Live smoke workflow.
- [x] Scheduled push backstop/inactivity workflow.
- [!] Required production secrets are not yet supplied.
- [!] GitHub Pages environment/source may require one account-level setting during first deployment.

## 17. Adversarial audit — REPOSITORY PASS COMPLETE, LIVE PASS BLOCKED

- [x] Bust-residue search/classification.
- [x] Atomicity/idempotency/static schema contract tests.
- [x] Push/achievement dedupe audit.
- [x] Rapid-Ding achievement pacing audit.
- [x] Mobile drawer/focus tests retained.
- [x] Reduced-motion handling retained.
- [x] Security/RLS/RPC review.
- [x] Secret/browser-boundary review.
- [x] Production bundle isolation test.
- [x] Automated screenshot pass.
- [x] Full static CI has reached green during release hardening; keep latest `main` green before deployment.
- [!] Live RLS/concurrency/push/Discord/scheduler audit requires the linked backend.
- [!] Physical responsive/accessibility/PWA push checks require hosted devices.

## 18. Physical-device release gate — BLOCKED

- [!] Deploy the hosted build.
- [!] Two real accounts: verify realtime Ding/feed/profile/award behavior.
- [!] Desktop browser check.
- [!] Installed iOS PWA check including push permission/delivery.
- [!] Installed Android PWA check including push permission/delivery.
- [!] Narrow phone/tablet/desktop visual check.
- [!] Fix any environment/device-only issues and repeat.

---

# Remaining external setup

Repository-only work is intended to be effectively complete. The final blockers are external configuration and live validation.

## Required GitHub secrets

- [!] `SUPABASE_ACCESS_TOKEN`
- [!] `SUPABASE_DB_PASSWORD`
- [!] `SUPABASE_PROJECT_REF`
- [!] `VITE_SUPABASE_URL`
- [!] `VITE_SUPABASE_ANON_KEY`
- [!] `VITE_WEB_PUSH_PUBLIC_KEY`
- [!] `VAPID_PUBLIC_KEY`
- [!] `VAPID_PRIVATE_KEY`
- [!] `VAPID_SUBJECT`
- [!] `REMINDER_CRON_SECRET`
- [!] `DING_INVITE_CODE` (24+ random characters; server-side signup gate)

Optional:
- [>] `BROADCAST_ADMINS`
- [>] `DISCORD_WEBHOOK_URL`
- [>] Battle.net client credentials only if optional import is enabled later.

## Required Supabase setting


## Once those exist

1. Run **Deploy DING**.
2. Let its migration/function/live-smoke/Pages chain complete.
3. Let the automated two-account live smoke pass.
4. Run installed iOS/Android PWA + push checks.
5. Repair only issues that depend on real hosted/device behavior.
