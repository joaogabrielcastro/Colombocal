/**
 * Kill-switch do PWA.
 * Versões antigas (v1/v2) cacheavam / e /login e prendiam o HTML/JS velho.
 * Esta versão limpa tudo, deixa de interceptar fetch e se desregistra.
 */
const BUILD = "colombocal-pwa-kill-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if ("navigate" in client) {
          try {
            await client.navigate(client.url);
          } catch {
            client.postMessage({ type: "COLOMBOCAL_SW_CLEARED", build: BUILD });
          }
        } else {
          client.postMessage({ type: "COLOMBOCAL_SW_CLEARED", build: BUILD });
        }
      }
    })(),
  );
});

// Não cacheia nada — sempre rede
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
