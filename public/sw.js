// Cache only the application shell. The owner's imported game files remain in IndexedDB.
// A new cache also replaces any shell corrupted by older navigation handling.
const CACHE = 'lemmings-shell-v2';
const base = new URL('./', self.location.href);
const appUrl = new URL('./', base).href;
const indexPath = new URL('index.html', base).pathname;
const gamePath = new URL('game/', base).pathname;
const localGamePath = new URL('data/local-game/', base).pathname;

// Never replace a working offline document until all of its hashed assets
// have been cached. Keep old assets for tabs still running the previous build.
async function cacheShell(cache, response) {
  const html = await response.clone().text();
  const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match => new URL(match[1], appUrl))
    .filter(url => url.origin === base.origin && url.pathname.startsWith(base.pathname) && /\.(?:js|css)$/.test(url.pathname))
    .map(url => url.href);
  if (!resources.some(url => /\.js(?:\?|$)/.test(url))) throw new Error('App shell has no script');
  // SPA hosts may answer a missing hashed asset with their HTML fallback and
  // status 200. Do not commit a shell until each asset is actually usable.
  const staged = await Promise.all([...new Set(resources)].map(async url => {
    const asset = await fetch(url);
    const contentType = (asset.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const javascript = new URL(url).pathname.endsWith('.js');
    const validType = javascript
      ? /^(?:text|application)\/(?:x-)?(?:java|ecma)script$/.test(contentType)
      : contentType === 'text/css';
    if (!asset.ok || !validType) throw new Error('App shell asset unavailable or invalid');
    return { url, asset };
  }));
  for (const { url, asset } of staged) await cache.put(url, asset);
  await cache.put(appUrl, response.clone());
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(appUrl, { cache: 'reload' });
    if (!response.ok) throw new Error('Could not cache the app');
    await cache.addAll([new URL('data/config.json', base).href, new URL('manifest.webmanifest', base).href, new URL('icons/icon-192.png', base).href, new URL('icons/icon-512.png', base).href]);
    await cacheShell(cache, response);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('lemmings-shell-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  // Optional privately hosted DOS files are imported into IndexedDB by the
  // application. Never copy those responses into the shared shell cache.
  if (url.pathname.startsWith(localGamePath)) return;
  const navigation = request.mode === 'navigate';
  const appDocument = url.pathname === base.pathname || url.pathname === indexPath;
  // Vue owns only the home and game routes. Other HTML pages, such as the
  // licence notices, must not replace or masquerade as the offline shell.
  const gameRoute = url.pathname.startsWith(gamePath) && /^[^/]+\/?$/.test(url.pathname.slice(gamePath.length));
  if (navigation && !appDocument && !gameRoute) return;
  const shellResource = /\.(?:js|css|webmanifest|png)$/.test(url.pathname) || url.pathname === new URL('data/config.json', base).pathname;
  if (!navigation && !shellResource) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) {
        // Both app routes must stage a complete shell before it becomes the
        // offline document. Non-app HTML never reaches this handler.
        if (navigation) await cacheShell(cache, response);
        else await cache.put(request, response.clone());
      } else {
        // A newly deployed build may no longer serve an older hashed asset.
        // Keep an already-open version working until its next reload.
        const cached = await cache.match(navigation ? appUrl : request, { ignoreVary: true });
        if (cached) return cached;
      }
      return response;
    } catch (error) {
      const cached = await cache.match(navigation ? appUrl : request, { ignoreVary: true });
      if (cached) return cached;
      throw error;
    }
  })());
});
