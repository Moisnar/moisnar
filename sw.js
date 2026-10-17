/* MOISNAR service worker
   - Precaches the app shell so the app opens instantly and works offline.
   - Code files (html / js / json): network-first (4s timeout), cache as fallback, so a new deploy is never served half-old.
   - Icons / images / Google Fonts: stale-while-revalidate for instant loads.
   - Everything else (API calls, uploads, other origins) is NOT intercepted: when the backend is connected it keeps working as is.
   Bump VERSION on every deploy to refresh the shell cache. */
'use strict';
const VERSION = 'v1.0.3';
const SHELL = 'moisnar-shell-' + VERSION;
const RUNTIME = 'moisnar-runtime-' + VERSION;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const RUNTIME_MAX = 80;
const NET_TIMEOUT = 4000;
const PRECACHE = [
  'index.html',
  'App.html',
  'App.js',
  'pwa.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon-v2.png',
  'icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('moisnar-') && k !== SHELL && k !== RUNTIME)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') return e.respondWith(networkFirst(e, /App\.html$/i.test(url.pathname) ? 'App.html' : 'index.html', true));
    if (/\.(?:html|js|json)$/i.test(url.pathname)) return e.respondWith(networkFirst(e, req, false));
    return e.respondWith(staleWhileRevalidate(e, RUNTIME));
  }
  if (FONT_HOSTS.includes(url.hostname)) return e.respondWith(staleWhileRevalidate(e, RUNTIME));
  /* any other origin: leave it to the browser */
});

async function networkFirst(e, key, isNav) {
  const cache = await caches.open(SHELL);
  const net = fetch(e.request).then(res => {
    if (res && res.ok && res.type === 'basic' && !(isNav && res.redirected)) cache.put(key, res.clone());
    return res;
  });
  net.catch(() => {});
  e.waitUntil(net.catch(() => {}));
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NET_TIMEOUT));
  try {
    return await Promise.race([net, timeout]);
  } catch (err) {
    const hit = await cache.match(key, { ignoreSearch: true });
    if (hit) return hit;
    try { return await net; } catch (err2) { return Response.error(); }
  }
}

async function staleWhileRevalidate(e, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(e.request);
  const net = fetch(e.request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(e.request, res.clone()).then(() => trim(cache));
    }
    return res;
  }).catch(() => null);
  if (hit) { e.waitUntil(net); return hit; }
  return (await net) || Response.error();
}

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > RUNTIME_MAX) await Promise.all(keys.slice(0, keys.length - RUNTIME_MAX).map(k => cache.delete(k)));
}
