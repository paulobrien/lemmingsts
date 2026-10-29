import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

declare global {
  interface Window {
    audioOutputDiagnostics: Array<{
      state: () => AudioContextState
      callbacks: number
      firstSignalAt: number | null
      lastSignalAt: number | null
      peak: number
    }>
  }
}

// Keep Chrome's user-gesture policy active while preserving the local browser override.
test.use({ launchOptions: {
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
  args: ['--autoplay-policy=user-gesture-required'],
} })

test('music continues to produce sound and gameplay effects produce samples', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires local, untracked original game files')
  test.setTimeout(45_000)
  await page.addInitScript(() => {
    window.audioOutputDiagnostics = []
    // Wrap the real processor callback and inspect its output in place. Unlike
    // an analyser attached to the graph, this adds no audio node or connection,
    // so it cannot accidentally keep a disconnected graph alive.
    const descriptor = Object.getOwnPropertyDescriptor(ScriptProcessorNode.prototype, 'onaudioprocess')!
    Object.defineProperty(ScriptProcessorNode.prototype, 'onaudioprocess', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(this: ScriptProcessorNode, callback: ((event: AudioProcessingEvent) => void) | null) {
        if (!callback) { descriptor.set!.call(this, callback); return }
        const diagnostic = { state: () => this.context.state, callbacks: 0, firstSignalAt: null as number | null, lastSignalAt: null as number | null, peak: 0 }
        window.audioOutputDiagnostics.push(diagnostic)
        descriptor.set!.call(this, (event: AudioProcessingEvent) => {
          callback.call(this, event)
          diagnostic.callbacks++
          let peak = 0
          for (let channel = 0; channel < event.outputBuffer.numberOfChannels; channel++) {
            for (const sample of event.outputBuffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample))
          }
          diagnostic.peak = Math.max(diagnostic.peak, peak)
          if (peak > 0.005) {
            const now = performance.now()
            diagnostic.firstSignalAt ??= now
            diagnostic.lastSignalAt = now
          }
        })
      },
    })
  })
  const directory = resolve('dos/lemmings')
  const files = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve(directory, name))
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Music off' }).click()

  // A context reporting 'running' or a single audible buffer is insufficient:
  // a zero-duration source can disconnect the processor almost immediately.
  await expect.poll(() => page.evaluate(() => window.audioOutputDiagnostics.some(d =>
    d.state() === 'running' && d.callbacks >= 10 && d.firstSignalAt !== null && d.lastSignalAt !== null &&
    d.lastSignalAt - d.firstSignalAt >= 3_000)), { timeout: 12_000, message: 'music should keep producing audible output for at least three seconds' }).toBe(true)
  await page.getByRole('button', { name: 'Music on' }).click()
  await page.evaluate(() => { window.audioOutputDiagnostics = [] })

  await page.getByRole('button', { name: 'Sound off' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect.poll(() => page.evaluate(() => window.audioOutputDiagnostics.some(d => d.peak > 0.005)),
    { timeout: 12_000, message: 'game effects should produce audible samples' }).toBe(true)
})
