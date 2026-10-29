// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const origin = 'https://example.test/';
const oldHtml = '<script type="module" src="/assets/old.js"></script>';
const newHtml = '<script type="module" src="/assets/new.js"></script><link href="/assets/new.css">';

function worker() {
    const entries = new Map<string, Response>([[origin, new Response(oldHtml)], [`${origin}assets/old.js`, new Response('old')]]);
    const network = new Map<string, Response>();
    let offline = false;
    const fetch = async (request: string | { url: string }) => {
        const key = typeof request === 'string' ? request : request.url;
        if (offline) throw new Error('offline');
        return (network.get(key) ?? new Response('missing', { status: 404 })).clone();
    };
    const cache = {
        match: async (key: string | { url: string }) => entries.get(typeof key === 'string' ? key : key.url)?.clone(),
        put: async (key: string | { url: string }, response: Response) => { entries.set(typeof key === 'string' ? key : key.url, response.clone()); },
        addAll: async (keys: string[]) => {
            const responses = await Promise.all(keys.map(fetch));
            if (responses.some(response => !response.ok)) throw new Error('asset unavailable');
            keys.forEach((key, index) => entries.set(key, responses[index].clone()));
        },
    };
    const listeners: Record<string, (event: any) => void> = {};
    const self = { location: { href: `${origin}sw.js` }, clients: { claim: async () => {} },
        addEventListener: (name: string, listener: (event: any) => void) => { listeners[name] = listener; } };
    const caches = { open: async () => cache, keys: async () => [], delete: async () => true };
    runInNewContext(readFileSync('public/sw.js', 'utf8'), { self, caches, fetch, URL, Error, Set });
    const request = async (url: string, mode = 'navigate') => {
        let result!: Promise<Response>;
        listeners.fetch({ request: { url, mode, method: 'GET' }, respondWith: (promise: Promise<Response>) => { result = promise; } });
        return result;
    };
    const install = async () => {
        let result!: Promise<void>;
        listeners.install({ waitUntil: (promise: Promise<void>) => { result = promise; } });
        return result;
    };
    return { entries, network, request, install, goOffline: () => { offline = true; } };
}

describe('offline shell updates', () => {
    it('keeps the previous complete shell when an update asset fails, then works offline', async () => {
        const app = worker();
        app.network.set(origin, new Response(newHtml));
        app.network.set(`${origin}assets/new.js`, new Response('new', { headers: { 'Content-Type': 'text/javascript' } }));
        expect(await (await app.request(origin)).text()).toBe(oldHtml);
        expect(await app.entries.get(origin)!.clone().text()).toBe(oldHtml);
        app.goOffline();
        expect(await (await app.request(origin)).text()).toBe(oldHtml);
        expect(await (await app.request(`${origin}assets/old.js`, 'cors')).text()).toBe('old');
    });

    it('publishes the new shell only after its assets are cached and keeps old tab assets', async () => {
        const app = worker();
        app.network.set(origin, new Response(newHtml));
        app.network.set(`${origin}assets/new.js`, new Response('new', { headers: { 'Content-Type': 'text/javascript' } }));
        app.network.set(`${origin}assets/new.css`, new Response('style', { headers: { 'Content-Type': 'text/css' } }));
        expect(await (await app.request(origin)).text()).toBe(newHtml);
        app.goOffline();
        expect(await (await app.request(origin)).text()).toBe(newHtml);
        expect(await (await app.request(`${origin}assets/new.js`, 'cors')).text()).toBe('new');
        expect(await (await app.request(`${origin}assets/new.css`, 'cors')).text()).toBe('style');
        expect(await (await app.request(`${origin}assets/old.js`, 'cors')).text()).toBe('old');
    });

    it('does not overwrite the existing shell if a service worker installation cannot cache its assets', async () => {
        const app = worker();
        app.network.set(origin, new Response(newHtml));
        for (const path of ['data/config.json', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']) {
            app.network.set(`${origin}${path}`, new Response('ok'));
        }
        app.network.set(`${origin}assets/new.js`, new Response('ok', { headers: { 'Content-Type': 'text/javascript' } }));
        await expect(app.install()).rejects.toThrow('asset unavailable or invalid');
        expect(await app.entries.get(origin)!.clone().text()).toBe(oldHtml);
    });

    it('rejects an HTTP 200 HTML fallback served for a missing hashed asset', async () => {
        const app = worker();
        app.network.set(origin, new Response(newHtml));
        app.network.set(`${origin}assets/new.js`, new Response('new', { headers: { 'Content-Type': 'text/javascript' } }));
        app.network.set(`${origin}assets/new.css`, new Response('<html>SPA fallback</html>', { headers: { 'Content-Type': 'text/html' } }));
        expect(await (await app.request(origin)).text()).toBe(oldHtml);
        app.goOffline();
        expect(await (await app.request(origin)).text()).toBe(oldHtml);
    });
});
