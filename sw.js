// 超輕量快取，首次載入就能離線開啟基本頁面
const CACHE = "nchu-pwa-v1";
const ASSETS = [
    "./",
    "./index.html",
    "./app.js",
    // 若你把 CSS、icons、manifest.json 分開，記得加上
    // "./style.css",
    // "./manifest.json",
    // "./icons/icon-192.png",
];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE && caches.delete(k))))
    );
});
self.addEventListener("fetch", (e) => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request).catch(() => caches.match("./index.html")))
    );
});
