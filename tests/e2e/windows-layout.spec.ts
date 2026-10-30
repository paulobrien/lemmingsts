import { expect, test } from '@playwright/test'
import { pressGamePanel } from './fullscreen-helpers'

test('keeps the Windows playfield and bottom status visible in fullscreen', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO, 'Requires the local Windows ISO')
  await page.goto('/')
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect(page.locator('.game-screen')).toHaveClass(/native-windows-playing/)
  const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
  await expect(canvas).toHaveAttribute('width', '960')
  await expect(canvas).toHaveAttribute('height', '440')
  const ratio = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const bounds = element.getBoundingClientRect()
    return bounds.width / bounds.height
  })
  await expect.poll(ratio).toBeCloseTo(960 / 440, 2)

  // The original-style status strip is beneath the toolbar and reports OUT
  // as lemmings emerge, instead of freezing or being covered by the panel.
  const outStatus = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext('2d')!.getImageData(656, element.height - 20, 82, 18).data
    return Array.from(pixels).join(',')
  })
  const initialOut = await outStatus()
  await expect.poll(outStatus, { timeout: 15000 }).not.toBe(initialOut)

  await pressGamePanel(canvas, testInfo.project.name !== 'desktop', 10, 'windows')
  const pause = page.getByRole('region', { name: 'Paused' })
  await expect(pause).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeDisabled()
  await pause.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  await pause.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.locator('.game-screen')).toHaveClass(/is-fullscreen/)
  await expect(canvas).toBeInViewport({ ratio: 1 })
  // In fullscreen the canvas fills the available window, with the toolbar at
  // the bottom and the playfield consuming all remaining vertical space.
  const geometry = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const bounds = element.getBoundingClientRect()
    const screen = element.closest('.game-screen')!.getBoundingClientRect()
    return { top: bounds.top - screen.top, bottom: screen.bottom - bounds.bottom,
      width: bounds.width, screenWidth: screen.width,
      scaleX: bounds.width / element.width, scaleY: bounds.height / element.height,
      sceneHeight: element.height - 120 }
  })
  await expect.poll(async () => Math.abs((await geometry()).bottom)).toBeLessThan(1.5)
  const fullscreen = await geometry()
  expect(Math.abs(fullscreen.top)).toBeLessThan(1.5)
  expect(fullscreen.width).toBeCloseTo(fullscreen.screenWidth, 0)
  expect(fullscreen.scaleX).toBeCloseTo(fullscreen.scaleY, 2)
  expect(fullscreen.sceneHeight).toBeGreaterThan(0)
  await expect(canvas).toHaveAttribute('aria-describedby', /game-objective/)
  await pressGamePanel(canvas, testInfo.project.name !== 'desktop', 10, 'windows')
  await expect(pause).toBeVisible()
  // Automatic fitting is the fullscreen default, not a user zoom; it must
  // not spuriously enable Reset after entering fullscreen or rotating.
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeDisabled()
  await pause.getByRole('button', { name: 'Exit fullscreen', exact: true }).click()
  await expect(canvas).toHaveAttribute('width', '960')
  await expect(canvas).toHaveAttribute('height', '440')
  await expect.poll(ratio).toBeCloseTo(960 / 440, 2)
})

test('preserves a chosen zoom and camera through fullscreen rotation and exit', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'Exercises a resizable touchscreen display')
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO, 'Requires the local Windows ISO')
  // A native Chromium fullscreen window cannot be resized by Playwright;
  // the browser's expanded fallback can be rotated in place.
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
  })
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.goto('/')
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await page.getByRole('link', { name: 'Play Lemmings' }).tap()
  await page.getByRole('button', { name: 'Start level' }).tap()
  await expect(page.locator('.game-screen')).toHaveClass(/native-windows-playing/)
  const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
  const pause = page.getByRole('region', { name: 'Paused' })
  const reset = page.getByRole('button', { name: 'Reset zoom' })
  const camera = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext('2d')!.getImageData(608, element.height - 100, 320, 76).data
    let left = 320, right = -1
    for (let y = 0; y < 76; y++) for (let x = 0; x < 320; x++) {
      const i = (y * 320 + x) * 4
      if (pixels[i] === 255 && pixels[i + 1] === 255 && pixels[i + 2] === 0) {
        left = Math.min(left, x); right = Math.max(right, x)
      }
    }
    return { left, width: right - left }
  })
  await pressGamePanel(canvas, true, 10, 'windows')
  await expect(pause).toBeVisible()
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in' }).tap()
  await pause.getByRole('button', { name: 'Move view right' }).tap()
  await expect(reset).toBeEnabled()
  const before = await camera()
  expect(before.left).toBeGreaterThan(0)
  expect(before.width).toBeGreaterThan(0)
  await pause.getByRole('button', { name: 'Fullscreen', exact: true }).tap()
  await expect(page.locator('.game-screen')).toHaveClass(/is-fullscreen/)
  await expect.poll(camera).toEqual(before)
  await page.setViewportSize({ width: 800, height: 1200 })
  await expect.poll(async () => canvas.evaluate((element: HTMLCanvasElement) => element.height)).toBeGreaterThan(440)
  await expect.poll(camera).toEqual(before)
  await expect(reset).toBeEnabled()
  await reset.tap()
  await expect(reset).toBeDisabled()
  const fitted = await camera()
  expect(fitted.width).toBeLessThan(before.width)
  await page.getByRole('button', { name: 'Zoom out' }).tap()
  await expect(reset).toBeEnabled()
  const selected = await camera()
  await pause.getByRole('button', { name: 'Exit fullscreen', exact: true }).tap()
  await expect(canvas).toHaveAttribute('height', '440')
  await expect.poll(camera).toEqual(selected)
  await expect(reset).toBeEnabled()
})
