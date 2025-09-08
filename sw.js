// PWA �֨��]�O�o�C�����j��N�⪩�� +1�^
const CACHE_NAME = 'nchu-schedule-v4';
const ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

// �w�ˡG�w���֨��֤���
self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

// �ҥΡG�M���ª��֨�
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))))
        ).then(() => self.clients.claim())
    );
});

// ���ε����GHTML ���u�����u���v�A��L���u�֨��u���v
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

    const accept = req.headers.get('accept') || '';
    if (accept.includes('text/html')) {
        // Network-first for HTML�]�קK�Y���� index�^
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
