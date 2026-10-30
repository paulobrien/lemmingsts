import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('uses locally imported title art and removes it with the files', async ({ page, context }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  const requests: string[] = []
  page.on('request', request => requests.push(`${request.method()} ${request.url()}`))
  const files = (await readdir(resolve('dos/lemmings')))
    .filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve('dos/lemmings', name))

  await page.goto('/')
  await expect(page.locator('.fallback-landscape')).toBeVisible()
  await expect(page.locator('[data-home-logo]')).toBeHidden()
  await page.locator('input[type=file]').first().setInputFiles(files)
  const logo = page.locator('[data-home-logo]')
  await expect(logo).toBeVisible()
  await expect(page.locator('[data-home-background]')).toBeVisible()
  expect(await logo.evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    return Array.from(pixels).some((value, index) => index % 4 === 3 && value !== 0)
  })).toBe(true)
  expect(requests.some(request => /\.(?:dat|zip)(?:[?#]|$)/i.test(request))).toBe(false)
  expect(requests.every(request => request.startsWith('GET ') || request.startsWith('HEAD '))).toBe(true)

  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  await expect(logo).toBeVisible()
  await page.getByRole('button', { name: 'Remove DOS files' }).click()
  await expect(logo).toBeHidden()
  await expect(page.locator('.fallback-landscape')).toBeVisible()
  await expect.poll(() => logo.evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([0, 0])
})
