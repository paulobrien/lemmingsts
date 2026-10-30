import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { build } from 'vite'
import { pressGamePanel } from './fullscreen-helpers'

test('renders every Windows toolbar animation frame at native resolution', async ({ page }) => {
  const built = await build({ configFile: false, logLevel: 'silent', build: {
    write: false, lib: { entry: resolve('tests/e2e/fixtures/windows-panel-animation.ts'), formats: ['es'] },
  } })
  const output = Array.isArray(built) ? built[0] : built
  if (!('output' in output)) throw new Error('Could not build panel fixture')
  const bundle = output.output.find(item => item.type === 'chunk')
  if (!bundle || bundle.type !== 'chunk') throw new Error('Could not bundle panel fixture')
  await page.route('**/__panel_animation.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle.code }))
  await page.goto('/')
  const actual = await page.evaluate(async () => {
    const path = '/__panel_animation.js'
    const { Stage, GameGui, Frame, EventHandler, SkillTypes } = await import(path)
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 480
    const stage = new Stage(canvas, 2)
    const event = () => new EventHandler()
    const timer = { onGameTick: event(), getGameLeftTimeString: () => '5-00' }
    const skills = { onCountChanged: event(), onSelectionChanged: event(), getSkill: () => 9, getSelectedSkill: () => SkillTypes.DIGGER }
    const victory = { getReleaseCount: () => 10, getNeedCount: () => 1, getOutCount: () => 0,
      getSurvivorPercentage: () => 0, getMinReleaseRate: () => 10, getCurrentReleaseRate: () => 12 }
    const number = new Frame(8, 8)
    const sprites = { getPanelSprite: () => new Frame(320, 40), getLetterSprite: () => undefined,
      getNumberSpriteLeft: () => number, getNumberSpriteRight: () => number, getNumberSpriteEmpty: () => number }
    const gui = new GameGui({ queueCommand: () => true }, sprites, skills, timer, victory)
    const display = stage.getGuiDisplay(); gui.setGuiDisplay(display)
    const icons = Array.from({ length: 13 }, () => new Frame(16, 20))
    const native = Array.from({ length: 13 }, () => new Frame(32, 40))
    // Odd coordinates cannot survive downsampling; this checks native pixels.
    native[0].setPixel(3, 5, 0xff0000ff)
    const next = new Frame(32, 40); next.setPixel(3, 5, 0xff00ff00)
    const smallNext = new Frame(16, 20)
    gui.setWindowsPanel(icons, native, icons.map((frame, i) => i ? [frame] : [frame, smallNext]),
      native.map((frame, i) => i ? [frame] : [frame, next]))
    const pixel = () => Array.from(canvas.getContext('2d')!.getImageData(3, 425, 1, 1).data)
    gui.render(); display.redraw(); const first = pixel()
    timer.onGameTick.trigger(); gui.render(); display.redraw(); const second = pixel()
    timer.onGameTick.trigger(); gui.render(); display.redraw(); const loop = pixel()
    stage.dispose()
    return { first, second, loop }
  })
  expect(actual).toEqual({ first: [255, 0, 0, 255], second: [0, 255, 0, 255], loop: [255, 0, 0, 255] })
})

test('animates the player’s actual Windows icon artwork and pauses it with the level', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO, 'Requires the local Windows ISO')
  await page.goto('/')
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await expect(page.getByLabel('Game mode')).toHaveValue('windows')
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect(page.locator('.game-screen')).toHaveClass(/native-windows-playing/)
  const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
  // Sample the original fast-forward artwork inside its Windows button cell.
  const icon = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext('2d')!.getImageData(492, element.height - 100, 44, 66).data
    return Array.from(pixels).join(',')
  })
  const initial = await icon()
  await expect.poll(icon).not.toBe(initial)
  await pressGamePanel(canvas, testInfo.project.name !== 'desktop', 10, 'windows')
  await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
  const paused = await icon()
  await page.waitForTimeout(300)
  expect(await icon()).toBe(paused)
})
