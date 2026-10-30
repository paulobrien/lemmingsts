import { expect, test } from '@playwright/test'

test('a fresh browser loads bundled Windows and refresh restores it after removal', async ({ page }) => {
  test.skip(process.env.RUN_BUNDLED_GAME_TESTS !== '1', 'Requires a locally built deployment with the owner’s game files')
  test.setTimeout(90_000)
  await page.goto('/')
  const mode = page.getByLabel('Game mode')
  await expect(mode).toHaveValue('windows', { timeout: 45_000 })
  await expect(mode.locator('option[value="windows"]')).not.toHaveAttribute('disabled', '')
  await expect(mode.locator('option[value="dos"]')).not.toHaveAttribute('disabled', '', { timeout: 45_000 })
  await page.getByRole('button', { name: 'Remove Windows files' }).click()
  await expect(page.getByText('Windows files removed from this browser.')).toBeVisible()
  await expect(mode.locator('option[value="windows"]')).toHaveAttribute('disabled', '')
  await page.reload()
  await expect(mode).toHaveValue('windows', { timeout: 45_000 })
  await expect(mode.locator('option[value="windows"]')).not.toHaveAttribute('disabled', '')
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.getByRole('button', { name: 'Start level' })).toBeEnabled()
})
