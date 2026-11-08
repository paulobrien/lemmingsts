import { expect, test } from '@playwright/test'

test('shows the player-owned Windows objects and status before starting', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO,
    'Requires the player-owned Windows ISO')
  await page.goto('/')
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  const start = page.getByRole('button', { name: 'Start level' })
  await expect(start).toBeEnabled()
  const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
  await expect(canvas).toHaveAttribute('width', '960')
  await expect(canvas).toHaveAttribute('height', '440')
  const preview = await canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data
    let portalBlue = 0
    for (let y = 0; y < 320; y++) for (let x = 0; x < element.width; x++) {
      const i = (y * element.width + x) * 4
      if (pixels[i] === 64 && pixels[i + 1] === 64 && pixels[i + 2] === 224) portalBlue++
    }
    const status = (430 * element.width + 400) * 4
    return { portalBlue, status: Array.from(pixels.slice(status, status + 4)) }
  })
  // Entrance and exit artwork is supplied by the player's ISO. The Windows
  // panel/status strip is grey, not the DOS green-on-black status area.
  expect(preview.portalBlue).toBeGreaterThan(10)
  expect(preview.status).toEqual([192, 192, 192, 255])
  await start.click()
  await expect(page.locator('.game-screen')).toHaveClass(/native-windows-playing/)
})
