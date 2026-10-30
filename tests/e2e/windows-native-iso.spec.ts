import { expect, test } from '@playwright/test'

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
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
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
