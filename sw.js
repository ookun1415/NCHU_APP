// ¶WÂ²ª© PWA §Ö¨ú
const CACHE = "nchu-pwa-v2";
const ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"
];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});
self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => k === CACHE ? null : caches.delete(k))))
    );
    self.clients.claim();
});
self.addEventListener("fetch", (e) => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request).catch(() => caches.match("./")))
    );
});
