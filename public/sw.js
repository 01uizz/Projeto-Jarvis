/* JARVIS service worker.
 * Objetivo: tornar o app instalável e abrir a "casca" quando a rede falhar.
 * NÃO faz sincronização em segundo plano nem push: lembretes só aparecem com o app aberto.
 * Nunca guarda respostas do Supabase (outro domínio) nem requisições que não sejam GET. */
const VERSION = "jarvis-v2";
const SHELL = ["/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase e outros domínios passam direto
  if (url.pathname.startsWith("/auth/")) return; // fluxo de login/e-mail nunca vem do cache

  if (url.pathname.startsWith("/api/")) return; // Core: nunca em cache

  if (req.mode === "navigate") {
    // Só a casca do app (/app) fica disponível offline; o site público sempre vem da rede.
    const isApp = url.pathname === "/app" || url.pathname.startsWith("/app/");
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isApp && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put("/app", copy));
          }
          return res;
        })
        .catch(() =>
          (isApp ? caches.match("/app") : Promise.resolve(undefined)).then(
            (hit) => hit || new Response("Você está offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }),
          ),
        ),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    // Arquivos versionados: cache primeiro
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
  }
});
