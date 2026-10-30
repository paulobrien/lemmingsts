import { expect, test } from '@playwright/test'
import { pressGamePanel } from './fullscreen-helpers'

for (const expanded of [false, true]) {
  test(`Windows ${expanded ? 'expanded' : 'native'} fullscreen fills the viewport when entered before start`, async ({ page }, testInfo) => {
    test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO, 'Requires the local Windows ISO')
    if (expanded) await page.addInitScript(() => {
      Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
    })
    await page.setViewportSize({ width: 1200, height: 768 })
    await page.goto('/')
    await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
    await page.getByRole('link', { name: 'Play Lemmings' }).click()
    await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
    const screen = page.locator('.game-screen')
    await expect(screen).toHaveClass(/is-fullscreen/)
    await page.getByRole('button', { name: 'Start level' }).click()
    await expect(screen).toHaveClass(/native-windows-playing/)
    const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
    const geometry = () => canvas.evaluate((element: HTMLCanvasElement) => {
      const b = element.getBoundingClientRect(), s = element.closest('.game-screen')!.getBoundingClientRect()
      return { top: b.top - s.top, bottom: s.bottom - b.bottom, left: b.left - s.left, right: s.right - b.right,
        sx: b.width / element.width, sy: b.height / element.height, height: element.height }
    })
    const check = async () => {
      await expect.poll(async () => Math.abs((await geometry()).bottom)).toBeLessThan(1.5)
      await expect.poll(async () => Math.abs((await geometry()).top)).toBeLessThan(1.5)
      const result = await geometry()
      expect(Math.abs(result.left)).toBeLessThan(1.5)
      expect(Math.abs(result.right)).toBeLessThan(1.5)
      expect(result.sx).toBeCloseTo(result.sy, 2)
      expect(result.height).toBeGreaterThan(440)
    }
    await check()
    // With no manual zoom, the level height is fitted to the new scene. The
    // original first level is 160 pixels high and 1600 pixels wide; the map's
    // yellow camera frame makes the fitted zoom observable without internals.
    const cameraWidth = () => canvas.evaluate((element: HTMLCanvasElement) => {
      const pixels = element.getContext('2d')!.getImageData(608, element.height - 100, 320, 76).data
      let left = 320, right = -1
      for (let y = 0; y < 76; y++) for (let x = 0; x < 320; x++) {
        const i = (y * 320 + x) * 4
        if (pixels[i] === 255 && pixels[i + 1] === 255 && pixels[i + 2] === 0) {
          left = Math.min(left, x); right = Math.max(right, x)
        }
      }
      return right - left
    })
    const expectedWidth = async () => {
      const height = await canvas.evaluate((element: HTMLCanvasElement) => element.height)
      const scale = Math.max(.5, Math.min(7.5, (height - 120) / 160))
      return Math.min(320, 320 * 960 / (1600 * scale))
    }
    await expect.poll(async () => Math.abs(await cameraWidth() - await expectedWidth())).toBeLessThan(3)
    if (!expanded) {
      // Chromium's native fullscreen window cannot be resized by the test
      // runner; rotate between sessions. Expanded mode is resized in place.
      await pressGamePanel(canvas, testInfo.project.name !== 'desktop', 10, 'windows')
      const pause = page.getByRole('region', { name: 'Paused' })
      await expect(pause).toBeVisible()
      await pause.getByRole('button', { name: 'Exit fullscreen', exact: true }).click()
      await page.setViewportSize({ width: 768, height: 1200 })
      await pause.getByRole('button', { name: 'Fullscreen', exact: true }).click()
      await pause.getByRole('button', { name: 'Resume', exact: true }).click()
    } else await page.setViewportSize({ width: 768, height: 1200 })
    await check()
    await expect.poll(async () => Math.abs(await cameraWidth() - await expectedWidth())).toBeLessThan(3)
    await pressGamePanel(canvas, testInfo.project.name !== 'desktop', 10, 'windows')
    const pause = page.getByRole('region', { name: 'Paused' })
    await expect(pause).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeDisabled()
    await pause.getByRole('button', { name: 'Exit fullscreen', exact: true }).click()
    await expect(canvas).toHaveAttribute('height', '440')
  })
}
