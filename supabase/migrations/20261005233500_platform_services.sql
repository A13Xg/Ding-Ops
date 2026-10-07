-- DING platform services: achievements, realtime, push delivery, inactivity,
-- and Discord persistence. This is DING-native schema; legacy Bust migrations
-- remain reference-only under ../legacy_bust_migrations.

-- ---------- Achievement persistence ----------
create table if not exists public.achievement_catalog (
  id text primary key
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_type text not null references public.achievement_catalog(id),
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_type)
);

alter table public.achievement_catalog enable row level security;
alter table public.achievements enable row level security;

drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements
for select to authenticated using (true);

-- No client write policy for achievements or catalog. Achievement persistence
-- is service-role-only after server reconciliation proves eligibility.

-- ---------- Push subscriptions and exactly-once event ledger ----------
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_ack_at timestamptz,
  failure_count integer not null default 0,
  unacked_count integer not null default 0
);

create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
-- No browser policies. Endpoint/key material is registered and rotated only by
-- register-push-subscription after JWT validation, and all delivery/liveness
-- mutations are service-role operations.

create table if not exists public.push_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('ding', 'achievement')),
  source_id text not null,
  actor_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  recipients integer not null default 0,
  delivered integer not null default 0,
  unique (kind, source_id)
);

create index if not exists push_events_created_idx
  on public.push_events (created_at desc);

alter table public.push_events enable row level security;
-- No policies: service role only.

create table if not exists public.push_deliveries (
  id bigint generated always as identity primary key,
  receipt_id uuid not null default gen_random_uuid(),
  batch_id uuid not null,
  kind text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid references public.profiles(id) on delete cascade,
  subscription_id bigint,
  title text not null default '',
  sent_at timestamptz not null default now(),
  acked_at timestamptz,
  unique (receipt_id)
);

create index if not exists push_deliveries_batch_idx
  on public.push_deliveries (batch_id);
create index if not exists push_deliveries_sent_idx
  on public.push_deliveries (sent_at desc);
create index if not exists push_deliveries_subscription_idx
  on public.push_deliveries (subscription_id, sent_at desc);

alter table public.push_deliveries enable row level security;
-- No policies: service role only.

-- ---------- Push liveness helpers ----------
create or replace function public.bump_push_failure(subscription_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed integer;
begin
  update public.push_subscriptions
  set failure_count = failure_count + 1,
      updated_at = now()
  where id = any(subscription_ids);

  with gone as (
    delete from public.push_subscriptions
    where id = any(subscription_ids)
      and failure_count >= 25
    returning 1
  )
  select count(*) into removed from gone;

  return removed;
end;
$$;

create or replace function public.mark_push_sent(subscription_ids bigint[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.push_subscriptions
  set unacked_count = unacked_count + 1,
      updated_at = now()
  where id = any(subscription_ids);
$$;

create or replace function public.record_push_ack(receipt uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acked_subscription bigint;
  found_row boolean := false;
begin
  with stamped as (
    update public.push_deliveries
    set acked_at = now()
    where receipt_id = receipt
      and acked_at is null
    returning subscription_id
  )
  select subscription_id, true
  into acked_subscription, found_row
  from stamped;

  if not found_row then
    return false;
  end if;

  if acked_subscription is not null then
    update public.push_subscriptions
    set last_ack_at = now(),
        unacked_count = 0,
        failure_count = 0,
        updated_at = now()
    where id = acked_subscription;
  end if;

  return true;
end;
$$;

create or replace function public.prune_dead_push_subscriptions(
  never_acked_after integer default 8,
  min_age interval default interval '2 days',
  went_silent_after integer default 25,
  silent_for interval default interval '14 days'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed integer;
begin
  with gone as (
    delete from public.push_subscriptions
    where (
      last_ack_at is null
      and unacked_count >= never_acked_after
      and created_at < now() - min_age
    )
    or (
      last_ack_at is not null
      and unacked_count >= went_silent_after
      and last_ack_at < now() - silent_for
    )
    returning 1
  )
  select count(*) into removed from gone;

  return removed;
end;
$$;

create or replace function public.push_subscription_health()
returns table (
  id bigint,
  user_id uuid,
  host text,
  user_agent text,
  created_at timestamptz,
  last_success_at timestamptz,
  last_ack_at timestamptz,
  unacked_count integer,
  failure_count integer,
  sent_total bigint,
  acked_total bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    s.id,
    s.user_id,
    split_part(replace(s.endpoint, 'https://', ''), '/', 1) as host,
    s.user_agent,
    s.created_at,
    s.last_success_at,
    s.last_ack_at,
    s.unacked_count,
    s.failure_count,
    coalesce(d.sent_total, 0) as sent_total,
    coalesce(d.acked_total, 0) as acked_total
  from public.push_subscriptions s
  left join (
    select
      subscription_id,
      count(*) as sent_total,
      count(acked_at) as acked_total
    from public.push_deliveries
    where subscription_id is not null
    group by subscription_id
  ) d on d.subscription_id = s.id
  order by s.user_id, s.id;
$$;

revoke all on function public.bump_push_failure(bigint[]) from public, anon, authenticated;
revoke all on function public.mark_push_sent(bigint[]) from public, anon, authenticated;
revoke all on function public.record_push_ack(uuid) from public, anon, authenticated;
revoke all on function public.prune_dead_push_subscriptions(integer, interval, integer, interval)
  from public, anon, authenticated;
revoke all on function public.push_subscription_health() from public, anon, authenticated;

-- ---------- Inactivity reminder state ----------
create table if not exists public.inactivity_reminders (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cycle_ding_at timestamptz not null,
  scheduled_for timestamptz,
  last_sent_at timestamptz,
  last_message_index integer,
  updated_at timestamptz not null default now()
);

create index if not exists inactivity_reminders_scheduled_idx
  on public.inactivity_reminders (scheduled_for);

alter table public.inactivity_reminders enable row level security;
-- No policies: server-managed only.

create or replace function public.reset_inactivity_reminder_on_ding()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.inactivity_reminders (
    user_id,
    cycle_ding_at,
    scheduled_for,
    last_sent_at,
    last_message_index,
    updated_at
  )
  values (new.user_id, new.timestamp, null, null, null, now())
  on conflict (user_id) do update
  set cycle_ding_at = excluded.cycle_ding_at,
      scheduled_for = null,
      last_sent_at = null,
      last_message_index = null,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists ding_reset_inactivity_reminder on public.level_events;
create trigger ding_reset_inactivity_reminder
after insert on public.level_events
for each row execute function public.reset_inactivity_reminder_on_ding();

-- ---------- Discord settings and exactly-once ledger ----------
create table if not exists public.discord_settings (
  id integer primary key default 1,
  enabled boolean not null default false,
  ding_enabled boolean not null default true,
  achievement_enabled boolean not null default true,
  webhook_url text,
  bot_username text,
  bot_avatar_url text,
  footer_text text,
  ding_color text,
  achievement_color text,
  ding_title_template text,
  ding_description_template text,
  achievement_title_template text,
  achievement_description_template text,
  mention_content text,
  include_thumbnail boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint discord_settings_singleton check (id = 1)
);

alter table public.discord_settings enable row level security;
-- No policies: admin Edge Functions only.

create table if not exists public.discord_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('ding', 'achievement')),
  source_id text not null,
  actor_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  success boolean,
  status_code integer,
  error text,
  unique (kind, source_id)
);

create index if not exists discord_events_created_idx
  on public.discord_events (created_at desc);

alter table public.discord_events enable row level security;
-- No policies: service role only.

-- ---------- Realtime ----------
do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.characters;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.level_events;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.achievements;
  exception when duplicate_object then null;
  end;
end $$;
