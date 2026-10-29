import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

declare global {
  interface Window { testSpeakerContexts: AudioContext[] }
}

test('digger speaker audio starts and is closed by pause and mute', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  test.setTimeout(60_000)
  // Keep the browser's actual AudioContext and oscillator, while observing
  // which context created an oscillator rather than an AdLib processor.
  await page.addInitScript(() => {
    const OriginalAudioContext = window.AudioContext
    window.testSpeakerContexts = []
    window.AudioContext = class extends OriginalAudioContext {
      createOscillator() {
        window.testSpeakerContexts.push(this)
        return super.createOscillator()
      }
    }
  })
  const directory = resolve('dos/lemmings')
  const files = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve(directory, name))
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Sound off' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  await page.getByRole('button', { name: /^Dig\b/ }).click()
  await expect(page.locator('.time')).toHaveText('4-54', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()

  const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
  const target = await canvas.evaluate(element => {
    const canvas = element as HTMLCanvasElement
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    let rightmost: { x: number; y: number } | null = null
    for (let y = 105; y < 180; y++) {
      for (let x = 150; x < 500; x++) {
        const offset = 4 * (y * canvas.width + x)
        if (pixels[offset] === 64 && pixels[offset + 1] === 64 && pixels[offset + 2] === 224 &&
            (!rightmost || x > rightmost.x)) rightmost = { x, y }
      }
    }
    return rightmost && { x: rightmost.x - 2, y: rightmost.y - 3 }
  })
  expect(target, 'a visible lemming should be on the upper platform').not.toBeNull()
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const position = { x: target!.x * box!.width / 800, y: target!.y * box!.height / 480 }
  if (testInfo.project.name.startsWith('android-')) await canvas.tap({ position })
  else await canvas.click({ position })
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Dig\b/ })).toContainText('9')
  await expect.poll(() => page.evaluate(() => window.testSpeakerContexts.at(-1)?.state)).toBe('running')

  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.testSpeakerContexts.at(-1)?.state)).toBe('closed')
  const count = await page.evaluate(() => window.testSpeakerContexts.length)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.testSpeakerContexts.length)).toBeGreaterThan(count)
  await expect.poll(() => page.evaluate(() => window.testSpeakerContexts.at(-1)?.state)).toBe('running')
  await page.getByRole('button', { name: 'Sound on' }).click()
  await expect.poll(() => page.evaluate(() => window.testSpeakerContexts.at(-1)?.state)).toBe('closed')
})
