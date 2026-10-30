import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { build } from 'vite'

test('Windows minimap follows the live scene, camera and lemmings', async ({ page }) => {
  const built = await build({ configFile: false, logLevel: 'silent', build: {
    write: false, lib: { entry: resolve('src/game/view/stage.ts'), formats: ['es'] },
  } })
  const output = Array.isArray(built) ? built[0] : built
  if (!('output' in output)) throw new Error('Could not build stage fixture')
  const bundle = output.output.find(item => item.type === 'chunk')
  if (!bundle || bundle.type !== 'chunk') throw new Error('Could not bundle stage fixture')
  await page.route('**/__minimap_fixture.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle.code }))
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/__minimap_fixture.js'
    const { Stage } = await import(path)
    const canvas = document.createElement('canvas')
    canvas.width = 800; canvas.height = 480
    const stage = new Stage(canvas, 2)
    const scene = stage.getGameDisplay(); scene.initSize(1600, 160)
    const logical = new Uint8ClampedArray(1600 * 160 * 4)
    for (let i = 0; i < logical.length; i += 4) logical.set([255, 0, 0, 255], i)
    scene.setBackground(logical)
    const native = new Uint8ClampedArray(3200 * 320 * 4)
    for (let i = 0; i < native.length; i += 4) native.set([0, 0, 255, 255], i)
    scene.setNativeBackground(native, 3200, 320)
    const gui = stage.getGuiDisplay(); gui.initSize(320, 40)
    const panel = new Uint8ClampedArray(320 * 40 * 4)
    for (let i = 0; i < panel.length; i += 4) panel.set([128, 128, 128, 255], i)
    gui.setBackground(panel)
    const points = [{ x: 1200, y: 80 }]
    stage.setMinimapProvider(() => points)
    const pixel = (x: number, y: number) => Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data)
    stage.redraw(); stage.redraw()
    const first = [pixel(700, 435), pixel(700, 449), pixel(520, 426), pixel(780, 449)]
    // Browsers without the canvas filter still get a monochrome map.
    const context = canvas.getContext('2d')!
    Object.defineProperty(context, 'filter', { value: undefined, configurable: true })
    stage.redraw()
    const fallback = [pixel(700, 435), pixel(700, 449)]
    delete (context as unknown as { filter?: string }).filter
    // The native source represents terrain changing during play.
    native.fill(0)
    for (let i = 3; i < native.length; i += 4) native[i] = 255
    points[0].x = 600
    stage.redraw()
    const changed = [pixel(700, 435), pixel(700, 449), pixel(609, 449)]
    stage.panGameBy(800)
    const camera = stage.getStageImageAt(1, 1)!.viewPoint.x
    const panned = [pixel(640, 426), pixel(520, 426)]
    stage.zoomGame(1)
    const scale = stage.getStageImageAt(1, 1)!.viewPoint.scale
    const zoomed = pixel(640, 426)
    stage.setMinimapProvider(null)
    const removed = pixel(600, 440)
    stage.dispose()
    return { first, fallback, changed, camera, panned, scale, zoomed, removed }
  })
  const blueGrey = [18, 18, 18, 255], green = [0, 255, 0, 255]
  const yellow = [255, 255, 0, 255], black = [0, 0, 0, 255]
  const grey = [128, 128, 128, 255]
  expect(result.first).toEqual([blueGrey, green, yellow, black])
  expect(result.fallback[0][0]).toBe(result.fallback[0][1])
  expect(result.fallback[0][1]).toBe(result.fallback[0][2])
  expect(result.fallback[1]).toEqual(green)
  expect(result.changed).toEqual([black, black, green])
  expect(result.camera).toBe(800)
  expect(result.panned).toEqual([yellow, black])
  expect(result.scale).toBeGreaterThan(2)
  expect(result.zoomed).toEqual(yellow)
  expect(result.removed).toEqual(grey)
})
