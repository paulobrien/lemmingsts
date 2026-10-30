import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('Windows audio plays imported voice samples during a level', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO, 'Requires untracked DOS files and LEMMINGS_WINDOWS_ISO')
  await page.addInitScript(() => {
    const original = AudioBufferSourceNode.prototype.start
    ;(window as unknown as { sampledSoundStarts: number }).sampledSoundStarts = 0
    ;(window as unknown as { midiOscillators: number }).midiOscillators = 0
    const createOscillator = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () {
      (window as unknown as { midiOscillators: number }).midiOscillators++
      return createOscillator.call(this)
    }
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer) (window as unknown as { sampledSoundStarts: number }).sampledSoundStarts++
      return original.apply(this, args)
    }
  })
  const files = (await readdir(resolve('dos/lemmings'))).filter(name => name.toLowerCase().endsWith('.dat')).map(name => resolve('dos/lemmings', name))
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await expect(page.getByText('Windows audio, graphics and level data added to this device.')).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Game mode').selectOption('windows')
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Music off' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { midiOscillators: number }).midiOscillators), { timeout: 10000 }).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Sound off' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { sampledSoundStarts: number }).sampledSoundStarts), { timeout: 10000 }).toBeGreaterThan(0)
})
