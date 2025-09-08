// PWA 快取（記得每次有大改就把版本 +1）
const CACHE_NAME = 'nchu-schedule-v4';
const ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

// 安裝：預先快取核心檔
self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

// 啟用：清掉舊版快取
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))))
        ).then(() => self.clients.claim())
    );
});

// 取用策略：HTML 走「網路優先」，其他走「快取優先」
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

    const accept = req.headers.get('accept') || '';
    if (accept.includes('text/html')) {
        // Network-first for HTML（避免吃到舊 index）
        event.respondWith(
            fetch(req).then(res => {
                const copy = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(req, copy));
                return res;
            }).catch(() => caches.match(req))
        );
    } else {
        // Cache-first for static
        event.respondWith(
            caches.match(req).then(cached => cached || fetch(req).then(res => {
                if (res && res.status === 200) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, copy));
                }
                return res;
            }).catch(() => caches.match('./index.html')))
        );
    }
});
