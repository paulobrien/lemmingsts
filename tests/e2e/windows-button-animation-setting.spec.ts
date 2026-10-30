import { expect, test } from '@playwright/test'
import { pressGamePanel } from './fullscreen-helpers'

test('Windows button animation preference persists and controls the artwork', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO, 'Requires the local Windows ISO')
  await page.goto('/')
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  const start = page.getByRole('button', { name: 'Start level' })
  await start.click()
  await expect(page.locator('.game-screen')).toHaveClass(/native-windows-playing/)
  const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
  const touch = testInfo.project.name !== 'desktop'
  const icon = () => canvas.evaluate((element: HTMLCanvasElement) => {
    // The twelfth cell contains the original multi-frame fast-forward sprite.
    const pixels = element.getContext('2d')!.getImageData(492, 340, 44, 66).data
    return Array.from(pixels).join(',')
  })
  await pressGamePanel(canvas, touch, 10, 'windows')
  const pause = page.getByRole('region', { name: 'Paused' })
  await expect(pause.getByRole('button', { name: 'Button animations on' })).toHaveAttribute('aria-pressed', 'true')
  await pause.getByRole('button', { name: 'Button animations on' }).click()
  await expect(pause.getByRole('button', { name: 'Button animations off' })).toHaveAttribute('aria-pressed', 'false')
  await pause.getByRole('button', { name: 'Resume', exact: true }).click()
  const staticFrame = await icon()
  await page.waitForTimeout(500)
  expect(await icon()).toBe(staticFrame)

  // A static preference survives reload and remains accessible from the pause menu.
  await page.reload()
  await start.click()
  await expect(page.locator('.game-screen')).toHaveClass(/native-windows-playing/)
  await pressGamePanel(canvas, touch, 10, 'windows')
  await expect(pause.getByRole('button', { name: 'Button animations off' })).toHaveAttribute('aria-pressed', 'false')
  await pause.getByRole('button', { name: 'Button animations off' }).click()
  await expect(pause.getByRole('button', { name: 'Button animations on' })).toHaveAttribute('aria-pressed', 'true')
  await pause.getByRole('button', { name: 'Resume', exact: true }).click()
  const firstFrame = await icon()
  await expect.poll(icon).not.toBe(firstFrame)
})
