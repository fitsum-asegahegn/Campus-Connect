// Campus Connect — service worker
// Two jobs:
//   1. Cache the app shell so the app opens instantly and works offline
//      once visited at least once (shared/community data is mirrored to
//      localStorage by app.js as a read-only offline fallback — see
//      README.md for what that does and doesn't cover).
//   2. Fire local reminder notifications — on a "periodicsync" wake-up when
//      the browser supports/grants it, using the schedule stored in
//      IndexedDB (idb-reminders.js) since service workers can't read
//      localStorage. See notifications.js for the full honest scope of
//      what local reminders can and can't guarantee.

importScripts("idb-reminders.js");

const CACHE_NAME = "campus-connect-v5";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./auth.js",
  "./db.js",
  "./idb-reminders.js",
  "./notifications.js",
  "./app.js",
  "./manifest.json",
  "./icons/logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests; let everything else (including all Supabase
  // writes) pass straight through untouched.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Never intercept Supabase API/auth calls — always hit the network so
  // data is live, and so we never accidentally cache a stale/authenticated
  // response.
  if (url.hostname.endsWith(".supabase.co")) return;

  // App-shell files: cache-first (instant load, works offline).
  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Other cross-origin (Google Fonts, the Supabase JS library CDN, etc.):
  // network-first, fall back to cache if offline, so these don't block
  // first load but still work offline after the first successful fetch.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req))
  );
});

/* ============================================================
   Local reminder notifications
   ============================================================ */

// Best-effort: on browsers/OSes that support Periodic Background Sync for
// an installed PWA (mainly Chrome/Edge on Android), this lets us check for
// due reminders without the app being open. Unsupported browsers (notably
// iOS Safari) simply never fire this event — foreground checks in
// notifications.js (on open, and every 60s while open) remain the
// reliable baseline everywhere.
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "campus-connect-check") {
    event.waitUntil(checkAndFireDueReminders());
  }
});

// Some browsers only expose one-off Background Sync; if a page requests it
// after scheduling a reminder, honor it as an extra chance to check.
self.addEventListener("sync", (event) => {
  if (event.tag === "campus-connect-check-once") {
    event.waitUntil(checkAndFireDueReminders());
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});

function todayKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function weekKeyLocal(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return d.getFullYear() + "-W" + week;
}
function isDue(r, now) {
  if (r.type === "one-off") return !r.fired && r.fireAt <= now.getTime();
  if (r.type === "recurring-daily") {
    const target = new Date(now); target.setHours(r.hour, r.minute, 0, 0);
    return now.getTime() >= target.getTime() && r.lastFiredDateKey !== todayKey(now);
  }
  if (r.type === "recurring-weekly") {
    const target = new Date(now); target.setHours(r.hour, r.minute, 0, 0);
    return now.getDay() === r.weekday && now.getTime() >= target.getTime() && r.lastFiredWeekKey !== weekKeyLocal(now);
  }
  return false;
}

async function checkAndFireDueReminders() {
  const items = await RemindersDB.getAll();
  const now = new Date();
  for (const r of items) {
    if (!isDue(r, now)) continue;
    // Service worker has no reliable language preference to read (that
    // lives in the page's JS state), so it defaults to Amharic here; the
    // foreground watcher in notifications.js uses whatever language the
    // person currently has selected.
    await self.registration.showNotification(r.title_am || r.title_en, {
      body: r.body_am || r.body_en,
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: r.id
    });
    if (r.type === "one-off") r.fired = true;
    if (r.type === "recurring-daily") r.lastFiredDateKey = todayKey(now);
    if (r.type === "recurring-weekly") r.lastFiredWeekKey = weekKeyLocal(now);
    await RemindersDB.put(r);
  }
}
