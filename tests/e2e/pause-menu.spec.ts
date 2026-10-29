import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('pause menu resumes, restarts and returns to level selection', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  const files = (await readdir(resolve('dos/lemmings')))
    .filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve('dos/lemmings', name))

  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  const pause = page.getByRole('button', { name: 'Pause', exact: true })
  await expect(pause).toBeVisible()
  await pause.click()

  const menu = page.getByRole('region', { name: 'Paused' })
  await expect(menu.getByRole('heading', { name: 'Paused' })).toBeFocused()
  await page.getByRole('button', { name: /^Dig\b/ }).click()
  await expect(page.getByRole('button', { name: /^Dig\b/ })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(pause).toBeFocused()

  await pause.click()
  await menu.getByRole('button', { name: 'Restart level' }).click()
  await expect(menu).toBeHidden()
  await expect(pause).toBeVisible()
  await expect(page.getByRole('button', { name: /^Dig\b/ })).toContainText('10')

  await pause.click()
  await menu.getByRole('link', { name: 'Level selection' }).click()
  await expect(page.getByRole('heading', { name: "Let's get them home." })).toBeVisible()
})
