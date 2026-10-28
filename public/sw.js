// Cache only the application shell. The owner's imported game files remain in IndexedDB.
const CACHE = 'lemmings-shell-v1';
const base = new URL('./', self.location.href);
const appUrl = new URL('./', base).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(appUrl, { cache: 'reload' });
    if (!response.ok) throw new Error('Could not cache the app');
    const html = await response.clone().text();
    await cache.put(appUrl, response);
    const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map(match => new URL(match[1], appUrl))
      .filter(url => url.origin === base.origin && url.pathname.startsWith(base.pathname) && /\.(?:js|css)$/.test(url.pathname))
      .map(url => url.href);
    await cache.addAll([...new Set([...resources, new URL('data/config.json', base).href, new URL('manifest.webmanifest', base).href, new URL('icons/icon-192.png', base).href, new URL('icons/icon-512.png', base).href])]);
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
  const navigation = request.mode === 'navigate';
  const shellResource = /\.(?:js|css|webmanifest|png)$/.test(url.pathname) || url.pathname === new URL('data/config.json', base).pathname;
  if (!navigation && !shellResource) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(navigation ? appUrl : request, response.clone());
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
