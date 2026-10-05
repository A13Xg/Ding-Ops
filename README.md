# DING

A mobile-first social leveling tracker and companion app for a private World of Warcraft crew.

DING is being built from the proven architecture of `A13Xg/Bust-Webapp`, but it is a separate application with a separate backend, storage namespace, PWA identity, deployment target, and domain model.

## Current state

Phase 1 bootstrap is in progress. The reusable Bust frontend, tests, notification infrastructure, Discord infrastructure, PWA utilities, and Edge Function scaffolding are being transplanted first. Bust database migrations are intentionally stored only under `supabase/legacy_bust_migrations/` for reference and are **not deployable DING migrations**.

Until the domain conversion is complete, some source files still contain Bust-specific event names and copy. See `ROADMAP.md` and `CONVERSION.md`.

## Stack

React 19 + Vite + Framer Motion + Supabase Auth/Postgres/RLS/Realtime + Supabase Edge Functions + Vitest.

## Local bootstrap

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The app can be built without a live Supabase project, but authenticated/runtime flows require DING-specific Supabase values.

## Safety

Never reuse Bust production Supabase values in this repository. DING receives its own project and secrets during the Supabase wiring phase.
