// �W���q�֨��A�������J�N�����u�}�Ұ򥻭���
const CACHE = "nchu-pwa-v1";
const ASSETS = [
    "./",
    "./index.html",
    "./app.js",
    // �Y�A�� CSS�Bicons�Bmanifest.json ���}�A�O�o�[�W
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
