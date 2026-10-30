import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { pressGamePanel } from './fullscreen-helpers'

for (const edition of ['dos', 'windows'] as const) {
  test(`shows the ${edition.toUpperCase()} target on the panel in fullscreen`, async ({ page }, testInfo) => {
    test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || (edition === 'windows' && !process.env.LEMMINGS_WINDOWS_ISO),
      'Requires the corresponding local original game files')
    test.setTimeout(60_000)
    await page.goto('/')
    if (edition === 'windows') {
      await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
      await expect(page.getByLabel('Game mode')).toHaveValue('windows')
    } else {
      const files = (await readdir(resolve('dos/lemmings'))).filter(name => name.toLowerCase().endsWith('.dat'))
        .map(name => resolve('dos/lemmings', name))
      await page.locator('input[type=file]').first().setInputFiles(files)
      await expect(page.getByLabel('Game mode')).toHaveValue('dos')
    }
    await page.getByRole('link', { name: 'Play Lemmings' }).click()
    await page.getByRole('button', { name: 'Start level' }).click()
    if (edition === 'windows') await expect(page.locator('.game-screen')).toHaveClass(/native-windows-playing/)
    const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
    await expect(canvas).toHaveAttribute('aria-describedby', /game-objective/)
    const objective = page.locator('#game-objective')
    await expect(objective).toContainText('Save at least')
    await expect(objective).toContainText('Saved 0')
    const objectiveText = await objective.textContent()
    // The left side of the original status row was blank before the target
    // was added. Check for green glyph pixels in that area of the canvas.
    const targetPixels = () => canvas.evaluate((element: HTMLCanvasElement, offset: number) => {
      const { data } = element.getContext('2d')!.getImageData(offset, 380, 210, 32)
      const values: number[] = []
      for (let i = 0; i < data.length; i += 4) {
        const green = data[i + 1] > 100 && data[i + 1] > data[i] * 1.5 && data[i + 1] > data[i + 2] * 1.5
        values.push(green ? 1 : 0)
      }
      return values
    }, edition === 'windows' ? 32 : 0)
    await expect.poll(async () => (await targetPixels()).reduce((sum, value) => sum + value, 0)).toBeGreaterThan(50)
    const initial = await targetPixels()
    const enterFullscreen = async () => {
      if (edition === 'windows') {
        await pressGamePanel(canvas, testInfo.project.name !== 'desktop', 10, 'windows')
        await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
      }
      await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
      if (edition === 'windows') await page.getByRole('button', { name: 'Resume', exact: true }).click()
    }
    await enterFullscreen()
    await expect(page.locator('.game-screen')).toHaveClass(/is-fullscreen/)
    await expect(page.locator('.game-header')).toHaveAttribute('inert', '')
    await expect(objective).toHaveText(objectiveText!)
    await expect(objective).not.toHaveAttribute('aria-live', /.+/)
    await expect(canvas).toHaveAttribute('aria-describedby', /game-objective/)
    // Fullscreen changes the presentation, not the actual HUD pixels.
    expect(await targetPixels()).toEqual(initial)
    await expect(page.locator('.game-screen').locator('button:visible:not(.fullscreen-a11y-pause)')).toHaveCount(0)
    if (testInfo.project.name !== 'desktop') {
      const viewport = page.viewportSize()!
      // Chromium cannot resize an OS fullscreen window; rotate between fullscreen sessions.
      await page.evaluate(() => document.exitFullscreen())
      await expect(page.locator('.game-screen')).not.toHaveClass(/is-fullscreen/)
      await page.setViewportSize({ width: Math.max(viewport.width, viewport.height), height: Math.min(viewport.width, viewport.height) })
      await enterFullscreen()
      await expect(page.locator('.game-screen')).toHaveClass(/is-fullscreen/)
      expect(await targetPixels()).toEqual(initial)
      await expect(canvas).toHaveAttribute('aria-describedby', /game-objective/)
    }
  })
}
