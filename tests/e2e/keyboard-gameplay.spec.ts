import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('keyboard targeting assigns Dig to a real lemming', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  const files = (await readdir(resolve('dos/lemmings')))
    .filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve('dos/lemmings', name))

  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.locator('.objective')).toBeVisible()
  await expect(page.locator('.objective')).toContainText('Save at least 1 of 10 lemmings')
  await page.getByRole('button', { name: 'Start level' }).click()
  const dig = page.getByRole('button', { name: /^Dig\b/ })
  await expect(dig).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Speed').selectOption('4')
  const canvas = page.locator('canvas')
  await canvas.focus()
  const keyboardStatus = page.locator('p[role="status"][aria-live="polite"]').first()
  await expect.poll(async () => {
    await page.keyboard.press('Home')
    return keyboardStatus.textContent()
  }, { timeout: 7000 }).toContain(', walk,')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await canvas.focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')
  await expect(dig).toContainText('9')

  const cyanPixels = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data
    let count = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === 104 && pixels[i + 1] === 228 && pixels[i + 2] === 255) count++
    }
    return count
  })
  const before = await cyanPixels()
  await page.getByRole('button', { name: 'Show a hint' }).click()
  await page.getByRole('button', { name: 'Show example first move' }).click()
  await expect(page.getByText(/Tested example, not live advice: use Dig/)).toBeVisible()
  await expect.poll(cyanPixels).toBeGreaterThan(before)
  await expect(dig).toContainText('9')
  await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
  await page.getByRole('button', { name: 'Hide hints' }).click()
  await expect(page.getByText(/Tested example, not live advice/)).toBeHidden()
  await expect.poll(cyanPixels).toBe(before)
  await expect(dig).toContainText('9')
})
