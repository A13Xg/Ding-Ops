# DING End-to-End Roadmap

## Status legend
- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked on user/external dependency

## Execution rules
- Commit directly to `main`.
- Keep the app runnable at phase boundaries.
- Defer user-dependent checkpoints as long as productive work can continue without them.
- Never point DING at the Bust production backend.
- Preserve old Bust SQL only as conversion reference; active DING migrations are written cleanly from scratch.

End-to-end roadmap
1. [~] Repository bootstrap + source transplant
   - Inspect Ding-Ops, establish its default branch/state, and preserve any files you already added.
   - Copy the reusable Bust-App production baseline into Ding-Ops, excluding production-specific secrets/backend identifiers and obsolete Bust deployment state.
   - Add PROJECT.md, ROADMAP.md, .env.example, and a conversion ledger documenting every Bust → DING semantic replacement.
   - Rename package/app/PWA/storage namespaces immediately so an early build cannot collide with Bust.
   - Run static sanity checks possible before Supabase exists.
   - Commit: bootstrap baseline.
   - USER CHECKPOINT: none unless the target repo contains conflicting files I should not overwrite.
2. [ ] Domain conversion: account → characters → Ding events
   - Add first-class characters.
   - Replace busts with level_events.
   - Implement active-character selection, current level, class/spec/race/faction/realm/region, tracked-from level, archive state.
   - Replace the 2-hour cooldown with an atomic server-authoritative record_ding transaction: row lock, ownership, current+1, cap enforcement, UUID idempotency, duplicate-level protection.
   - Preserve pending-event recovery semantics for ambiguous network failures.
   - Add tests for concurrency, retries, duplicate UUIDs, stale clients, max-level, and parallel characters.
   - Commit: core Ding schema/domain.
3. [ ] Supabase project wiring
   - Create clean migrations from scratch for DING rather than pointing at Bust.
   - Port RLS, Realtime publication, achievement persistence, push ledgers, delivery acknowledgements, Discord settings, and delete-account behavior.
   - Make expansion/level cap data-driven.
   - USER CHECKPOINT: create/link a new Supabase project and provide repository secrets:
     - SUPABASE_ACCESS_TOKEN
     - VITE_SUPABASE_URL
     - VITE_SUPABASE_ANON_KEY
     - later push-specific values
   - I’ll give exact supabase link / secret commands only when we reach this gate.
4. [ ] Primary DING vertical slice
   - Login/signup.
   - Character creation and active-character selector.
   - Full-screen DING dashboard.
   - Arcane charge → server commit → blue/purple level-up burst → detail view.
   - Realtime feed between accounts.
   - Post-Ding note editing.
   - Max-level state.
   - Keep Bust’s pending save/status recovery.
   - Commit: usable first vertical slice.
   - USER CHECKPOINT: pull locally, run one provided command block, verify one real Ding against Supabase.
5. [ ] WoW visual system
   - Replace orange/milk design tokens with slate/blue/purple/void/arcane system.
   - Replace logo/PWA assets with original DING assets; no Blizzard logo/art copying.
   - Retheme splash, loading, cooldown remnants, badges, rank shimmer, top bar, drawers, cards, empty states, and profile visuals.
   - Preserve PR #12 mobile behavior: portalled drawers, sticky/reachable X, scrim dismissal, focus ownership, safe areas, centered achievement cards, stable particles, haptics, reduced-motion support.
   - Commit: visual conversion.
6. [ ] Full copy/verbiage conversion
   - Exhaustive source scan for Bust, BUST, bust, busts, storage keys, URLs, tags, synthetic domains, comments, SQL names, test fixtures, notification strings, Discord defaults, service-worker tags.
   - Replace with WoW/sweaty-gamer voice while keeping humor varied rather than repeating the same Doritos/grass joke.
   - Build deterministic notification catalogs for Dings, achievements, inactivity, errors, and system states.
   - Commit: copy/domain residue removal.
7. [ ] Achievement/progression rebuild
   - Preserve catalog architecture, tiers, points, reconciliation, badge showcase, earned history, social comparison, meta pass, one-announcement-per-Ding behavior.
   - Replace all ~132 Bust achievements with leveling-relevant tracks: milestones, speed, late-night, streaks, dungeons, delves, questing, zones, alts, deaths, group synchronicity, calendars, notes, max-level/meta.
   - Ensure every condition is computable from persisted fields.
   - Add deterministic tests for each rules family.
   - Commit: achievement system.
8. [ ] Profiles, roster, characters, social comparison
   - Player profile distinct from characters.
   - Main/active character prominently shown; alts visible.
   - Roster/guild-style list, recent Dings, badges, comparison, character-level stats.
   - Preserve realtime profile/award updates.
   - Commit: social layer.
9. [ ] Analytics conversion
   - Preserve the existing dense analytics drawer/chart primitives.
   - Replace environment/BTC analytics with group Dings, levels/day, minutes/level, pace, dayparts, weekly volume, heatmap, activity distribution, character contribution, XP ranking, fastest/slowest level, longest streak, late-night records, deaths where available.
   - Delete charts whose underlying data no longer exists rather than inventing metrics.
   - Commit: analytics.
10. [ ] Push notification system
    - Port Bust’s mature VAPID/service-worker/acknowledgement/ghost-endpoint/backstop/exactly-once machinery.
    - Event kinds become ding and achievement.
    - Preserve delivery diagnostics and endpoint rotation.
    - USER CHECKPOINT: generate/add:
      - VITE_WEB_PUSH_PUBLIC_KEY
      - VAPID_PUBLIC_KEY
      - VAPID_PRIVATE_KEY
      - VAPID_SUBJECT
      - REMINDER_CRON_SECRET
      - optional BROADCAST_ADMINS
    - I’ll provide copy/paste generation commands at that phase.
    - Commit: push system.
11. [ ] Discord
    - Port admin-configurable webhook settings and independent dedupe ledger.
    - Add DING tokens: USER, CHARACTER, LEVEL, CLASS, SPEC, REALM, ZONE, ACTIVITY, NOTE, DATE, TIME, ACHIEVEMENT, TIER, POINTS, PUSH_TITLE, PUSH_BODY.
    - USER CHECKPOINT: optional Discord webhook URL or leave disabled.
    - Commit: Discord integration.
12. [ ] Inactivity/re-engagement
    - Port weighted 5–7-day-style state machine but move cadence into config.
    - Rewrite reminders around leveling inactivity/grass exposure/casual behavior.
    - Preserve “failed reminder advances cycle” and dedupe semantics.
    - Commit: reminders.
13. [ ] PWA/install/versioning
    - Independent manifest, app IDs, icons, service-worker tags, local/session storage namespace, stale-build banner, install handling, iOS constraints.
    - Ensure no installed Bust PWA state can overlap with DING.
    - Commit: PWA hardening.
    - USER CHECKPOINT: install on one iOS/Android device for real-world validation.
14. [ ] Battle.net integration boundary
    - Add interface/adapter and normalized character DTOs without making Battle.net mandatory.
    - Manual characters remain authoritative for v1.
    - Only after the core app is stable, optionally wire OAuth/profile lookup.
    - USER CHECKPOINT: Battle.net client ID/secret only if you want this enabled.
15. [ ] Debug/admin tooling
    - Convert Bust debug menu into DING sandbox tooling: simulated characters, Dings, XP, achievements, push diagnostics, account reset, Discord previews, delivery logs.
    - Keep sandbox mutations isolated from real crew state.
    - Commit: debug/admin conversion.
16. [ ] CI/CD + GitHub Pages
    - Port lint, formatting, browser typecheck, Deno lint/typecheck/tests, Vitest, migration-before-function deployment, production build, Pages upload.
    - Remove all Bust project refs/URLs.
    - USER CHECKPOINT: GitHub Pages setting + final Supabase/GitHub secrets if not already present.
    - Commit: production pipeline.
17. [ ] Full adversarial audit
    - Compare DING against current Bust main, especially PR #12 behavior.
    - Exhaustive Bust-residue scan.
    - Concurrency/retry/data-integrity tests.
    - Push and achievement dedupe audit.
    - Narrow phone/tablet/desktop responsive checks.
    - Accessibility/focus/reduced-motion checks.
    - Security/RLS/schema review.
    - Build/test/lint/typecheck everything.
    - Fix all Critical/Major findings, then repeat the audit from scratch.
    - Commit: release candidate.
18. [ ] Physical-device release gate
    - USER CHECKPOINT: you pull main and run the exact verification matrix I provide on desktop + installed phone PWA.
    - I address anything discovered, commit fixes, and repeat until release-ready.