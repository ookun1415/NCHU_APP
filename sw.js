// ²�� PWA �֨�
const CACHE_NAME = 'nchu-schedule-v2';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
];

// �w�ˡG�w�֨��֤��ɮ�
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// �ҥΡG�M�z�ª��֨�
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((k) => (k === CACHE_NAME) ? null : caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ���ΡG�P�� GET �Ρu�֨��u���A�^����s�v�F�䥦���q����
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

    event.respondWith(
        caches.match(req).then((cached) => {
            const fetchPromise = fetch(req)
                .then((res) => {
                    // �u�֨� 200
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
