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
admin-reports.js       — Word/PowerPoint activity report generation (admin only, lazy-loaded)
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

A shared adventure map retelling Exodus as a 4-chapter, 16-waypoint journey
(*Out of Egypt → To Mount Sinai → Through the Wilderness → To the Promised
Land*).

**How points are earned, per calendar day (these ADD UP, not capped against
each other):**
- 📖 Checking off a reading-plan day — **+1**, once per day
- 🙏 Praying for someone on the prayer wall — **+1**, once per day
- ✅ Finishing that week's suggested challenge — **+1**, once per day
- 📱 Opening the app — **+1** per open, **capped at +3/day** — a 4th+ open
  that day earns nothing further

So the realistic max in one day is **6 points** (1+1+1+3), not 3 and not
unlimited. Each of these lives in its own column on a `journey_steps` row
(one row per person per day — `(user_id, step_date)` is the primary key),
so doing multiple things today sets multiple flags on the *same* row rather
than creating duplicates, and the app-open counter is read before
incrementing so it physically cannot go past 3 — none of this relies on the
app behaving correctly; someone refreshing repeatedly or calling the API
directly still hits the same ceiling.

- The **whole caravan** (gold ring) advances together once the community's
  combined points cross each threshold (`STEPS_PER_WAYPOINT` in `app.js`,
  currently 8 — tune up or down depending on real engagement, especially
  now that a very active day can be worth 6 points instead of 1).
- **Individuals** show as their own picked avatar, positioned along the same
  stretch of road the caravan is on, based on their personal point total.
- Past chapters show completed (✅), the current chapter shows in full
  detail, future chapters show locked/greyed with a 🔒 — browsable with the
  ‹ › arrows regardless of where the group actually is.
- **Auto-resets every Ethiopian new year** — journey math only counts points
  from the current Ethiopian year (same calendar code used for birthdays),
  so nobody needs to press a reset button.

**Avatars**: required at profile setup, same as gender — an icon (🐑🔥🕊️⭐🏺📜🌊🌙)
and a color, stored on `profiles` (`avatar_icon`, `avatar_color`). Existing
profiles created before this feature will show a default avatar until they
next open "Edit my info."

**A design tradeoff worth knowing about:** rewarding app opens (even capped
at 3) means the number partly reflects how often someone launches the app,
not only real engagement — someone could open it 3 times back-to-back doing
nothing else and bank 3 points. That's what was asked for, and the cap
keeps it bounded, but it's worth watching whether that changes the *feel*
of the roster once real usage comes in — easy to remove later by dropping
the `incrementAppOpenToday` call in `tryConnect()` in `app.js` if the
app-open points end up not adding much.

**Changing the story**: `CHAPTERS` near the top of `app.js` is a plain array
of `{title_am, title_en, waypoints: [{am, en} × 4]}` — edit names/count
freely, just keep each chapter at 4 waypoints (the map layout assumes 4
points per chapter; changing that means also touching `CHAPTER_POINTS` and
`buildChapterSVG`). To add another independent point source, add a boolean
column to `journey_steps`, a `DB.setTodayFlag(...)` call from that action's
handler in `app.js`, and include it in `getAllJourneyDays()`'s points sum
in `db.js`.

**Migration note:** this table has been revised twice now — first from a
weekly `group_challenge_completions` table to a one-point-per-day
`journey_steps` table, then to this additive four-source version. Both old
shapes are left in the database untouched for history; nothing writes to
them anymore.

## Care Calls (member check-in rotation)

Ties to the ሥርዓት እና ግንኙነት ክፍል responsibility in the by-law — consulting on
students' relationships with each other — turned into a shared, self-serve
list rather than one person's job.

**How it works:** the top of the Directory tab shows up to 3 people who've
gone the longest without a check-in call (or have never been called),
excluding yourself and anyone without a phone number on file. Anyone who
opens the app can tap the phone number (opens the real dialer via a `tel:`
link) and then mark "✓ I called" — which logs it and removes that person
from the suggestions for at least `CARE_CALL_MIN_GAP_DAYS` (3, tunable near
the top of `app.js`) days, so nobody gets called twice in the same week by
different people.

**Calls only earn a journey point once the receiver confirms them —
tapping "I called" is a claim, not a credit.** Concretely:
- Abebe taps "✓ I called" on Kebede's card → a `care_calls` row is created
  with `verified = false`. Nothing is credited yet.
- Kebede sees a generic banner at the top of the **Feed** tab: "📞 Did
  someone call you today?" — it never names who claims to have called.
  Tapping "✓ Yes, someone called me" confirms **every** pending claim
  against Kebede from today at once (there's no way to confirm one
  specific claim over another — that's intentional, see below).
- Only once confirmed does Abebe's claim add **+1 journey point**, counted
  in `computeJourney()` alongside the reading/prayer/challenge/app-open
  points. Unlike those four, confirmed calls are **not capped per day** —
  the cap here is social, not numeric: getting a real person to confirm a
  call actually happened is a much higher bar than any of the other
  self-reported actions.
- If Kebede never confirms — whether Abebe genuinely forgot to call, or
  called and Kebede just hasn't opened the app — the claim stays pending
  forever. It is never marked "denied" or shown as a failure anywhere;
  it simply never converts into a point. Nothing shames anyone for a
  claim that didn't pan out.

**Why the confirmation prompt never names the caller:** if two different
people both see "call Kebede" on the same day and both actually call him,
Kebede's one "yes, someone called me" tap confirms both of their claims —
there's no way to single out or dispute a specific claim from the UI. This
is a deliberate trade-off: it means a false claim can occasionally piggy-
back on a real "yes" if someone else genuinely called that same day, but
it also means nobody is ever put in the position of publicly confirming or
denying a specific named person's claim. Real-world knowledge (Kebede
knows who he actually spoke to) is what keeps this honest in practice, not
the UI.

**Why self-serve instead of assigning specific callers:** this app has no
leader/role system to formally assign "you call Selam today" to one
specific person — everyone who's completed profile setup sees the exact
same prioritized list. In practice this spreads ~30-40 people's worth of
check-ins across however many people are actively using the app, without
needing a schedule, a manager, or anyone feeling like it's become their
job. If a formal rota is wanted later, that would need an `is_committee`
role column on `profiles` (easy to add) plus a way to set it (not built —
there's no admin panel yet, so for now that would mean flipping it directly
in the Supabase Table Editor per person).

**Phone number**: required at profile setup now, alongside gender/avatar.
It is **not** shown in the general Directory list — only inside the Care
Calls cards. One honest caveat: like every other profile field, it's still
technically readable by any signed-in member through the API itself (Row
Level Security grants `select` on the whole `profiles` row to any
authenticated user, same as birthday/university already are) — "not shown
in the Directory list" describes the UI, not a hard access restriction.

## Admin dashboard

A leader-only tab — invisible to every regular member's UI, nothing about
the 5 normal tabs changes for them.

**Turning someone into an admin** is manual and deliberate: Supabase
Dashboard → Table Editor → `profiles` → find their row → set `is_admin` to
`true`. There is no in-app way to grant this, on purpose — `app.js` only
ever *reads* the flag. Once set, the 🛡 Admin tab appears next time that
person's app loads (checked once from cache immediately, then confirmed
again once a live connection lands, so it can't get stuck showing/hiding
incorrectly).

**What it shows, all computed from data every member's app already loads:**
- **Overview numbers**: total members, never-called count, how many need
  attention, total journey points earned all-time.
- **⚠️ Members needing attention** — sorted worst-first: nobody's confirmed
  calling them in `ADMIN_OVERDUE_DAYS` (14, tunable near the top of
  `app.js`) days, or ever. This is the direct answer to "who's long gone
  and nobody's reached" — someone who's both inactive *and* uncalled sorts
  to the very top.
- **Full member roster** — everyone, with their total journey points and
  last-confirmed-call.
- **Moderation** — the 15 most recent feed posts and prayer requests, each
  with a 🗑 Delete. This is the one genuinely new *capability* (not just
  visibility) admin status grants — regular members still cannot delete
  anyone's post. Enforced by two new RLS policies
  (`feed_posts_delete_admin`, `prayer_requests_delete_admin`) that check
  the caller's own `profiles.is_admin` — not just a client-side check, so
  it holds even if someone inspects the API directly.

**One thing worth being clear-eyed about**: nothing above required
unlocking new *visibility*. Every table the dashboard reads from
(`profiles`, `journey_steps`, `care_calls`, `feed_posts`,
`prayer_requests`) already grants `select` to any authenticated member —
including phone numbers, same as the rest of this app's trust model
(documented earlier in this file). Being admin doesn't see more data than
anyone technically already could; it organizes what was already readable
into something a leader can actually act on, plus the delete capability.

## Word & PowerPoint activity reports

Two buttons on the Admin tab — 📄 Word report and 📊 PowerPoint report —
generate a real `.docx` or `.pptx` file **entirely in the browser** and
download it immediately. No server, no Anthropic/OpenAI-style document
service, nothing leaves the browser except the two libraries that do the
actual file-building:

- **Word**: [docx.js](https://docx.js.org) loaded from
  `unpkg.com/docx@8/build/index.js`
- **PowerPoint**: [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) loaded
  from `cdn.jsdelivr.net/npm/pptxgenjs@3`

Both are **lazy-loaded** — the `<script>` tag is only injected the moment
an admin actually clicks one of the two buttons, so regular members never
download this code at all, and even admins only pay the cost the first
time they generate a report in a session. This does mean **generating a
report needs an internet connection** (to fetch the library), same as
everything else that talks to Supabase.

**Report contents** (identical data source for both formats, and identical
to what's on screen — nothing is computed separately for the export):
title/generation-date, the overview numbers, the "needs attention" table,
and the full member roster. The PowerPoint splits long tables across
multiple slides (10 rows each) automatically.

**Why this needed real libraries instead of something simpler**: a `.docx`
or `.pptx` file is a real, structured file format (technically a zip of
XML parts) — there's no shortcut that produces something Word/PowerPoint
will actually open correctly. `docx.js` is the same library already used
to generate the yearly departmental plan document earlier in this
project's history, just running in the browser this time (`Packer.toBlob`
instead of Node's `Packer.toBuffer`).



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
