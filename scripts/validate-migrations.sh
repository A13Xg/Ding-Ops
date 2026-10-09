#!/usr/bin/env bash
set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-ding_ci}"

psql -v ON_ERROR_STOP=1 <<'SQL'
create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid()
returns uuid
language sql
stable
as 'select null::uuid';
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create publication supabase_realtime;
SQL

for migration in supabase/migrations/*.sql; do
  echo "Applying $migration"
  psql -v ON_ERROR_STOP=1 -f "$migration"
done
