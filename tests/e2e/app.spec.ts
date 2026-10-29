import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { zipSync } from 'fflate'

test('explains local setup and rejects an incomplete import', async ({ page }) => {
  const outgoingWrites: string[] = []
  page.on('request', request => {
    if (!['GET', 'HEAD'].includes(request.method())) outgoingWrites.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Let's get them home." })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add your game files' })).toBeEnabled()
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'main.dat', mimeType: 'application/octet-stream', buffer: Buffer.from('synthetic'),
  })
  await expect(page.getByRole('status').filter({ hasText: 'Missing files:' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add your game files' })).toBeVisible()
  expect(outgoingWrites).toEqual([])
})

test('keeps the offline app shell after visiting the licence notices', async ({ page, context }) => {
  // Simulate an older installation whose cached shell was already replaced.
  await page.goto('/third-party.html')
  await page.evaluate(async () => {
    const oldCache = await caches.open('lemmings-shell-v1')
    await oldCache.put('/', new Response('<h1>Old cached notices</h1>', {
      headers: { 'Content-Type': 'text/html' },
    }))
  })
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await expect.poll(() => page.evaluate(() => caches.has('lemmings-shell-v1'))).toBe(false)

  // This is a real, separately served HTML document within the worker's
  // scope. It must never be cached as the Vue app's canonical document.
  await page.goto('/third-party.html')
  await expect(page.getByRole('heading', { name: 'Source and licences' })).toBeVisible()

  await context.setOffline(true)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Let's get them home." })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add your game files' })).toBeVisible()

  // A direct navigation to a Vue route still needs the shell when offline.
  await page.goto('/game/0')
  await expect(page.getByRole('link', { name: '← Levels' })).toBeVisible()
})

test('imports the local DOS files, plays, and reloads offline', async ({ page, context }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  const directory = resolve('dos/lemmings')
  const files = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve(directory, name))

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Add your game files' })).toBeEnabled()
  await page.locator('input[type=file]').first().setInputFiles(files)
  await expect(page.getByRole('link', { name: 'Play Lemmings' })).toBeVisible()
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.getByRole('heading', { name: 'Just dig!' })).toBeVisible()
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Dig\b/ }).click()
  await expect(page.getByRole('button', { name: /^Dig\b/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zoom in' }).click()

  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Just dig!' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start level' })).toBeEnabled()
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Dig\b/ }).click()
  await expect(page.getByRole('button', { name: /^Dig\b/ })).toHaveAttribute('aria-pressed', 'true')
})

test('completes the first level with a canvas interaction and keeps progress', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  test.setTimeout(60_000)
  // Observe real Web Audio lifetimes without exposing application internals.
  await page.addInitScript(() => {
    const Original = window.AudioContext
    const counts = { opened: 0, closed: 0 }
    ;(window as unknown as { audioTestCounts: typeof counts }).audioTestCounts = counts
    window.AudioContext = class extends Original {
      constructor() { super(); counts.opened++ }
      async close() { await super.close(); counts.closed++ }
    }
  })
  const files = (await readdir(resolve('dos/lemmings')))
    .filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve('dos/lemmings', name))

  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.getByRole('heading', { name: 'Just dig!' })).toBeVisible()
  await page.getByRole('button', { name: 'Sound off' }).click()
  await expect(page.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Start level' }).click()
  await page.getByRole('button', { name: /^Dig\b/ }).click()
  // Pause with two lemmings on the upper platform so the canvas tap remains
  // deterministic across slow and fast browser environments.
  await expect(page.locator('.time')).toHaveText('4-54', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()

  const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
  const target = await canvas.evaluate(element => {
    const canvas = element as HTMLCanvasElement
    const context = canvas.getContext('2d')
    if (!context) return null
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    // Find the leading lemming by its blue clothing in the upper-platform
    // area. This reads the rendered screen, not internal game state.
    let rightmost: { x: number; y: number } | null = null
    for (let y = 105; y < 180; y++) {
      for (let x = 150; x < 500; x++) {
        const offset = 4 * (y * canvas.width + x)
        if (pixels[offset] === 64 && pixels[offset + 1] === 64 && pixels[offset + 2] === 224 &&
            (!rightmost || x > rightmost.x)) rightmost = { x, y }
      }
    }
    return rightmost && { x: rightmost.x - 2, y: rightmost.y - 3 }
  })
  expect(target, 'a visible lemming should be on the upper platform').not.toBeNull()
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const position = { x: target!.x * box!.width / 800, y: target!.y * box!.height / 480 }
  if (testInfo.project.name.startsWith('android-')) await canvas.tap({ position })
  else await canvas.click({ position })

  await page.getByLabel('Speed').selectOption('4')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Dig\b/ })).toContainText('9')
  await expect(page.getByRole('status').filter({ hasText: 'Level complete!' })).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { audioTestCounts: { opened: number } }).audioTestCounts.opened)).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => {
    const counts = (window as unknown as { audioTestCounts: { opened: number; closed: number } }).audioTestCounts
    return counts.opened - counts.closed
  })).toBe(0)

  await page.getByRole('link', { name: '← Levels' }).click()
  await page.reload()
  await expect(page.getByLabel('Level').locator('option').first()).toHaveText('1 · best 100%')
})

test('imports a ZIP of the local DOS files', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  const directory = resolve('dos/lemmings')
  const names = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.dat'))
  const entries = await Promise.all(names.map(async name => [`lemmings/${name}`, new Uint8Array(await readFile(resolve(directory, name)))] as const))
  const archive = zipSync(Object.fromEntries(entries))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Add your game files' })).toBeEnabled()
  await page.locator('input[type=file]').first().setInputFiles({ name: 'lemmings.zip', mimeType: 'application/zip', buffer: Buffer.from(archive) })
  await expect(page.getByRole('link', { name: 'Play Lemmings' })).toBeVisible()
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.getByRole('heading', { name: 'Just dig!' })).toBeVisible()
})
