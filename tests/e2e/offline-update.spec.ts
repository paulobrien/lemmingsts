import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { expect, test } from '@playwright/test'

test('reports when the app shell is ready offline', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: 'The app shell is ready offline. Add your game files to play.' })).toBeVisible()
})

test('reports when offline preparation fails', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(new Error('unavailable')) })
  })
  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: 'Offline play may be unavailable.' })).toBeVisible()
})

test('keeps the previous offline shell when a new build is incomplete', async ({ page, context }) => {
  const worker = await readFile('public/sw.js')
  let version = 'old'
  let missingAsset = false
  let oldAssetsRemoved = false
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    const path = new URL(request.url || '/', 'http://localhost').pathname
    if (path === '/sw.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(worker); return }
    if (path === '/') {
      response.setHeader('Content-Type', 'text/html')
      response.end(`<h1>${version} shell</h1><script type="module" src="/assets/${version}.js"></script><link rel="stylesheet" href="/assets/${version}.css">`)
      return
    }
    if (path === '/assets/new.css' && missingAsset) {
      response.setHeader('Content-Type', 'text/html'); response.end('<h1>SPA fallback</h1>'); return
    }
    if (oldAssetsRemoved && ['/assets/old.js', '/assets/old.css'].includes(path)) {
      response.setHeader('Content-Type', 'text/html'); response.end('<h1>SPA fallback</h1>'); return
    }
    if (path.startsWith('/assets/')) { response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css'); response.end(path.endsWith('.js') ? 'export {}' : 'body{}'); return }
    if (['/data/config.json', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'].includes(path)) { response.end('synthetic'); return }
    response.statusCode = 404
    response.end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  try {
    await page.goto(url)
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready })
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    version = 'new'
    missingAsset = true
    await page.reload()
    await expect(page.getByRole('heading', { name: 'old shell' })).toBeVisible()
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'old shell' })).toBeVisible()
    await context.setOffline(false)
    missingAsset = false
    await page.reload()
    await expect(page.getByRole('heading', { name: 'new shell' })).toBeVisible()
    oldAssetsRemoved = true
    // Already-open versions may request their old hashed assets after deployment.
    // A host's HTTP 200 HTML fallback must not overwrite those cached resources.
    expect(await page.evaluate(async () => (await fetch('/assets/old.js')).text())).toBe('export {}')
    expect(await page.evaluate(async () => (await fetch('/assets/old.css')).text())).toBe('body{}')
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'new shell' })).toBeVisible()
    expect(await page.evaluate(async () => (await fetch('/assets/old.js')).text())).toBe('export {}')
  } finally {
    await context.setOffline(false)
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
