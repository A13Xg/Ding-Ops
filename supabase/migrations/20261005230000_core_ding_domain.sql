-- DING core domain: accounts, characters and atomic level events.
-- This migration is intentionally written from scratch. Legacy Bust migrations
-- under ../legacy_bust_migrations are reference material only.

create extension if not exists pgcrypto;

create table if not exists public.game_config (
  id text primary key,
  expansion_key text not null,
  expansion_name text not null,
  level_cap smallint not null check (level_cap between 1 and 255),
  updated_at timestamptz not null default now()
);

insert into public.game_config (id, expansion_key, expansion_name, level_cap)
values ('current', 'midnight', 'Midnight', 90)
on conflict (id) do update set
  expansion_key = excluded.expansion_key,
  expansion_name = excluded.expansion_name,
  level_cap = excluded.level_cap,
  updated_at = now();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(trim(username)) between 2 and 32),
  avatar_seed text check (avatar_seed is null or char_length(avatar_seed) <= 64),
  tagline text check (tagline is null or char_length(tagline) <= 80),
  showcase text check (showcase is null or char_length(showcase) <= 512),
  active_character_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 32),
  realm text not null check (char_length(trim(realm)) between 1 and 64),
  region text not null check (region in ('US','EU','KR','TW')),
  class_name text not null check (char_length(trim(class_name)) between 1 and 32),
  spec text check (spec is null or char_length(spec) <= 40),
  race text check (race is null or char_length(race) <= 40),
  faction text check (faction is null or faction in ('Alliance','Horde','Neutral')),
  current_level smallint not null check (current_level between 1 and 255),
  tracked_from_level smallint not null check (tracked_from_level between 1 and 255),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tracked_from_level <= current_level)
);

create unique index if not exists characters_owner_identity_key
  on public.characters (user_id, lower(name), lower(realm), region);

alter table public.profiles
  drop constraint if exists profiles_active_character_id_fkey;
alter table public.profiles
  add constraint profiles_active_character_id_fkey
  foreign key (active_character_id) references public.characters(id) on delete set null;

create table if not exists public.level_events (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  from_level smallint not null check (from_level between 1 and 254),
  to_level smallint not null check (to_level between 2 and 255),
  timestamp timestamptz not null,
  time_zone text not null,
  local_date date not null,
  local_hour smallint not null check (local_hour between 0 and 23),
  time_bucket text not null,
  zone text check (zone is null or char_length(zone) <= 80),
  activity_type text,
  deaths integer check (deaths is null or deaths between 0 and 10000),
  session_minutes integer check (session_minutes is null or session_minutes between 0 and 525600),
  note text not null default '' check (char_length(note) <= 240),
  created_at timestamptz not null default now(),
  check (to_level = from_level + 1),
  unique (character_id, to_level)
);

create index if not exists level_events_user_timestamp_idx on public.level_events (user_id, timestamp desc);
create index if not exists level_events_character_timestamp_idx on public.level_events (character_id, timestamp desc);

create or replace function public.validate_character_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap smallint;
begin
  select level_cap into v_cap from public.game_config where id = 'current';
  if v_cap is null then raise exception 'DING_CONFIG_MISSING'; end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'DING_CHARACTER_OWNER_IMMUTABLE';
  end if;
  if new.current_level > v_cap then
    raise exception 'DING_LEVEL_ABOVE_CAP';
  end if;
  if new.tracked_from_level > new.current_level then
    raise exception 'DING_TRACKED_LEVEL_INVALID';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists characters_validate_write on public.characters;
create trigger characters_validate_write
before insert or update on public.characters
for each row execute function public.validate_character_write();

create or replace function public.validate_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.username is distinct from old.username then
    raise exception 'DING_USERNAME_IMMUTABLE';
  end if;
  if new.active_character_id is not null and new.active_character_id is distinct from old.active_character_id then
    if not exists (
      select 1 from public.characters c
      where c.id = new.active_character_id and c.user_id = new.id and not c.is_archived
    ) then
      raise exception 'DING_ACTIVE_CHARACTER_INVALID';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_validate_update on public.profiles;
create trigger profiles_validate_update
before update on public.profiles
for each row execute function public.validate_profile_update();

alter table public.game_config enable row level security;
alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.level_events enable row level security;

drop policy if exists game_config_select on public.game_config;
create policy game_config_select on public.game_config for select to authenticated using (true);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
-- No browser UPDATE policy for profiles. Mutable preferences go through
-- update_profile_preferences and active-character changes go through
-- set_active_character so callers cannot forge username/showcase state.
drop policy if exists profiles_update_own on public.profiles;

drop policy if exists characters_select on public.characters;
create policy characters_select on public.characters for select to authenticated using (true);
drop policy if exists characters_insert_own on public.characters;
create policy characters_insert_own on public.characters for insert to authenticated with check (user_id = auth.uid());

drop policy if exists level_events_select on public.level_events;
create policy level_events_select on public.level_events for select to authenticated using (true);
-- Deliberately no browser INSERT/UPDATE policy for level_events. Dings and note
-- edits go through narrow RPCs so progression cannot be forged with PostgREST.

create or replace function public.update_profile_preferences(
  p_tagline text,
  p_avatar_seed text,
  p_showcase text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_showcase text;
  v_ids text[];
begin
  if v_actor is null then raise exception 'DING_NOT_AUTHENTICATED'; end if;

  v_showcase := nullif(trim(coalesce(p_showcase, '')), '');
  if v_showcase is not null then
    v_ids := string_to_array(v_showcase, ',');
    if cardinality(v_ids) > 3 then raise exception 'DING_SHOWCASE_TOO_LARGE'; end if;
    if cardinality(v_ids) <> cardinality(array(select distinct unnest(v_ids))) then
      raise exception 'DING_SHOWCASE_DUPLICATE';
    end if;
    if exists (
      select 1
      from unnest(v_ids) as wanted(id)
      where not exists (
        select 1 from public.achievements a
        where a.user_id = v_actor and a.achievement_type = wanted.id
      )
    ) then
      raise exception 'DING_SHOWCASE_NOT_EARNED';
    end if;
  end if;

  update public.profiles
  set
    tagline = nullif(left(trim(coalesce(p_tagline, '')), 80), ''),
    avatar_seed = nullif(left(trim(coalesce(p_avatar_seed, '')), 64), ''),
    showcase = v_showcase
  where id = v_actor
  returning * into v_profile;

  if not found then raise exception 'DING_PROFILE_MISSING'; end if;
  return v_profile;
end;
$;

revoke all on function public.update_profile_preferences(text,text,text) from public;
grant execute on function public.update_profile_preferences(text,text,text) to authenticated;

create or replace function public.set_active_character(p_character_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_actor is null then raise exception 'DING_NOT_AUTHENTICATED'; end if;
  if p_character_id is not null and not exists (
    select 1 from public.characters c where c.id = p_character_id and c.user_id = v_actor and not c.is_archived
  ) then
    raise exception 'DING_ACTIVE_CHARACTER_INVALID';
  end if;
  update public.profiles set active_character_id = p_character_id where id = v_actor returning * into v_profile;
  if not found then raise exception 'DING_PROFILE_MISSING'; end if;
  return v_profile;
end;
$$;

create or replace function public.update_character_metadata(
  p_character_id uuid,
  p_name text,
  p_realm text,
  p_region text,
  p_class_name text,
  p_spec text default null,
  p_race text default null,
  p_faction text default null,
  p_is_archived boolean default false
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.characters%rowtype;
begin
  if v_actor is null then raise exception 'DING_NOT_AUTHENTICATED'; end if;
  update public.characters set
    name = left(trim(p_name),32),
    realm = left(trim(p_realm),64),
    region = upper(trim(p_region)),
    class_name = left(trim(p_class_name),32),
    spec = nullif(left(trim(coalesce(p_spec,'')),40),''),
    race = nullif(left(trim(coalesce(p_race,'')),40),''),
    faction = nullif(left(trim(coalesce(p_faction,'')),16),''),
    is_archived = coalesce(p_is_archived,false)
  where id = p_character_id and user_id = v_actor
  returning * into v_row;
  if not found then raise exception 'DING_CHARACTER_NOT_FOUND'; end if;
  if v_row.is_archived then
    update public.profiles set active_character_id = null
    where id = v_actor and active_character_id = v_row.id;
  end if;
  return v_row;
end;
$$;

create or replace function public.record_ding(
  p_event_id uuid,
  p_character_id uuid,
  p_expected_from_level smallint,
  p_zone text default null,
  p_activity_type text default null,
  p_deaths integer default null,
  p_session_minutes integer default null,
  p_note text default '',
  p_time_zone text default 'UTC'
)
returns public.level_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_character public.characters%rowtype;
  v_existing public.level_events%rowtype;
  v_event public.level_events%rowtype;
  v_cap smallint;
  v_now timestamptz;
  v_tz text;
  v_local timestamp;
  v_hour smallint;
  v_bucket text;
begin
  if v_actor is null then raise exception 'DING_NOT_AUTHENTICATED'; end if;
  if p_event_id is null then raise exception 'DING_EVENT_ID_REQUIRED'; end if;

  select * into v_existing from public.level_events where id = p_event_id;
  if found then
    if v_existing.user_id <> v_actor or v_existing.character_id <> p_character_id then
      raise exception 'DING_EVENT_ID_CONFLICT';
    end if;
    return v_existing;
  end if;

  select * into v_character from public.characters where id = p_character_id for update;
  if not found or v_character.user_id <> v_actor then raise exception 'DING_CHARACTER_NOT_FOUND'; end if;
  if v_character.is_archived then raise exception 'DING_CHARACTER_ARCHIVED'; end if;

  -- A retry with the same UUID may have raced us between the optimistic lookup
  -- above and this character lock. READ COMMITTED gives this statement a fresh
  -- snapshot after the lock wait, so re-check before interpreting the now-
  -- advanced character level as a stale client.
  select * into v_existing from public.level_events where id = p_event_id;
  if found then
    if v_existing.user_id <> v_actor or v_existing.character_id <> p_character_id then
      raise exception 'DING_EVENT_ID_CONFLICT';
    end if;
    return v_existing;
  end if;

  select level_cap into v_cap from public.game_config where id = 'current';
  if v_cap is null then raise exception 'DING_CONFIG_MISSING'; end if;
  if v_character.current_level >= v_cap then raise exception 'DING_MAX_LEVEL'; end if;
  if p_expected_from_level is null or v_character.current_level <> p_expected_from_level then
    raise exception 'DING_STALE_LEVEL' using detail =
      format('expected current level %s, server has %s', p_expected_from_level, v_character.current_level);
  end if;
  if p_deaths is not null and (p_deaths < 0 or p_deaths > 10000) then
    raise exception 'DING_DEATHS_INVALID';
  end if;
  if p_session_minutes is not null and (p_session_minutes < 0 or p_session_minutes > 525600) then
    raise exception 'DING_SESSION_INVALID';
  end if;

  v_now := clock_timestamp();
  v_tz := coalesce(nullif(trim(p_time_zone),''),'UTC');
  if not exists (select 1 from pg_timezone_names where name = v_tz) then v_tz := 'UTC'; end if;
  v_local := timezone(v_tz, v_now);
  v_hour := extract(hour from v_local)::smallint;
  v_bucket := case
    when v_hour < 4 then 'Late Night'
    when v_hour < 8 then 'Early Morning'
    when v_hour < 12 then 'Morning'
    when v_hour < 17 then 'Afternoon'
    when v_hour < 21 then 'Evening'
    else 'Prime Night'
  end;

  insert into public.level_events (
    id,user_id,character_id,from_level,to_level,timestamp,time_zone,local_date,local_hour,time_bucket,
    zone,activity_type,deaths,session_minutes,note
  ) values (
    p_event_id,v_actor,v_character.id,v_character.current_level,v_character.current_level+1,v_now,v_tz,
    v_local::date,v_hour,v_bucket,
    nullif(left(trim(coalesce(p_zone,'')),80),''),
    nullif(left(trim(coalesce(p_activity_type,'')),32),''),
    p_deaths,p_session_minutes,left(coalesce(p_note,''),240)
  ) returning * into v_event;

  update public.characters
  set current_level = v_event.to_level
  where id = v_character.id;

  return v_event;
end;
$$;

create or replace function public.update_level_event_note(p_event_id uuid, p_note text)
returns public.level_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_event public.level_events%rowtype;
begin
  if v_actor is null then raise exception 'DING_NOT_AUTHENTICATED'; end if;
  update public.level_events
  set note = left(coalesce(p_note,''),240)
  where id = p_event_id and user_id = v_actor
  returning * into v_event;
  if not found then raise exception 'DING_EVENT_NOT_FOUND'; end if;
  return v_event;
end;
$$;

revoke all on function public.set_active_character(uuid) from public, anon;
revoke all on function public.update_character_metadata(uuid,text,text,text,text,text,text,text,boolean) from public, anon;
revoke all on function public.record_ding(uuid,uuid,smallint,text,text,integer,integer,text,text) from public, anon;
revoke all on function public.update_level_event_note(uuid,text) from public, anon;
grant execute on function public.set_active_character(uuid) to authenticated;
grant execute on function public.update_character_metadata(uuid,text,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.record_ding(uuid,uuid,smallint,text,text,integer,integer,text,text) to authenticated;
grant execute on function public.update_level_event_note(uuid,text) to authenticated;
