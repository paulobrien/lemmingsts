import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('explains local setup and rejects an incomplete import', async ({ page }) => {
  const outgoingWrites: string[] = []
  page.on('request', request => {
    if (!['GET', 'HEAD'].includes(request.method())) outgoingWrites.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Let's get them home." })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add your game files' })).toBeEnabled()
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'main.dat', mimeType: 'application/octet-stream', buffer: Buffer.from('synthetic'),
  })
  await expect(page.getByRole('status')).toContainText('Missing files:')
  await expect(page.getByRole('button', { name: 'Add your game files' })).toBeVisible()
  expect(outgoingWrites).toEqual([])
})

test('imports the local DOS files, plays, and reloads offline', async ({ page, context }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  const directory = resolve('dos/lemmings')
  const files = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve(directory, name))

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Add your game files' })).toBeEnabled()
  await page.locator('input[type=file]').first().setInputFiles(files)
  await expect(page.getByRole('link', { name: 'Play Lemmings' })).toBeVisible()
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.getByRole('heading', { name: 'Just dig!' })).toBeVisible()
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Dig\b/ }).click()
  await expect(page.getByRole('button', { name: /^Dig\b/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zoom in' }).click()

  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Just dig!' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start level' })).toBeEnabled()
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Dig\b/ }).click()
  await expect(page.getByRole('button', { name: /^Dig\b/ })).toHaveAttribute('aria-pressed', 'true')
})
