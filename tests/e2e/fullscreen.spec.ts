import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('uses the browser fullscreen API and tracks exit', async ({ page }) => {
  await page.goto('/game/0')
  const enter = page.getByRole('button', { name: 'Fullscreen', exact: true })
  await enter.click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains('game-page'))).toBe(true)
  const exit = page.getByRole('button', { name: 'Exit fullscreen', exact: true })
  await expect(exit).toHaveAttribute('aria-pressed', 'true')
  // A browser-controlled exit must update the control too.
  await page.evaluate(() => document.exitFullscreen())
  await expect(enter).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.game-page')).not.toHaveClass(/is-fullscreen/)
})

test('offers an escapable expanded view when native fullscreen is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
  })
  await page.goto('/game/0')
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  const game = page.locator('.game-page')
  await expect(game).toHaveClass(/is-fullscreen/)
  await expect(page.getByRole('status').filter({ hasText: 'Expanded view (browser fullscreen unavailable)' })).toBeVisible()
  const rect = await game.boundingBox()
  const viewport = page.viewportSize()!
  expect(rect!.x).toBe(0)
  expect(rect!.y).toBe(0)
  expect(rect!.width).toBe(viewport.width)
  expect(rect!.height).toBe(viewport.height)
  await page.keyboard.press('Escape')
  await expect(game).not.toHaveClass(/is-fullscreen/)
  await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  await page.getByRole('link', { name: '← Levels' }).click()
  await expect(page.getByRole('heading', { name: "Let's get them home." })).toBeVisible()
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
})

test('keeps pause and skill controls usable in expanded view in portrait and landscape', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
  })
  const directory = resolve('dos/lemmings')
  const files = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve(directory, name))
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size)
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
    await page.getByRole('button', { name: 'Resume', exact: true }).click()
    await page.getByRole('button', { name: /^Dig\b/ }).click()
    await expect(page.getByRole('button', { name: /^Dig\b/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeEnabled()
    await page.locator('.game-page').evaluate(element => { element.scrollTop = 0 })
    const skill = await page.getByRole('button', { name: /^Dig\b/ }).boundingBox()
    const canvas = await page.getByLabel('Lemmings level. Drag to move the view.').boundingBox()
    expect(skill!.y + skill!.height).toBeLessThanOrEqual(size.height)
    expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(size.height)
  }
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Show a hint', exact: true }).click()
  await expect(page.locator('.hints li')).toHaveCount(1)
  await page.getByRole('button', { name: 'Another hint', exact: true }).click()
  await expect(page.locator('.hints li')).toHaveCount(2)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click()
  await expect(page.locator('.game-page')).not.toHaveClass(/is-fullscreen/)
})
