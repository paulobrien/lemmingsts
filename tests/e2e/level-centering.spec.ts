import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { build } from 'vite'

test('centres small DOS and Windows levels without moving the panel', async ({ page }) => {
  const built = await build({ configFile: false, logLevel: 'silent', build: {
    write: false, lib: { entry: resolve('src/game/view/stage.ts'), formats: ['es'] },
  } })
  const output = Array.isArray(built) ? built[0] : built
  if (!('output' in output)) throw new Error('Could not build stage fixture')
  const bundle = output.output.find(item => item.type === 'chunk')
  if (!bundle || bundle.type !== 'chunk') throw new Error('Could not bundle stage fixture')
  await page.route('**/__center_fixture.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle.code }))
  await page.goto('/')
  const actual = await page.evaluate(async () => {
    const path = '/__center_fixture.js'
    const { Stage } = await import(path)
    const canvas = document.createElement('canvas')
    canvas.width = 20; canvas.height = 112
    const stage = new Stage(canvas, 2)
    const game = stage.getGameDisplay(); game.initSize(4, 2)
    const scene = new Uint8ClampedArray(4 * 2 * 4)
    for (let i = 0; i < scene.length; i += 4) scene.set([255, 0, 0, 255], i)
    game.setBackground(scene)
    const panel = stage.getGuiDisplay(); panel.initSize(10, 1)
    const white = new Uint8ClampedArray(10 * 4); white.fill(255); panel.setBackground(white)
    stage.setGameViewPointPosition(3, 2)
    stage.redraw()
    const pixel = (x: number, y: number) => Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data)
    const dos = [pixel(0, 0), pixel(5, 4), pixel(6, 4), pixel(13, 7), pixel(14, 7), pixel(0, 12)]
    const native = new Uint8ClampedArray(8 * 4 * 4)
    for (let i = 0; i < native.length; i += 4) native.set([0, 255, 0, 255], i)
    game.setNativeBackground(native, 8, 4)
    stage.redraw()
    const windows = [pixel(5, 4), pixel(6, 4), pixel(13, 7), pixel(14, 7), pixel(0, 12)]
    stage.zoomGame(-1)
    const zoomed = [pixel(6, 4), pixel(7, 4), pixel(12, 6), pixel(13, 6), pixel(0, 12)]
    stage.resetZoom()
    const reset = [pixel(5, 4), pixel(6, 4), pixel(13, 7), pixel(14, 7)]
    stage.dispose()
    return { dos, windows, zoomed, reset }
  })
  const black = [0, 0, 0, 255], white = [255, 255, 255, 255]
  const red = [255, 0, 0, 255], green = [0, 255, 0, 255]
  expect(actual.dos).toEqual([black, black, red, red, black, white])
  expect(actual.windows).toEqual([black, green, green, black, white])
  expect(actual.zoomed).toEqual([black, green, green, black, white])
  expect(actual.reset).toEqual([black, green, green, black])
})
