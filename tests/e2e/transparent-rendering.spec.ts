import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { build } from 'vite'

// Exercise the real renderer on a real Canvas without using copyrighted game data.
test('moving sprites leave the background intact', async ({ page }) => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, lib: { entry: resolve('src/game/view/stage.ts'), formats: ['es'] } },
  })
  const output = Array.isArray(result) ? result[0] : result
  if (!('output' in output)) throw new Error('Unexpected renderer watch build')
  const bundle = output.output.find(item => item.type === 'chunk')
  if (!bundle || bundle.type !== 'chunk') throw new Error('Could not bundle the renderer')
  await page.route('**/__renderer_fixture.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle.code }))
  await page.goto('/')

  const pixels = await page.evaluate(async () => {
      const moduleUrl = '/__renderer_fixture.js'
      const { Stage } = await import(moduleUrl)
      const canvas = document.createElement('canvas')
      canvas.width = 32; canvas.height = 116
      const stage = new Stage(canvas, 1)
      const display = stage.getGameDisplay()
      display.initSize(32, 16)

      // Transparent empty scenery and an opaque terrain pixel, just as decoded levels contain.
      const ground = new Uint8ClampedArray(32 * 16 * 4)
      const terrain = (6 * 32 + 6) * 4
      ground.set([30, 120, 40, 255], terrain)
      display.setBackground(ground)
      display.setPixel(3, 3, 250, 50, 20)
      stage.redraw()
      display.setBackground(ground)
      display.setPixel(10, 3, 250, 50, 20)
      stage.redraw()
      const read = (target: HTMLCanvasElement, x: number, y: number) => Array.from(target.getContext('2d')!.getImageData(x, y, 1, 1).data)
      const values = [canvas].map(target => ({
        oldSprite: read(target, 3, 3), newSprite: read(target, 10, 3), terrain: read(target, 6, 6),
      }))
      stage.dispose()
      return values
  })
  for (const target of pixels) {
      expect(target.oldSprite, 'old position is clear').toEqual([0, 0, 0, 255])
      expect(target.newSprite, 'current sprite remains visible').toEqual([250, 50, 20, 255])
      expect(target.terrain, 'terrain remains intact').toEqual([30, 120, 40, 255])
  }
})
