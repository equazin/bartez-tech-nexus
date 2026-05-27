// Bartez B2B service worker
// Strategy:
//  - Cache-first for static assets (Vite's hashed /assets/*).
//  - Network-first with fallback for navigations (so HTML stays fresh).
//  - Bypass entirely for /api/* and Supabase RPC — those have their own
//    retry/queue logic on the app side.

const VERSION = "bartez-sw-v1";
const SHELL = [
  "/",
  "/site.webmanifest",
  "/icon.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

function isAsset(url) {
  return url.pathname.startsWith("/assets/")
      || url.pathname.startsWith("/email/")
      || url.pathname.endsWith(".js")
      || url.pathname.endsWith(".css")
      || url.pathname.endsWith(".woff2")
      || url.pathname.endsWith(".woff")
      || url.pathname.endsWith(".png")
      || url.pathname.endsWith(".jpg")
      || url.pathname.endsWith(".svg")
      || url.pathname.endsWith(".webp");
}

function isNavigation(request) {
  return request.mode === "navigate"
      || (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API calls or Supabase requests.
  if (url.pathname.startsWith("/api/")) return;

  if (isAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response.ok || response.type !== "basic") return response;
          const clone = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, clone));
          return response;
        });
      }),
    );
    return;
  }

  if (isNavigation(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, clone)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
  }
});
