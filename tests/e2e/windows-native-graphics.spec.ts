import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { build } from 'vite'

test('composites native terrain and sprites without affecting the panel', async ({ page }) => {
  const result = await build({ configFile: false, logLevel: 'silent',
    build: { write: false, lib: { entry: resolve('tests/e2e/fixtures/windows-native-graphics.ts'), formats: ['es'] } } })
  const output = Array.isArray(result) ? result[0] : result
  if (!('output' in output)) throw new Error('Could not bundle the graphics fixture')
  const bundle = output.output.find(item => item.type === 'chunk')
  if (!bundle || bundle.type !== 'chunk') throw new Error('Could not bundle the graphics fixture')
  await page.route('**/__windows_graphics_fixture.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle.code }))
  await page.goto('/')
  const resultPixels = await page.evaluate(async () => {
    const path = '/__windows_graphics_fixture.js'
    const { Stage, Frame, DrawProperties, SolidLayer } = await import(path)
    const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 108
    const stage = new Stage(canvas, 2)
    const game = stage.getGameDisplay(); game.initSize(4, 4)
    const native = new Uint8ClampedArray(8 * 8 * 4)
    for (let i = 0; i < native.length; i += 4) native.set([0, 0, 80, 255], i)
    game.setNativeBackground(native, 8, 8)
    const dos = new Uint8ClampedArray(4 * 4 * 4)
    for (let i = 3; i < dos.length; i += 4) dos[i] = 255
    game.setBackground(dos)
    const sprite = new Frame(1, 1); sprite.setPixel(0, 0, 0xff0000ff)
    game.setNativeSprites(new Map([[sprite, { width: 2, height: 2, offsetX: 0, offsetY: 0,
      pixels: new Uint32Array([0xff00ff00, 0xff0000ff, 0xff0000ff, 0xff0000ff]) }]]))
    game.drawFrame(sprite, 1, 1)
    const gui = stage.getGuiDisplay(); gui.initSize(4, 1)
    const panel = new Uint8ClampedArray(4 * 4); panel.fill(255); gui.setBackground(panel)
    stage.redraw()
    const pixel = (c: HTMLCanvasElement, x: number, y: number) => Array.from(c.getContext('2d')!.getImageData(x, y, 1, 1).data)
    const values = { nativeTerrain: pixel(canvas, 0, 0), nativeSprite: pixel(canvas, 2, 2),
      panel: pixel(canvas, 0, 8) }
    game.setBackground(dos)
    game.drawFrame(sprite, 2, 2)
    stage.redraw()
    const moved = { oldNative: pixel(canvas, 2, 2), newNative: pixel(canvas, 4, 4) }
    game.setBackground(dos)
    game.drawFrame(sprite, 1, 1)
    // Later low-resolution particles must remain above the native sprite.
    game.setPixel(1, 1, 7, 8, 9)
    stage.redraw()
    const ordered = pixel(canvas, 2, 2)
    let errors = 0
    stage.onGraphicsError.on(() => { errors++ })
    const originalImageData = window.ImageData
    window.ImageData = class { constructor() { throw new Error('Out of memory') } } as unknown as typeof ImageData
    const failedBackground = native.slice()
    game.setNativeBackground(failedBackground, 8, 8)
    game.setNativeBackground(failedBackground, 8, 8)
    window.ImageData = originalImageData
    stage.redraw()
    const fallback = { errors, noNative: game.getNativeLayers() === undefined, terrain: pixel(canvas, 0, 0) }
    game.setNativeBackground(null)
    game.setNativeBackground(native, 8, 8)
    const mask = new SolidLayer(4, 4, new Int8Array(16)); mask.setGroundAt(0, 0)
    const object = new Frame(2, 1); object.setPixel(0, 0, 0xff0000ff); object.setPixel(1, 0, 0xff0000ff)
    game.setNativeSprites(new Map([[object, { width: 4, height: 2, offsetX: 0, offsetY: 0,
      pixels: new Uint32Array([0xff0000ff, 0xff0000ff, 0xff00ff00, 0xff00ff00,
        0xffff0000, 0xffff0000, 0xff00ffff, 0xff00ffff]) }]]))
    game.setBackground(dos, mask)
    game.drawFrameFlags(object, 0, 0, new DrawProperties(true, true, false, false))
    stage.redraw()
    const noOverwrite = { solid: pixel(canvas, 0, 0), empty: pixel(canvas, 2, 0) }
    game.setBackground(dos, mask)
    game.drawFrameFlags(object, 0, 0, new DrawProperties(true, false, true, false))
    stage.redraw()
    const onlyOverwrite = { solid: pixel(canvas, 0, 0), empty: pixel(canvas, 2, 0) }
    game.setBackground(dos)
    game.drawFrameFlags(object, 0, 0, new DrawProperties(true, false, true, false))
    stage.redraw()
    const onlyOverwriteWithoutMask = { first: pixel(canvas, 0, 0), second: pixel(canvas, 2, 0) }
    stage.dispose()
    return { values, moved, ordered, fallback, noOverwrite, onlyOverwrite, onlyOverwriteWithoutMask }
  })
  expect(resultPixels.values.nativeTerrain).toEqual([0, 0, 80, 255])
  expect(resultPixels.values.nativeSprite).toEqual([0, 255, 0, 255])
  expect(resultPixels.values.panel).toEqual([255, 255, 255, 255])
  expect(resultPixels.moved.oldNative).toEqual([0, 0, 80, 255])
  expect(resultPixels.moved.newNative).toEqual([0, 255, 0, 255])
  expect(resultPixels.ordered).toEqual([7, 8, 9, 255])
  expect(resultPixels.fallback).toEqual({ errors: 1, noNative: true, terrain: [0, 0, 0, 255] })
  expect(resultPixels.noOverwrite).toEqual({ solid: [0, 0, 80, 255], empty: [255, 255, 0, 255] })
  expect(resultPixels.onlyOverwrite).toEqual({ solid: [0, 0, 255, 255], empty: [0, 0, 80, 255] })
  expect(resultPixels.onlyOverwriteWithoutMask).toEqual({ first: [0, 0, 255, 255], second: [255, 255, 0, 255] })
})

test('keeps full-resolution Windows toolbar artwork behind the HUD', async ({ page }) => {
  const result = await build({ configFile: false, logLevel: 'silent',
    build: { write: false, lib: { entry: resolve('tests/e2e/fixtures/windows-native-graphics.ts'), formats: ['es'] } } })
  const output = Array.isArray(result) ? result[0] : result
  if (!('output' in output)) throw new Error('Could not bundle the graphics fixture')
  const bundle = output.output.find(item => item.type === 'chunk')
  if (!bundle || bundle.type !== 'chunk') throw new Error('Could not bundle the graphics fixture')
  await page.route('**/__windows_panel_fixture.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle.code }))
  await page.goto('/')
  const actual = await page.evaluate(async () => {
    const path = '/__windows_panel_fixture.js'
    const { Stage, Frame, GameGui } = await import(path)
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 180
    const stage = new Stage(canvas, 2)
    const noopEvent = { on: () => {} }
    const panel = new Frame(320, 40); panel.fill(0, 0, 0)
    const empty = new Frame(8, 8); empty.fill(255, 255, 255)
    const digit = new Frame(8, 8); digit.setPixel(0, 0, 0xffffffff)
    const sprites = { getPanelSprite: () => panel, getLetterSprite: () => undefined,
      getNumberSpriteLeft: () => digit, getNumberSpriteRight: () => new Frame(8, 8), getNumberSpriteEmpty: () => empty }
    let skillCount = 1, countChanged = () => {}
    const skills = { onCountChanged: { on: (callback: () => void) => { countChanged = callback } },
      onSelectionChanged: noopEvent, getSkill: (type: number) => type === 1 ? skillCount : 0, getSelectedSkill: () => 8 }
    const timer = { onGameTick: noopEvent, getGameLeftTimeString: () => '5' }
    const victory = { getReleaseCount: () => 10, getNeedCount: () => 1, getOutCount: () => 0,
      getSurvivorPercentage: () => 0, getMinReleaseRate: () => 0, getCurrentReleaseRate: () => 0 }
    const gui = new GameGui({}, sprites, skills, timer, victory)
    gui.setGuiDisplay(stage.getGuiDisplay())
    const logical = Array.from({ length: 13 }, () => new Frame(16, 20))
    const native = Array.from({ length: 13 }, () => new Frame(32, 40))
    // An odd-positioned pixel cannot survive downsampling to 16x20.
    native[0].setPixel(5, 21, 0xff0000ff)
    gui.setWindowsPanel(logical, native); gui.render(); stage.redraw()
    const pixel = (x: number, y: number) => Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data)
    const values = [pixel(5, 141), pixel(6, 141), pixel(0, 120), pixel(31, 159)]
    const beforeEmpty = pixel(8, 114)
    skillCount = 0; countChanged(); gui.render(); stage.redraw()
    const afterEmpty = pixel(8, 114)
    // A new DOS game can reuse this same Stage and display.
    const dos = new GameGui({}, sprites, skills, timer, victory)
    dos.setGuiDisplay(stage.getGuiDisplay()); dos.render(); stage.redraw()
    const dosAfterWindows = { pixel: pixel(5, 141), native: !!stage.getGuiDisplay().getNativeLayers() }
    stage.dispose()
    return { values, beforeEmpty, afterEmpty, dosAfterWindows }
  })
  expect(actual.values).toEqual([[255, 0, 0, 255], [192, 192, 192, 255], [255, 255, 255, 255], [128, 128, 128, 255]])
  expect(actual.beforeEmpty).toEqual([255, 255, 255, 255])
  expect(actual.afterEmpty).toEqual([0, 0, 0, 255])
  expect(actual.dosAfterWindows).toEqual({ pixel: [0, 0, 0, 255], native: false })
})
