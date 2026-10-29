import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

for (const mode of ['native', 'expanded'] as const) {
  test(`touch zoom and reset work in ${mode} fullscreen in both orientations`, async ({ page }, testInfo) => {
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
    await page.getByRole('button', { name: 'Fullscreen', exact: true }).tap()
    const game = page.locator('.game-screen')
    await expect(game).toHaveClass(/is-fullscreen/)
    if (mode === 'native') await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true)

    // The canvas, rather than the surrounding page, occupies fullscreen.
    await expect(page.getByRole('button', { name: 'Controls', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Controls', exact: true }).tap()
    if (mode === 'expanded') await expect(page.getByRole('status').filter({ hasText: 'Expanded view (browser fullscreen unavailable)' })).toBeVisible()

    const viewport = page.viewportSize()!
    const portrait = { width: Math.min(viewport.width, viewport.height), height: Math.max(viewport.width, viewport.height) }
    const landscape = { width: portrait.height, height: portrait.width }
    const zoomIn = page.getByRole('button', { name: 'Zoom in' })
    const zoomOut = page.getByRole('button', { name: 'Zoom out' })
    const reset = page.getByRole('button', { name: 'Reset zoom' })
    const canvas = page.getByLabel('Lemmings level. Drag to move the view.')

    for (const size of [portrait, landscape]) {
      await page.setViewportSize(size)
      const box = await canvas.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeCloseTo(Math.min(size.width, size.height * 5 / 3), 0)
      expect(box!.height).toBeCloseTo(Math.min(size.height, size.width * 3 / 5), 0)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.y).toBeGreaterThanOrEqual(0)
      for (const control of [zoomIn, zoomOut, reset]) {
        const rect = await control.boundingBox()
        expect(rect).not.toBeNull()
        expect(rect!.width).toBeGreaterThanOrEqual(44)
        expect(rect!.height).toBeGreaterThanOrEqual(44)
      }
      await expect(reset).toBeDisabled()
      await zoomIn.tap()
      await expect(reset).toBeEnabled()
      await reset.tap()
      await expect(reset).toBeDisabled()
      await zoomOut.tap()
      await expect(reset).toBeEnabled()
      await reset.tap()
      await expect(reset).toBeDisabled()

      // Freeze the scene to compare actual canvas output at the two scales.
      await page.getByRole('button', { name: 'Close controls', exact: true }).tap()
      await page.getByRole('button', { name: 'Pause', exact: true }).tap()
      await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
      const original = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
      await zoomIn.tap()
      const enlarged = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
      expect(enlarged).not.toBe(original)
      await reset.tap()
      expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(original)
      await page.getByRole('button', { name: 'Resume', exact: true }).tap()
    }
    await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).tap()
    await expect(game).not.toHaveClass(/is-fullscreen/)
    await expect(reset).toBeDisabled()
    await zoomIn.tap()
    await expect(reset).toBeEnabled()
    await reset.tap()
    await expect(reset).toBeDisabled()
  })
}
