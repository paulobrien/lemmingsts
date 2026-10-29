import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('switches and compares graphics locally without restarting play', async ({ page, context }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  const files = (await readdir(resolve('dos/lemmings')))
    .filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve('dos/lemmings', name))
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const dig = page.getByRole('button', { name: /^Dig\b/ })
  await expect(dig).toHaveAttribute('aria-pressed', 'true')
  await page.getByText('Display settings', { exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Original' })).toBeChecked()
  await expect(page.getByText(/rules and physics stay the same/i)).toBeVisible()
  await context.setOffline(true)
  await page.getByRole('radio', { name: 'Enhanced' }).check()
  await expect(page.getByRole('radio', { name: 'Enhanced' })).toBeChecked()
  await page.getByRole('button', { name: 'Compare styles' }).click()
  const comparison = page.getByRole('region', { name: 'Graphics comparison' })
  await expect(comparison.getByText('Both previews show the same moment and view.')).toBeVisible()
  const previews = comparison.locator('canvas')
  await expect(previews).toHaveCount(2)
  const first = await previews.nth(0).boundingBox()
  const second = await previews.nth(1).boundingBox()
  expect(first).not.toBeNull()
  expect(second!.x).toBeGreaterThan(first!.x)
  for (const canvas of await previews.all()) {
    expect(await canvas.evaluate((node: HTMLCanvasElement) => {
      const pixels = node.getContext('2d')!.getImageData(0, 0, node.width, node.height).data
      return pixels.some((value, index) => index % 4 !== 3 && value !== 0)
    })).toBe(true)
  }
  const changedPixels = await comparison.evaluate(element => {
    const [original, enhanced] = Array.from(element.querySelectorAll('canvas'))
    const a = original.getContext('2d')!.getImageData(0, 0, original.width, original.height).data
    const b = enhanced.getContext('2d')!.getImageData(0, 0, enhanced.width, enhanced.height).data
    let count = 0
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++
    return count
  })
  expect(changedPixels).toBeGreaterThan(0)
  await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
  await expect(dig).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Close comparison' }).click()
  await expect(comparison).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('lemmings.graphics.v1'))).toBe('enhanced')

  // A failed enhanced allocation should close the comparison and keep play usable.
  await page.getByRole('radio', { name: 'Original' }).check()
  await page.evaluate(() => {
    (window as unknown as { savedImageData: typeof ImageData }).savedImageData = window.ImageData
    window.ImageData = class { constructor() { throw new Error('Simulated allocation failure') } } as unknown as typeof ImageData
  })
  await page.getByRole('button', { name: 'Compare styles' }).click()
  await expect(page.getByText('Enhanced graphics are unavailable. Original graphics have been restored.')).toBeVisible()
  await expect(comparison).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'Original' })).toBeChecked()
  await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
  await expect(dig).toHaveAttribute('aria-pressed', 'true')
  await page.evaluate(() => { window.ImageData = (window as unknown as { savedImageData: typeof ImageData }).savedImageData })
})
