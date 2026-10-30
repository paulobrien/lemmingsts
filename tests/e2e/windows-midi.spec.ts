import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { build } from 'vite'

test.use({ serviceWorkers: 'block' })

test('plays and pauses local MIDI without network instruments', async ({ page }) => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, lib: { entry: resolve('src/game/resources/sound/windows-midi-player.ts'), formats: ['es'] } },
  })
  const output = Array.isArray(result) ? result[0] : result
  if (!('output' in output)) throw new Error('Could not bundle the MIDI player')
  const bundle = output.output.find(item => item.type === 'chunk')
  if (!bundle || bundle.type !== 'chunk') throw new Error('Could not bundle the MIDI player')
  await page.route('**/__midi_fixture.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle.code }))
  await page.goto('/')
  await page.evaluate(() => {
    const NativeContext = window.AudioContext
    class CapturedContext extends NativeContext {
      constructor() {
        super()
        const destination = this.destination
        const analyser = this.createAnalyser()
        analyser.connect(destination)
        Object.defineProperty(this, 'destination', { value: analyser })
        ;(window as unknown as { midiAnalyser: AnalyserNode }).midiAnalyser = analyser
      }
    }
    window.AudioContext = CapturedContext as typeof AudioContext
    const button = document.createElement('button')
    button.id = 'test-midi-play'
    button.textContent = 'Play test MIDI'
    document.body.append(button)
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
      0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 12,
      0, 0x90, 60, 100, 96, 0x80, 60, 0, 0, 0xff, 0x2f, 0,
    ])
    button.onclick = async () => {
      const moduleUrl = '/__midi_fixture.js'
      const { WindowsMidiPlayer } = await import(moduleUrl)
      const player = new WindowsMidiPlayer(async () => bytes.buffer)
      ;(window as unknown as { midiTestPlayer: typeof player }).midiTestPlayer = player
      ;(window as unknown as { midiPlayed: boolean }).midiPlayed = await player.play()
    }
  })
  await page.locator('#test-midi-play').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { midiPlayed?: boolean }).midiPlayed)).toBe(true)
  await expect.poll(() => page.evaluate(() => {
    const analyser = (window as unknown as { midiAnalyser: AnalyserNode }).midiAnalyser
    const values = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteTimeDomainData(values)
    return values.some(value => Math.abs(value - 128) > 1)
  }), { timeout: 5000 }).toBe(true)
  await page.evaluate(() => (window as unknown as { midiTestPlayer: { stop(): void } }).midiTestPlayer.stop())
})
