/*
 * Offline-Cache. Bei jeder Änderung an den Dateien CACHE hochzählen –
 * sonst behält das Handy die alte Version.
 */
const CACHE = 'pump-tracker-v9';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './ocr.js',
  './charts.js',
  './stats.js',
  './drive.js',
  './backup.js',
  './exercise-icons.js',
  './reihenfolge.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Fremde Hosts (z. B. das Tesseract-CDN) nicht anfassen.
  if (url.origin !== location.origin) return;

  // Netz zuerst, Cache als Rückfall: so bekommst du Updates ohne Neuinstallation,
  // bleibst aber im Keller ohne Empfang lauffähig.
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match('./index.html'))
      )
  );
});
