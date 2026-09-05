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
