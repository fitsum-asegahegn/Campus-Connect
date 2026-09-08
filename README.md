# ግቢ ጉባኤ ትስስር · Campus Connect

A PWA to keep Fanote Tibeb Sunday School's university students connected to
their community while away — news feed, events/RSVP, spiritual life (daily
verse, prayer wall, reading plan), a small-group weekly check-in, and a
directory with an Ethiopian-calendar birthday feature. Backed by Supabase,
so the feed/directory/prayer wall/events are genuinely shared across everyone
using the app — not just stored on one phone.

## Files

```
index.html            — app shell (head, script loading order, body markup)
style.css              — all styling (design tokens as CSS variables at the top)
app.js                 — rendering + UI logic (talks to DB / Auth / Notifications)
db.js                  — Supabase data-access layer (one function per feature)
auth.js                — anonymous Supabase authentication
config.js              — YOUR Supabase URL + anon key go here
idb-reminders.js       — shared IndexedDB schedule (used by app.js AND sw.js)
notifications.js       — local notification permission + scheduling
supabase-schema.sql    — run this once in the Supabase SQL editor
manifest.json          — PWA manifest (name, icons, colors, install behavior)
sw.js                  — service worker (offline caching + reminder wake-ups)
icons/                 — logo + generated PWA icon sizes
```

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. **Dashboard → SQL Editor** → paste the entire contents of
   `supabase-schema.sql` → **Run**. This creates all tables, indexes, and
   Row Level Security policies.
3. **Dashboard → Authentication → Providers** → enable **"Allow anonymous
   sign-ins"**. This is off by default and the app will fail to sign anyone
   in without it. (See "Why anonymous auth?" below.)
4. **Dashboard → Project Settings → API** → copy:
   - **Project URL**
   - **anon / public** key
5. Open `config.js` and replace the two placeholder values:
   ```js
   window.SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   window.SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
   ```
   The anon key is safe to ship in client-side code — it has no special
   privileges on its own. Row Level Security (defined in the SQL file) is
   what actually decides who can read/write what.

## 2. Deploy on Vercel (from GitHub)

```bash
git init
git add .
git commit -m "Campus Connect PWA (Supabase-backed)"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then on [vercel.com](https://vercel.com): **Add New Project** → import that
repo → framework preset **"Other"** (static site, no build step, leave build
command empty) → **Deploy**.

Open the resulting `https://your-project.vercel.app` URL on a phone and use
"Add to Home Screen" — it installs like a native app using your logo.

## Why anonymous auth?

The app signs everyone in with `supabase.auth.signInAnonymously()` — no
email, no password, no OTP screen. This keeps the original "just fill in
your name and go" experience while still giving every person a real
`auth.uid()` that Row Level Security can check.

**Trade-off:** the session lives in that browser only. If someone switches
phones or clears site data, they get a new identity and re-fill their
profile — old posts stay under the old identity. `auth.js` has a commented
example at the bottom showing how to let someone later attach a real email
to their anonymous account (their `auth.uid()` — and therefore their whole
history — carries over automatically once they confirm it). That's an easy
add-on later; not required for the app to work today.

## What's genuinely shared now vs. before

The previous build used `localStorage`, so nothing synced between phones.
With Supabase connected:

| Feature | Shared across everyone? |
|---|---|
| Feed posts | yes |
| Directory | yes |
| Events | yes |
| Event RSVPs | personal (yours only) |
| Prayer wall | yes |
| "I'm praying" reactions | personal (yours only), count is shared |
| Reading plan check-ins | personal (yours only) |
| Weekly group challenge | yes (who's checked in is visible to all) |

## Extending it

- **Realtime**: Supabase supports live subscriptions
  (`supabaseClient.channel(...).on('postgres_changes', ...)`) — could be
  added to `db.js` so the feed/prayer wall update live without needing to
  reopen the tab. Not included yet, to keep this first pass simple.
- **Push notifications** (a server pinging everyone at an exact time) would
  need a small serverless function (Vercel Functions or a Supabase Edge
  Function) to call the Web Push API — see "Local vs. push notifications"
  below for what's already included instead.
- **Moderation**: there's currently no way to delete/hide a feed post or
  prayer request from the app itself. For a real church deployment you'll
  probably want a simple "leaders" role — either an `is_admin` boolean on
  `profiles` checked in a few extra RLS policies, or just moderate directly
  from the Supabase Table Editor for now.

## Photos in the feed

Feed posts can now include a photo (camera or gallery, picked via the file
input — mobile browsers show both options automatically). Under the hood:

- Images upload to a Supabase **Storage** bucket called `post-images`,
  created by the "IMAGES FOR FEED POSTS" section at the bottom of
  `supabase-schema.sql`. If you already ran the schema before this feature
  existed, just **re-run the whole file again** — every statement in it is
  safe to run more than once (`if not exists` / `on conflict do nothing`),
  so it will only add what's missing (the bucket, its policies, and the new
  `image_path` column on `feed_posts`) without touching existing data.
- The bucket is public-read (so images display via a plain URL) but people
  can only upload into a folder named after their own user id — enforced by
  a storage policy, the same pattern as everything else in this app.
- Limits: 5MB per photo, JPEG/PNG/WebP/GIF only — enforced both in the
  browser (before upload) and on the bucket itself (so it's not just a
  client-side check).
- Posts can now be text-only, photo-only, or both.
- Photos are fetched live from Supabase, not cached by the service worker
  (same as all other Supabase calls) — they need a connection to load, even
  if the rest of the app shell works offline.

## The Wilderness Journey (group map)

The old "weekly challenge roster" is now a shared adventure map, retelling
Exodus as a 4-chapter, 16-waypoint journey (*Out of Egypt → To Mount Sinai →
Through the Wilderness → To the Promised Land*). It reuses the exact same
weekly check-in action as before — nothing new to maintain — just visualizes
it differently:

- Every "Take this step" tap = one step, still gated to once per person per
  calendar week (enforced by the same database constraint as before).
- The **whole caravan** (gold ring) advances together once the community's
  combined steps cross each threshold (`STEPS_PER_WAYPOINT` in `app.js`,
  currently 8 — tune this up or down depending on how many people are
  actively checking in).
- **Individuals** show as their own picked avatar, positioned along the same
  stretch of road the caravan is on, based on their personal step count —
  so everyone's dot clusters near wherever the group is right now, visually
  pulling each other toward the next camp rather than racing separately.
- Past chapters show completed (✅), the current chapter shows in full
  detail, future chapters show locked/greyed with a 🔒 — browsable with the
  ‹ › arrows regardless of where the group actually is.
- **Auto-resets every Ethiopian new year** — journey math only counts
  check-ins from the current Ethiopian year (computed with the same
  calendar code used for birthdays), so nobody needs to press a reset
  button; old years' history stays in the database untouched, it just stops
  counting once Meskerem 1 arrives.

**Avatars**: required at profile setup, same as gender — an icon (🐑🔥🕊️⭐🏺📜🌊🌙)
and a color, stored on `profiles` (`avatar_icon`, `avatar_color` — added by
the "JOURNEY MAP" section at the bottom of `supabase-schema.sql`, safe to
re-run). Existing profiles created before this feature will show a default
avatar until they next open "Edit my info."

**Changing the story**: `CHAPTERS` near the top of `app.js` is a plain array
of `{title_am, title_en, waypoints: [{am, en} × 4]}` — edit names/count
freely, just keep each chapter at 4 waypoints (the map layout assumes 4
points per chapter; changing that means also touching `CHAPTER_POINTS` and
`buildChapterSVG`).

## Local reminder notifications

Tap the 🔔 in the header to turn on:
- **Daily verse** reminder (8:00 AM every day)
- **Weekly group challenge** reminder (Wednesdays 6:00 PM)

RSVPing to an event also auto-schedules a one-off reminder for the evening
before.

**New files behind this:** `idb-reminders.js` (a shared IndexedDB schedule —
used by both the page and the service worker, since service workers can't
read `localStorage`) and `notifications.js` (permission handling +
scheduling + the foreground check loop).

**Honest scope — please read before promising this to your community:**
this is **local** notification scheduling, not a push server. Concretely:

- ✅ Reliable whenever the app is open (checks on open, then every 60
  seconds), and whenever a notification is tapped, the service worker
  brings the app back to the foreground.
- ✅ Best-effort background checks via the **Periodic Background Sync**
  API on browsers/OSes that support it — mainly Chrome/Edge on Android for
  an *installed* PWA someone opens somewhat regularly. The browser decides
  if/when it actually runs this; it is not guaranteed to fire at exactly
  8:00 AM.
- ❌ **iOS Safari does not support Periodic Background Sync at all.**
  On iPhone, a reminder will only fire when someone actually opens the app
  around or after the scheduled time — not while it's closed in the
  background.
- ❌ No server is involved, so there's no way to guarantee "everyone gets
  notified at exactly 8:00 AM" the way a real push service would. If that
  guarantee matters (e.g. the "Emergency Prayer Chain" idea from the
  original brainstorm), that specifically needs a small backend sending
  real Web Push — the data model here doesn't need to change to add that
  later, it would just add a server-side trigger instead of relying on the
  browser to wake itself up.

## Offline support

Two separate things had to work together for "works offline" to actually
mean something, not just "doesn't show a blank white error page":

1. **App shell** (`sw.js`): HTML/CSS/JS/icons/fonts are precached on first
   visit, so the app opens instantly and works offline after that — this
   part is solid on any browser with service worker support.
2. **Data**: since the feed/events/prayer wall/directory now live in
   Supabase (not `localStorage`), `app.js` mirrors the last successful load
   of each into `localStorage` as a **read-only fallback**. When
   `navigator.onLine` is `false`, the app loads from that mirror instead of
   trying (and failing) to reach Supabase, and shows a banner explaining
   you're looking at previously-loaded content.

**What offline does NOT do:** posting, RSVPing, praying, reading-plan
check-ins, and profile edits all require a live connection — they're
blocked with a clear "you're offline" message rather than failing silently
or getting lost. There's no offline write queue/sync-when-reconnected in
this build. That's a reasonable v2 addition (Supabase's client doesn't do
this for you automatically) if being able to, say, post to the feed while
on a plane and have it send once you land turns out to matter.

**First-ever visit must be online** — anonymous sign-in itself needs one
network round-trip to Supabase. After that first successful sign-in, the
session is reused offline automatically.

**Boot sequence, concretely:** on open, the app renders instantly from
whatever's cached on the device (even if that's nothing yet) and the tabs
are clickable immediately — none of that waits on the network. Connecting
to Supabase happens in the background with a ~10 second timeout per step,
so a slow or stalled connection can't leave the UI stuck on a loading
message or with dead tabs. If it fails, it quietly retries every 15 seconds
whenever `navigator.onLine` is true, and immediately on the browser's
`online` event, until it connects — no reload needed.
