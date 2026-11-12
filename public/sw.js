// Cache only the application shell. The owner's imported game files remain in IndexedDB.
// A new cache also replaces any shell corrupted by older navigation handling.
const CACHE = 'lemmings-shell-v2';
const base = new URL('./', self.location.href);
const appUrl = new URL('./', base).href;
const indexPath = new URL('index.html', base).pathname;
const gamePath = new URL('game/', base).pathname;
const localGamePath = new URL('data/local-game/', base).pathname;
const localAudioPath = new URL('data/local-windows-audio/', base).pathname;
const localGraphicsPath = new URL('data/local-windows-graphics/', base).pathname;
const localWindowsGamePath = new URL('data/local-windows-game/', base).pathname;
// A cached page should not be held hostage by a connection that accepts a
// request but never responds (common when Wi-Fi has lost internet access).
const CACHED_NETWORK_TIMEOUT_MS = 1500;

function isUsableShellResource(url, response) {
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const path = new URL(url).pathname;
  if (path.endsWith('.js')) return /^(?:text|application)\/(?:x-)?(?:java|ecma)script$/.test(contentType);
  if (path.endsWith('.css')) return contentType === 'text/css';
  // Missing assets on SPA hosts can return the app document with status 200.
  // Do not let those responses replace a working icon or configuration either.
  return contentType !== 'text/html';
}

// Never replace a working offline document until all of its hashed assets
// have been cached. Keep old assets for tabs still running the previous build.
async function cacheShell(cache, response, supportingResources = [], signal) {
  const html = await response.clone().text();
  const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match => new URL(match[1], appUrl))
    .filter(url => url.origin === base.origin && url.pathname.startsWith(base.pathname) && /\.(?:js|css)$/.test(url.pathname))
    .map(url => url.href);
  if (!resources.some(url => /\.js(?:\?|$)/.test(url))) throw new Error('App shell has no script');
  // SPA hosts may answer a missing hashed asset with their HTML fallback and
  // status 200. Do not commit a shell until each asset is actually usable.
  const staged = await Promise.all([...new Set([...resources, ...supportingResources])].map(async url => {
    const asset = await fetch(url, { signal });
    if (!asset.ok || !isUsableShellResource(url, asset)) throw new Error('App shell asset unavailable or invalid');
    // Fetch resolves at headers. Drain the body now so connection slots can
    // serve the remaining assets and a truncated download fails before writes.
    // Keep the original response (including its URL/headers) for Cache.put.
    await asset.clone().arrayBuffer();
    return { url, asset };
  }));
  if (signal?.aborted) throw new Error('App shell update timed out');
  for (const { url, asset } of staged) {
    if (signal?.aborted) throw new Error('App shell update timed out');
    await cache.put(url, asset);
  }
  if (signal?.aborted) throw new Error('App shell update timed out');
  await cache.put(appUrl, response.clone());
}

async function withCachedNetworkDeadline(task) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      task(controller.signal),
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Network timed out')); }, CACHED_NETWORK_TIMEOUT_MS);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(appUrl, { cache: 'reload' });
    if (!response.ok) throw new Error('Could not cache the app');
    // Stage supporting files together with the document's assets. In
    // particular, a SPA fallback for a missing config must not overwrite the
    // working offline config even if installation later fails on a script.
    await cacheShell(cache, response, ['data/config.json', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']
      .map(path => new URL(path, base).href));
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
  // Optional deployment-supplied DOS files are imported into IndexedDB by the
  // application. Never copy those responses into the shared shell cache.
  if (url.pathname.startsWith(localGamePath) || url.pathname.startsWith(localAudioPath) || url.pathname.startsWith(localGraphicsPath) || url.pathname.startsWith(localWindowsGamePath)) return;
  const navigation = request.mode === 'navigate';
  const appDocument = url.pathname === base.pathname || url.pathname === indexPath;
  // Vue owns only the home and game routes. Other HTML pages, such as the
  // licence notices, must not replace or masquerade as the offline shell.
  const gameRoute = url.pathname.startsWith(gamePath) && /^[^/]+\/?$/.test(url.pathname.slice(gamePath.length));
  if (navigation && !appDocument && !gameRoute) return;
  const shellResource = /\.(?:js|css|webmanifest|png)$/.test(url.pathname) || url.pathname === new URL('data/config.json', base).pathname;
  if (!navigation && !shellResource) return;
  event.respondWith((async () => {
    let cache;
    try { cache = await caches.open(CACHE); }
    catch { return fetch(request); }
    const cached = await cache.match(navigation ? appUrl : request, { ignoreVary: true });
    if (cached && self.navigator?.onLine === false) return cached;
    let response;
    try {
      const update = async signal => {
        response = await fetch(request, { signal });
        if (response.ok && (navigation || isUsableShellResource(url, response))) {
          // Publish a navigation only after its full shell is cached.
          if (navigation) await cacheShell(cache, response, [], signal);
          else if (!signal?.aborted) await cache.put(request, response.clone());
        } else if (cached) return cached;
        return response;
      };
      return cached ? await withCachedNetworkDeadline(update) : await update();
    } catch (error) {
      if (cached) return cached;
      // Storage may be full or evicted. A successful network response should
      // still work online when there is no cached version to fall back to.
      if (response?.ok) return response;
      throw error;
    }
  })());
});
