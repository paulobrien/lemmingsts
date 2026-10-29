import { expect, test } from '@playwright/test'

test('recovers an unknown bookmarked URL to the level selection screen', async ({ page }) => {
  await page.goto('/old-bookmark/missing-level')
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: "Let's get them home." })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add your game files' })).toBeEnabled()
})
