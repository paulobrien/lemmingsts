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
    const pixels = element.getContext('2d')!.getImageData(656, 420, 82, 18).data
    return Array.from(pixels).join(',')
  })
  const initialOut = await outStatus()
  await expect.poll(outStatus, { timeout: 15000 }).not.toBe(initialOut)

  await pressGamePanel(canvas, testInfo.project.name !== 'desktop', 10, 'windows')
  const pause = page.getByRole('region', { name: 'Paused' })
  await expect(pause).toBeVisible()
  await pause.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  await pause.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.locator('.game-screen')).toHaveClass(/is-fullscreen/)
  await expect(canvas).toBeInViewport({ ratio: 1 })
  await expect.poll(ratio).toBeCloseTo(960 / 440, 2)
  await expect(canvas).toHaveAttribute('aria-describedby', /game-objective/)
})
