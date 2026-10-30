import { expect, test } from '@playwright/test'
import { pressGamePanel } from './fullscreen-helpers'

test('the original Windows fast-forward panel controls speed, including fullscreen', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO, 'Requires LEMMINGS_WINDOWS_ISO')
  if (testInfo.project.name === 'android-tablet') await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await expect(page.getByLabel('Game mode')).toHaveValue('windows')
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
  const touch = testInfo.project.name.startsWith('android-')
  await expect(page.locator('.game-toolbar')).toHaveClass(/windows-hidden-controls/)
  await expect(page.locator('.game-screen')).toHaveClass(/native-windows-playing/)
  const hints = page.locator('.hints')
  await expect(hints).toHaveClass(/windows-hidden-controls/)
  await expect(hints).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)')
  await page.getByRole('button', { name: 'Show a hint' }).focus()
  await expect(hints).toHaveCSS('clip', 'auto')
  await canvas.focus()
  await expect(hints).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)')
  if (testInfo.project.name === 'android-tablet') {
    const levelBox = await canvas.boundingBox()
    const screenBox = await page.locator('.game-screen').boundingBox()
    expect(levelBox!.width).toBeGreaterThan(screenBox!.width * 0.98)
  }
  await pressGamePanel(canvas, touch, 11)
  await pressGamePanel(canvas, touch, 10)
  await expect(page.getByLabel('Speed')).toHaveValue('4')
  await page.getByLabel('Speed').selectOption('2')
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await pressGamePanel(canvas, touch, 11)
  await pressGamePanel(canvas, touch, 10)
  await expect(page.getByLabel('Speed')).toHaveValue('1')
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click()
})

test('plays a complete level using Windows artwork from an ISO', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO,
    'Requires LEMMINGS_WINDOWS_ISO')
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await expect(page.getByText('Windows audio, graphics and level data added to this device.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('Game mode')).toHaveValue('windows')
  await expect(page.getByRole('link', { name: 'Play Lemmings' })).toBeVisible()
  await expect(page.getByLabel('Difficulty').locator('option')).toHaveCount(4)
  await expect(page.getByLabel('Level').locator('option')).toHaveCount(28)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.getByRole('button', { name: 'Start level' })).toBeEnabled()

  const canvas = page.locator('canvas[aria-label^="Lemmings level"]')
  const terrainHash = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const data = element.getContext('2d')!.getImageData(0, 0, element.width, element.height - 100).data
    let value = 0
    for (let i = 0; i < data.length; i += 16) value = (Math.imul(value, 31) + data[i] + data[i + 1] * 3 + data[i + 2] * 7) >>> 0
    return value
  })
  expect(await terrainHash()).not.toEqual(0)
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect(page.locator('.time')).toHaveText('4-54', { timeout: 15_000 })
  await pressGamePanel(canvas, testInfo.project.name.startsWith('android-'), 10)
  await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()

  // Find the leading lemming by the Windows palette's blue clothing.
  const target = await canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data
    let rightmost: { x: number; y: number } | null = null
    for (let y = 105; y < 180; y++) for (let x = 150; x < 500; x++) {
      const offset = (y * element.width + x) * 4
      if (pixels[offset] === 95 && pixels[offset + 1] === 96 && pixels[offset + 2] === 255 &&
          (!rightmost || x > rightmost.x)) rightmost = { x, y }
    }
    return rightmost && { x: rightmost.x - 2, y: rightmost.y - 3 }
  })
  expect(target, 'a Windows lemming should be visible on the upper platform').not.toBeNull()
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const position = { x: target!.x * box!.width / 800, y: target!.y * box!.height / 480 }
  if (testInfo.project.name.startsWith('android-')) await canvas.tap({ position })
  else await canvas.click({ position })
  await page.getByLabel('Speed').selectOption('4')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Dig\b/ })).toContainText('9')
  await expect(page.getByRole('status').filter({ hasText: 'Level complete!' })).toBeVisible({ timeout: 30_000 })
  expect(errors).toEqual([])
})

test('reopens and starts the Windows game offline after importing only the ISO', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop' || process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO,
    'Requires desktop, local Windows ISO and private game tests')
  await page.goto('/')
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await expect(page.getByText('Windows audio, graphics and level data added to this device.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/The app shell is ready offline/)).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.context().setOffline(true)
  await page.reload()
  await expect(page.getByLabel('Game mode')).toHaveValue('windows')
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.getByRole('button', { name: 'Start level' })).toBeEnabled()
  await page.getByRole('button', { name: 'Start level' }).click()
  await pressGamePanel(page.getByLabel('Lemmings level. Drag to move the view.'), false, 10)
  await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
})
