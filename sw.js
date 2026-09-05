// Campus Connect — service worker
// Caches the app shell so the app opens instantly and works offline once
// visited at least once. Data itself lives in localStorage (see app.js),
// which the browser already persists on its own — this file only handles
// caching the HTML/CSS/JS/icons/fonts needed to render the UI.

const CACHE_NAME = "campus-connect-v2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./auth.js",
  "./db.js",
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
