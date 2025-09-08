// 簡易 PWA 快取
const CACHE_NAME = 'nchu-schedule-v2';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
];

// 安裝：預快取核心檔案
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// 啟用：清理舊版快取
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((k) => (k === CACHE_NAME) ? null : caches.delete(k)))
        )
    );
    self.clients.claim();
});

// 取用：同源 GET 用「快取優先，回源更新」；其它直通網路
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

    event.respondWith(
        caches.match(req).then((cached) => {
            const fetchPromise = fetch(req)
                .then((res) => {
                    // 只快取 200
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    }
                    return res;
                })
                .catch(() => cached || caches.match('./index.html'));
            return cached || fetchPromise;
        })
    );
});
