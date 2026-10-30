import { expect, test } from '@playwright/test'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

test('exports and restores only progress and settings', async ({ page }) => {
  const initial = {
    format: 'lemmings-progress', version: 1,
    progress: [{ gameType: 1, groupIndex: 0, levelIndex: 0, bestSavedPercent: 75 }],
    settings: { speed: 2, musicEnabled: true, soundEnabled: false },
    lastLevel: { gameType: 1, groupIndex: 0, levelIndex: 1 },
  }
  await page.addInitScript(state => {
    localStorage.setItem('lemmings.progress.v1', JSON.stringify(state.progress))
    localStorage.setItem('lemmings.settings.v1', JSON.stringify(state.settings))
    localStorage.setItem('lemmings.last-level.v1', JSON.stringify(state.lastLevel))
  }, initial)
  await page.goto('/')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('lemmings-progress.json')
  const stream = await download.createReadStream()
  const pieces: Buffer[] = []
  for await (const chunk of stream) pieces.push(Buffer.from(chunk))
  expect(JSON.parse(Buffer.concat(pieces).toString('utf8'))).toEqual(initial)

  const input = page.locator('input[accept=".json,application/json"]')
  await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') })
  await expect(page.getByText('This is not a valid progress backup.')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('lemmings.restored-state.v1'))).toBeNull()

  const replacement = { ...initial, progress: [{ gameType: 1, groupIndex: 1, levelIndex: 3, bestSavedPercent: 95 }], lastLevel: { gameType: 1, groupIndex: 1, levelIndex: 3 } }
  await input.setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) })
  await expect(page.getByText('Progress and settings restored. Your game files were not changed.')).toBeVisible()
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('lemmings.restored-state.v1'))) || '')).toEqual(replacement)
  await expect(page.getByRole('button', { name: 'Add DOS files' })).toBeVisible()
})

test('suggests the next level after a completed remembered level, including after backup restore', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  const files = (await readdir(resolve('dos/lemmings')))
    .filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve('dos/lemmings', name))
  await page.addInitScript(() => {
    localStorage.setItem('lemmings.progress.v1', JSON.stringify([{ gameType: 1, groupIndex: 1, levelIndex: 3, bestSavedPercent: 95 }]))
    localStorage.setItem('lemmings.last-level.v1', JSON.stringify({ gameType: 1, groupIndex: 1, levelIndex: 3 }))
  })
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await expect(page.getByLabel('Difficulty')).toHaveValue('1')
  await expect(page.getByLabel('Level')).toHaveValue('4')
  await expect(page.getByRole('link', { name: 'Play Lemmings' })).toHaveAttribute('href', /group=1&level=4/)
  await page.getByLabel('Level').selectOption({ value: '3' })
  await expect(page.getByText('Best saved: 95%')).toBeVisible()
  const replacement = {
    format: 'lemmings-progress', version: 1,
    progress: [{ gameType: 1, groupIndex: 0, levelIndex: 2, bestSavedPercent: 88 }],
    settings: { speed: 2, musicEnabled: false, soundEnabled: true },
    lastLevel: { gameType: 1, groupIndex: 0, levelIndex: 2 },
  }
  await page.locator('input[accept=".json,application/json"]').setInputFiles({
    name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)),
  })
  await expect(page.getByText('Progress and settings restored. Your game files were not changed.')).toBeVisible()
  await expect(page.getByLabel('Difficulty')).toHaveValue('0')
  await expect(page.getByLabel('Level')).toHaveValue('3')
  await page.getByLabel('Level').selectOption({ value: '2' })
  await expect(page.getByText('Best saved: 88%')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Play Lemmings' })).toBeVisible()
  await expect(page.getByLabel('Level')).toHaveValue('3')
})
