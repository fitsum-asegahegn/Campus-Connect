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
app.js                 — rendering + UI logic (talks to DB / Auth, never Supabase directly)
db.js                  — Supabase data-access layer (one function per feature)
auth.js                — anonymous Supabase authentication
config.js              — YOUR Supabase URL + anon key go here
supabase-schema.sql    — run this once in the Supabase SQL editor
manifest.json          — PWA manifest (name, icons, colors, install behavior)
sw.js                  — service worker (offline caching of the app shell)
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
- **Push notifications** for the "urgent prayer request" idea from the
  original brainstorm would need a small serverless function (Vercel
  Functions or a Supabase Edge Function) to call the Web Push API — the
  schema/data model here doesn't need to change to support that later.
- **Moderation**: there's currently no way to delete/hide a feed post or
  prayer request from the app itself. For a real church deployment you'll
  probably want a simple "leaders" role — either an `is_admin` boolean on
  `profiles` checked in a few extra RLS policies, or just moderate directly
  from the Supabase Table Editor for now.
