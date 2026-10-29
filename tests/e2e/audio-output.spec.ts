import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

declare global {
  interface Window { audioOutputMeters: { meter: AnalyserNode; context: BaseAudioContext }[] }
}

// Do not let headless Chrome's permissive autoplay default hide a missing
// player gesture. Keep the optional local Chromium override used by CI/dev.
test.use({ launchOptions: {
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
  args: ['--autoplay-policy=user-gesture-required'],
} })

test('music and effects produce audio samples after a player gesture', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  test.setTimeout(45_000)
  // Insert analysers into the real Web Audio graph: keep the audio output and
  // synthesis intact while checking actual signal, not just context state.
  await page.addInitScript(() => {
    window.audioOutputMeters = []
    const connect = AudioNode.prototype.connect
    Object.defineProperty(AudioNode.prototype, 'connect', {
      configurable: true,
      writable: true,
      value: function (this: AudioNode, destination: AudioNode | AudioParam, ...args: number[]) {
        if (destination instanceof AudioDestinationNode) {
          const meter = this.context.createAnalyser()
          meter.fftSize = 2048
          window.audioOutputMeters.push({ meter, context: this.context })
          Reflect.apply(connect, this, [meter])
          return Reflect.apply(connect, this, [destination, ...args])
        }
        return Reflect.apply(connect, this, [destination, ...args])
      },
    })
  })
  const directory = resolve('dos/lemmings')
  const files = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve(directory, name))
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()

  // One AudioContext can be running yet produce only silence. Sample the
  // analyser repeatedly, since effects are short and do not start instantly.
  const peakWithin = (timeout: number) => page.evaluate(async timeout => {
    const deadline = performance.now() + timeout
    let peak = 0
    while (performance.now() < deadline) {
      for (const { meter, context } of window.audioOutputMeters) {
        if (context.state !== 'running') continue
        const samples = new Float32Array(meter.fftSize)
        meter.getFloatTimeDomainData(samples)
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
      }
      if (peak > 0.005) break
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    return peak
  }, timeout)

  await page.getByRole('button', { name: 'Music off' }).click()
  expect(await peakWithin(8_000), 'music output should not be silent').toBeGreaterThan(0.005)
  await page.getByRole('button', { name: 'Music on' }).click()
  await page.evaluate(() => { window.audioOutputMeters = [] })

  await page.getByRole('button', { name: 'Sound off' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  // The entrance and "Let's go" cues occur shortly after starting the level.
  expect(await peakWithin(12_000), 'game effects output should not be silent').toBeGreaterThan(0.005)
})
