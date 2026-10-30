import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { pauseFromGamePanel } from './fullscreen-helpers'

for (const mode of ['native', 'expanded'] as const) {
  test(`touch zoom and reset work through the pause menu in ${mode} fullscreen`, async ({ page }, testInfo) => {
    test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
    test.skip(testInfo.project.name === 'desktop', 'Exercises touchscreen input on phone and tablet')
    test.setTimeout(60_000)
    if (mode === 'expanded') {
      await page.addInitScript(() => {
        Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
      })
    }
    const directory = resolve('dos/lemmings')
    const files = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.dat'))
      .map(name => resolve(directory, name))
    await page.goto('/')
    await page.locator('input[type=file]').first().setInputFiles(files)
    await page.getByRole('link', { name: 'Play Lemmings' }).tap()
    await page.getByRole('button', { name: 'Start level' }).tap()
    const game = page.locator('.game-screen')
    const viewport = page.viewportSize()!
    const portrait = { width: Math.min(viewport.width, viewport.height), height: Math.max(viewport.width, viewport.height) }
    const landscape = { width: portrait.height, height: portrait.width }
    const zoomIn = page.getByRole('button', { name: 'Zoom in' })
    const zoomOut = page.getByRole('button', { name: 'Zoom out' })
    const reset = page.getByRole('button', { name: 'Reset zoom' })
    const canvas = page.getByLabel('Lemmings level. Drag to move the view.')

    if (mode === 'expanded') {
      await page.getByRole('button', { name: 'Fullscreen', exact: true }).tap()
      await expect(game).toHaveClass(/is-fullscreen/)
    }
    for (const size of [portrait, landscape]) {
      // Chromium cannot resize its native fullscreen window through Playwright.
      // Enter native fullscreen separately at each orientation; expanded mode
      // still exercises live rotation while the game remains fullscreen.
      await page.setViewportSize(size)
      if (mode === 'native') {
        await page.getByRole('button', { name: 'Fullscreen', exact: true }).tap()
        await expect(game).toHaveClass(/is-fullscreen/)
        await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true)
      }
      // Active play is just the uncropped game, without floating buttons.
      await expect(game.locator('button:visible:not(.fullscreen-a11y-pause)')).toHaveCount(0)
      const box = await canvas.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeCloseTo(Math.min(size.width, size.height * 5 / 3), 0)
      expect(box!.height).toBeCloseTo(Math.min(size.height, size.width * 3 / 5), 0)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.y).toBeGreaterThanOrEqual(0)
      await pauseFromGamePanel(canvas, true)
      await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
      if (mode === 'expanded') await expect(page.getByRole('status').filter({ hasText: 'Expanded view (browser fullscreen unavailable)' })).toBeVisible()
      for (const control of [zoomIn, zoomOut, reset]) {
        const rect = await control.boundingBox()
        expect(rect).not.toBeNull()
        expect(rect!.width).toBeGreaterThanOrEqual(44)
        expect(rect!.height).toBeGreaterThanOrEqual(44)
      }
      await expect(reset).toBeDisabled()
      const original = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
      await zoomIn.tap()
      await expect(reset).toBeEnabled()
      expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(original)
      await reset.tap()
      await expect(reset).toBeDisabled()
      expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(original)
      await zoomOut.tap()
      await expect(reset).toBeEnabled()
      await reset.tap()
      await expect(reset).toBeDisabled()
      if (mode === 'native' && size === portrait) {
        await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).tap()
        await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false)
        await expect(game).not.toHaveClass(/is-fullscreen/)
      }
      await page.getByRole('button', { name: 'Resume', exact: true }).tap()
    }
    await pauseFromGamePanel(canvas, true)
    await zoomIn.tap()
    await page.getByRole('button', { name: 'Resume', exact: true }).tap()
    await expect(game.locator('button:visible:not(.fullscreen-a11y-pause)')).toHaveCount(0)
    // Zooming the playfield must not move the original panel's pause target.
    await pauseFromGamePanel(canvas, true)
    await expect(reset).toBeEnabled()
    await reset.tap()
    await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).tap()
    await expect(game).not.toHaveClass(/is-fullscreen/)
    await page.getByRole('button', { name: 'Resume', exact: true }).tap()
    await expect(reset).toBeDisabled()
    await zoomIn.tap()
    await expect(reset).toBeEnabled()
    await reset.tap()
    await expect(reset).toBeDisabled()
  })
}
