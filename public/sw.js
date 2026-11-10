// Service worker do MKI: o app abre e mostra os dados já visitados sem internet.
// - arquivos estáticos: cache primeiro
// - páginas (HTML e dados do Next): rede primeiro, cache como reserva
// - /api e ações do servidor nunca são guardados (os registros offline vão por uma fila no IndexedDB)
const VERSION = "v2";
const STATIC = `mki-static-${VERSION}`;
const PAGES = `mki-pages-${VERSION}`;
const MAX_PAGES = 80;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.add("/offline.html")));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// ao sair da conta, o app pede para apagar as páginas guardadas
self.addEventListener("message", (e) => {
  if (e.data === "clear-private-caches") e.waitUntil(caches.delete(PAGES));
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PAGES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js" || req.headers.has("next-action")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/")) {
    e.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  const isPage = req.mode === "navigate" || req.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (!isPage) return;
  e.respondWith((async () => {
    const cache = await caches.open(PAGES);
    try {
      const res = await fetch(req);
      if (res.ok && !res.redirected && new URL(res.url).pathname !== "/login") { cache.put(req, res.clone()); trim(cache); }
      return res;
    } catch {
      const hit = await cache.match(req);
      if (hit) return hit;
      if (req.mode === "navigate") return (await caches.match("/offline.html")) ?? Response.error();
      return Response.error();
    }
  })());
});

// Notificações (Web Push): mostra o aviso e abre a tela certa ao tocar.
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: "MKI", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(data.title || "MKI", {
    body: data.body || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: data.tag || undefined,
    data: { url: typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if (new URL(c.url).origin === self.location.origin && "focus" in c) { await c.focus(); if ("navigate" in c) await c.navigate(url).catch(() => undefined); return; } }
    await clients.openWindow(url);
  })());
});
