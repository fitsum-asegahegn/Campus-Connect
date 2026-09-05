-- ============================================================================
-- Campus Connect — Supabase schema
-- ============================================================================
-- How to use:
--   1. Supabase Dashboard → SQL Editor → paste this whole file → Run.
--   2. Supabase Dashboard → Authentication → Providers → enable
--      "Allow anonymous sign-ins" (this app uses anonymous auth so students
--      don't need to create a password — see auth.js for why).
--   3. Copy your Project URL and anon public key into config.js.
--
-- Design notes:
--   - Every "shared" table (feed_posts, events, prayer_requests, profiles,
--     group_challenge_completions) is readable by any signed-in user
--     (including anonymous sessions — Supabase gives anonymous users the
--     'authenticated' role, just with an is_anonymous claim).
--   - Every table that represents someone's own action (their profile, their
--     RSVPs, their reading check-ins, their prayer reactions) can only be
--     written by that same auth.uid() — enforced by Postgres Row Level
--     Security, not just app-side logic.
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;


-- ============================================================================
-- PROFILES
-- One row per signed-in person (auth.users.id). Doubles as the "Directory".
-- ============================================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  gender      text not null check (gender in ('m','f')),
  university  text not null default '',
  city        text not null default '',
  bday_day    smallint,
  bday_month  smallint,
  bday_year   smallint,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_authenticated"
  on profiles for select
  to authenticated
  using (true);

create policy "profiles_insert_own"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ============================================================================
-- FEED POSTS
-- ============================================================================
create table if not exists feed_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles(id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists feed_posts_created_at_idx on feed_posts (created_at desc);

alter table feed_posts enable row level security;

create policy "feed_posts_select_authenticated"
  on feed_posts for select
  to authenticated
  using (true);

create policy "feed_posts_insert_own"
  on feed_posts for insert
  to authenticated
  with check (auth.uid() = author_id);


-- ============================================================================
-- EVENTS  (type: 'assembly' | 'discussion' | 'break')
-- ============================================================================
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  title_am    text not null,
  title_en    text not null,
  event_date  date not null,
  type        text not null default 'assembly',
  note        text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists events_date_idx on events (event_date);

alter table events enable row level security;

create policy "events_select_authenticated"
  on events for select
  to authenticated
  using (true);

create policy "events_insert_own"
  on events for insert
  to authenticated
  with check (auth.uid() = created_by);


-- ============================================================================
-- EVENT RSVPS
-- ============================================================================
create table if not exists event_rsvps (
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table event_rsvps enable row level security;

create policy "event_rsvps_select_authenticated"
  on event_rsvps for select
  to authenticated
  using (true);

create policy "event_rsvps_insert_own"
  on event_rsvps for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "event_rsvps_delete_own"
  on event_rsvps for delete
  to authenticated
  using (auth.uid() = user_id);


-- ============================================================================
-- PRAYER WALL
-- ============================================================================
create table if not exists prayer_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete set null,
  text        text not null check (char_length(text) between 1 and 1000),
  is_anon     boolean not null default true,
  pray_count  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists prayer_requests_created_at_idx on prayer_requests (created_at desc);

alter table prayer_requests enable row level security;

create policy "prayer_requests_select_authenticated"
  on prayer_requests for select
  to authenticated
  using (true);

create policy "prayer_requests_insert_own"
  on prayer_requests for insert
  to authenticated
  with check (auth.uid() = user_id);


create table if not exists prayer_reactions (
  request_id  uuid not null references prayer_requests(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (request_id, user_id)
);

alter table prayer_reactions enable row level security;

create policy "prayer_reactions_select_authenticated"
  on prayer_reactions for select
  to authenticated
  using (true);

create policy "prayer_reactions_insert_own"
  on prayer_reactions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Keep prayer_requests.pray_count in sync automatically whenever someone
-- taps "I'm praying" (one reaction per person, enforced by the primary key
-- above, so this trigger only ever fires once per person per request).
create or replace function bump_pray_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update prayer_requests set pray_count = pray_count + 1 where id = new.request_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_pray_count on prayer_reactions;
create trigger trg_bump_pray_count
  after insert on prayer_reactions
  for each row execute function bump_pray_count();


-- ============================================================================
-- READING PLAN CHECK-INS (personal — day_index matches the array in app.js)
-- ============================================================================
create table if not exists reading_checks (
  user_id     uuid not null references profiles(id) on delete cascade,
  day_index   smallint not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, day_index)
);

alter table reading_checks enable row level security;

create policy "reading_checks_all_own"
  on reading_checks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================================================
-- WEEKLY GROUP CHALLENGE CHECK-INS
-- week_key format matches app.js's weekKey(), e.g. "2026-W36"
-- ============================================================================
create table if not exists group_challenge_completions (
  week_key    text not null,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (week_key, user_id)
);

alter table group_challenge_completions enable row level security;

create policy "completions_select_authenticated"
  on group_challenge_completions for select
  to authenticated
  using (true);

create policy "completions_insert_own"
  on group_challenge_completions for insert
  to authenticated
  with check (auth.uid() = user_id);


-- ============================================================================
-- updated_at housekeeping for profiles
-- ============================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- Done. Nothing is seeded on purpose — post the first welcome message and
-- events directly from the app once it's deployed and you've signed in.
-- ============================================================================
