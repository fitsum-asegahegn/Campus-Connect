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

drop policy if exists "profiles_select_authenticated" on profiles;
create policy "profiles_select_authenticated"
  on profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
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

drop policy if exists "feed_posts_select_authenticated" on feed_posts;
create policy "feed_posts_select_authenticated"
  on feed_posts for select
  to authenticated
  using (true);

drop policy if exists "feed_posts_insert_own" on feed_posts;
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

drop policy if exists "events_select_authenticated" on events;
create policy "events_select_authenticated"
  on events for select
  to authenticated
  using (true);

drop policy if exists "events_insert_own" on events;
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

drop policy if exists "event_rsvps_select_authenticated" on event_rsvps;
create policy "event_rsvps_select_authenticated"
  on event_rsvps for select
  to authenticated
  using (true);

drop policy if exists "event_rsvps_insert_own" on event_rsvps;
create policy "event_rsvps_insert_own"
  on event_rsvps for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "event_rsvps_delete_own" on event_rsvps;
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

drop policy if exists "prayer_requests_select_authenticated" on prayer_requests;
create policy "prayer_requests_select_authenticated"
  on prayer_requests for select
  to authenticated
  using (true);

drop policy if exists "prayer_requests_insert_own" on prayer_requests;
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

drop policy if exists "prayer_reactions_select_authenticated" on prayer_reactions;
create policy "prayer_reactions_select_authenticated"
  on prayer_reactions for select
  to authenticated
  using (true);

drop policy if exists "prayer_reactions_insert_own" on prayer_reactions;
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

drop policy if exists "reading_checks_all_own" on reading_checks;
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

drop policy if exists "completions_select_authenticated" on group_challenge_completions;
create policy "completions_select_authenticated"
  on group_challenge_completions for select
  to authenticated
  using (true);

drop policy if exists "completions_insert_own" on group_challenge_completions;
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


-- ============================================================================
-- IMAGES FOR FEED POSTS (added later — safe to re-run this whole file;
-- everything below uses IF NOT EXISTS / ON CONFLICT DO NOTHING, so it won't
-- touch anything that already exists)
-- ============================================================================

alter table feed_posts add column if not exists image_path text;

-- Storage bucket for post photos. Public so images can be shown via a plain
-- URL without extra auth headers (consistent with the rest of the feed
-- already being readable by anyone signed in — a photo isn't more exposed
-- than the post text next to it). 5MB limit, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

-- Anyone can view post images (matches feed_posts being readable by anyone
-- signed in).
drop policy if exists "post_images_public_read" on storage.objects;
create policy "post_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'post-images');

-- People can only upload into a folder named after their own user id
-- (app.js uploads to "<user_id>/<filename>"), so nobody can overwrite or
-- clutter someone else's folder.
drop policy if exists "post_images_insert_own_folder" on storage.objects;
create policy "post_images_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- People can delete their own uploaded images (not currently used by the
-- app — there's no "delete post" button yet — but harmless to have ready).
drop policy if exists "post_images_delete_own" on storage.objects;
create policy "post_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- JOURNEY MAP — per-person avatar identity (added later — safe to re-run)
-- Icon is a short key from a fixed set the app offers (e.g. "lamb","fire",
-- "dove","star","jar","scroll","sea","moon"); color is a hex string from a
-- fixed palette the app offers. Both are just display data — no new table
-- needed, since journey progress itself is computed in app.js from the
-- existing group_challenge_completions rows (each check-in = one step).
-- ============================================================================

alter table profiles add column if not exists avatar_icon text;
alter table profiles add column if not exists avatar_color text;


-- ============================================================================
-- JOURNEY STEPS — daily journey fuel (revised)
--
-- Each of these can independently earn a point on a given day, and they
-- ADD UP (unlike an earlier version of this file, which capped everyone at
-- one point per day total):
--   reading_done    — checked off a reading-plan day today      (0 or 1)
--   prayer_done     — prayed for someone on the prayer wall     (0 or 1)
--   challenge_done  — did that week's suggested challenge       (0 or 1)
--   app_opens       — opened the app today                      (0 to 3)
-- Max possible in one day: 1+1+1+3 = 6.
--
-- One row per person per day (the primary key enforces that). Each action
-- upserts just its own column, so doing multiple things today only ever
-- sets flags to true / increments the counter — never overwrites the
-- others. app_opens is capped at 3 by app.js reading the current value
-- before incrementing (a 4th+ open that day is simply not written).
-- ============================================================================
create table if not exists journey_steps (
  user_id        uuid not null references profiles(id) on delete cascade,
  step_date      date not null,
  reading_done   boolean not null default false,
  prayer_done    boolean not null default false,
  challenge_done boolean not null default false,
  app_opens      smallint not null default 0,
  created_at     timestamptz not null default now(),
  primary key (user_id, step_date)
);

-- Safe for anyone upgrading from the earlier one-point-per-day version of
-- this table, which only had (user_id, step_date, created_at).
alter table journey_steps add column if not exists reading_done boolean not null default false;
alter table journey_steps add column if not exists prayer_done boolean not null default false;
alter table journey_steps add column if not exists challenge_done boolean not null default false;
alter table journey_steps add column if not exists app_opens smallint not null default 0;

alter table journey_steps enable row level security;

-- drop-then-create makes this section safe to re-run even after the
-- previous version of this file already created these exact policies
-- (plain "create policy" errors on a second run if the policy already
-- exists — "drop policy if exists" does not).
drop policy if exists "journey_steps_select_authenticated" on journey_steps;
create policy "journey_steps_select_authenticated"
  on journey_steps for select
  to authenticated
  using (true);

drop policy if exists "journey_steps_insert_own" on journey_steps;
create policy "journey_steps_insert_own"
  on journey_steps for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "journey_steps_update_own" on journey_steps;
create policy "journey_steps_update_own"
  on journey_steps for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================================================
-- CARE CALLS — a self-serve "who hasn't heard from us in a while" list
-- (ties to the ሥርዓት እና ግንኙነት ክፍል responsibility in the by-law: consulting on
-- students' relationships with each other). Nobody is assigned a specific
-- person to call — app.js instead shows everyone the same short,
-- most-overdue-first list, and whoever's active that day can pick one up.
-- That's what spreads ~30-40 people's worth of check-ins across the whole
-- community instead of it landing on one person, without needing any
-- admin/role system to formally assign callers (this app doesn't have one).
-- ============================================================================

alter table profiles add column if not exists phone text;

create table if not exists care_calls (
  id              uuid primary key default gen_random_uuid(),
  target_user_id  uuid not null references profiles(id) on delete cascade,
  caller_user_id  uuid references profiles(id) on delete set null,
  called_at       timestamptz not null default now()
);

create index if not exists care_calls_target_idx on care_calls (target_user_id, called_at desc);

alter table care_calls enable row level security;

drop policy if exists "care_calls_select_authenticated" on care_calls;
create policy "care_calls_select_authenticated"
  on care_calls for select
  to authenticated
  using (true);

drop policy if exists "care_calls_insert_own" on care_calls;
create policy "care_calls_insert_own"
  on care_calls for insert
  to authenticated
  with check (auth.uid() = caller_user_id);


-- ============================================================================
-- CARE CALL VERIFICATION (added later — safe to re-run)
-- A call only counts toward the caller's journey points once the RECEIVER
-- confirms it happened — not just on the caller's own say-so. Tapping
-- "I called" creates a row with verified=false (a claim, not a credit);
-- the target sees a generic "did someone call you today?" prompt (never
-- naming who claims to have called) and confirming sets verified=true for
-- every one of their pending claims from today at once. Nothing is ever
-- marked "false"/denied — an unconfirmed claim just stays pending forever,
-- which is what keeps this from being able to publicly shame anyone.
--
-- Trust note: RLS in Postgres works at the row level, not the column
-- level, so this update policy technically lets a target rewrite any
-- column on their own row, not just "verified". Given this app's existing
-- trust model (every profile field is already just as self-reported), that
-- tradeoff is accepted here rather than adding trigger-based column locks.
-- ============================================================================

alter table care_calls add column if not exists verified boolean not null default false;
alter table care_calls add column if not exists verified_at timestamptz;

drop policy if exists "care_calls_verify_own_as_target" on care_calls;
create policy "care_calls_verify_own_as_target"
  on care_calls for update
  to authenticated
  using (auth.uid() = target_user_id)
  with check (auth.uid() = target_user_id);


-- ============================================================================
-- ADMIN (added later — safe to re-run)
--
-- is_admin is set by YOU, directly in the Supabase Table Editor (Table
-- Editor → profiles → find the person's row → toggle is_admin to true).
-- There is no in-app way to grant it — that's deliberate; app.js only ever
-- READS this flag to decide whether to reveal the Admin tab, it never
-- writes it.
--
-- Everything the admin dashboard reads (profiles, journey_steps,
-- care_calls, feed_posts, prayer_requests) was ALREADY readable by every
-- signed-in member under the existing "select ... using (true)" policies
-- above — being an admin doesn't unlock any new visibility, it just adds a
-- UI that organizes what was already technically visible into something a
-- leader can actually act on. The two DELETE policies below are the only
-- genuinely NEW capability — regular members still cannot delete anyone's
-- feed post or prayer request, only an admin can.
-- ============================================================================

alter table profiles add column if not exists is_admin boolean not null default false;

drop policy if exists "feed_posts_delete_admin" on feed_posts;
create policy "feed_posts_delete_admin"
  on feed_posts for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "prayer_requests_delete_admin" on prayer_requests;
create policy "prayer_requests_delete_admin"
  on prayer_requests for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));
