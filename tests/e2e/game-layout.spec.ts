import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('keeps level details and sound controls readable on narrow screens', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  const files = (await readdir(resolve('dos/lemmings')))
    .filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve('dos/lemmings', name))
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.getByRole('heading', { name: 'Just dig!' })).toBeVisible()

  for (const width of [320, 360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    const dimensions = await page.locator('.level-heading').evaluate(element => ({
      width: element.clientWidth,
      contentWidth: element.scrollWidth,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(dimensions.contentWidth, `Level details should fit at ${width}px`).toBeLessThanOrEqual(dimensions.width + 1)
    expect(dimensions.pageWidth, `The game page should fit at ${width}px`).toBeLessThanOrEqual(dimensions.viewportWidth)
    await expect(page.getByRole('button', { name: 'Music off' })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Sound off' })).toBeInViewport()
  }

  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(page.getByRole('button', { name: 'Start level', exact: true })).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toBeInViewport({ ratio: 1 })
})
