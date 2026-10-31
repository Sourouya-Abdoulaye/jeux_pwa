/* DevMaster PWA — Service Worker
   Stratégie : précache de la coquille applicative, cache-first avec
   rafraîchissement en arrière-plan. La progression utilisateur n'est JAMAIS
   stockée ici : elle appartient au localStorage de l'application. */

const CACHE_VERSION = "devmaster-v5";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-180.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return; /* ne jamais intercepter les écritures */
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; /* rien d'externe n'est indispensable */

  /* Une navigation vers un fichier (PDF, image…) ne doit jamais écraser
     la coquille index.html : on la cache sous sa propre URL. */
  const isShell = req.mode === "navigate" && (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"));
  if (req.mode === "navigate" && !isShell) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  if (isShell) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put("./index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
