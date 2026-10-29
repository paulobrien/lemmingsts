import { expect, test } from '@playwright/test'

test('uses the Lemmings TS name in the app and install manifest', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Lemmings TS')
  await expect(page.locator('.brand')).toHaveText('LEMMINGS TS')
  await expect(page.locator('.art-topline')).toContainText('LEMMINGS TS')
  const manifest = await page.evaluate(async () => {
    const url = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href
    return (await fetch(url)).json()
  })
  expect(manifest.name).toBe('Lemmings TS')
  expect(manifest.short_name).toBe('Lemmings TS')
  await page.getByRole('link', { name: 'Source and licences' }).click()
  await expect(page).toHaveTitle('Source and licences · Lemmings TS')
  await expect(page.getByRole('link', { name: 'Back to Lemmings TS' })).toBeVisible()
})
