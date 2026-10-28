import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

declare global {
  interface Window { testAudioContexts: AudioContext[] }
}

test('music follows the player controls', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  // Observe real browser AudioContexts; this does not replace audio playback.
  await page.addInitScript(() => {
    const OriginalAudioContext = window.AudioContext
    window.testAudioContexts = []
    window.AudioContext = class extends OriginalAudioContext {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args)
        window.testAudioContexts.push(this)
      }
    }
  })
  const directory = resolve('dos/lemmings')
  const files = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.dat')).map(name => resolve(directory, name))
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Music off' }).click()
  await expect.poll(() => page.evaluate(() => window.testAudioContexts.map((a: AudioContext) => a.state))).toContain('running')
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.testAudioContexts.at(-1)?.state)).toBe('running')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.testAudioContexts.at(-1)?.state)).toBe('suspended')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.testAudioContexts.at(-1)?.state)).toBe('running')
  await page.getByRole('button', { name: 'Music on' }).click()
  await expect.poll(() => page.evaluate(() => window.testAudioContexts.at(-1)?.state)).toBe('closed')
})
