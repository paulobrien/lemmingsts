import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { pressGamePanel } from './fullscreen-helpers'

for (const edition of ['dos', 'windows'] as const) {
  test(`two-finger ${edition} zoom keeps controls and touch actions isolated`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'Exercises phone and tablet touch input')
    test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || (edition === 'windows' && !process.env.LEMMINGS_WINDOWS_ISO),
      'Requires the corresponding original game files')
    test.setTimeout(60000)
    await page.goto('/')
    if (edition === 'windows') {
      await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
    } else {
      const directory = resolve('dos/lemmings')
      const files = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.dat'))
        .map(name => resolve(directory, name))
      await page.locator('input[type=file]').first().setInputFiles(files)
    }
    await expect(page.getByLabel('Game mode')).toHaveValue(edition)
    await page.getByRole('link', { name: 'Play Lemmings' }).tap()
    await page.getByRole('button', { name: 'Start level' }).tap()
    const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
    const game = page.locator('.game-screen')
    const pause = page.getByRole('region', { name: 'Paused' })
    const reset = page.getByRole('button', { name: 'Reset zoom' })
    if (edition === 'windows') {
      await expect(game).toHaveClass(/native-windows-playing/)
      await pressGamePanel(canvas, true, 10, edition)
      await expect(pause).toBeVisible()
      await pause.getByRole('button', { name: 'Fullscreen', exact: true }).tap()
      await pause.getByRole('button', { name: 'Resume', exact: true }).tap()
    } else {
      await page.getByRole('button', { name: 'Fullscreen', exact: true }).tap()
    }
    await expect(game).toHaveClass(/is-fullscreen/)
    const selected = await page.locator('.skill-button[aria-pressed="true"]').allTextContents()
    const dig = page.locator('.skill-button').filter({ hasText: 'Dig' })
    const digBefore = await dig.textContent()
    const client = await page.context().newCDPSession(page)
    const pinch = async (from: number, to: number, cancel = false) => {
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not visible')
      const centreX = box.x + box.width * .5
      const dimensions = await canvas.evaluate((element: HTMLCanvasElement) => ({ width: element.width, height: element.height }))
      const playfieldFraction = edition === 'windows' ? (dimensions.height - 120) / dimensions.height : 380 / 480
      const y = box.y + box.height * playfieldFraction * .4
      const touches = (distance: number) => [
        { x: centreX - box.width * distance, y, id: 1 },
        { x: centreX + box.width * distance, y, id: 2 },
      ]
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(from) })
      for (let step = 1; step <= 4; step++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(from + (to - from) * step / 4) })
      }
      await client.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] })
    }
    await pinch(.07, .20)
    if (edition === 'windows') {
      const cameraLeft = () => canvas.evaluate((element: HTMLCanvasElement) => {
        const pixels = element.getContext('2d')!.getImageData(608, element.height - 100, 320, 76).data
        let left = 320
        for (let y = 0; y < 76; y++) for (let x = 0; x < 320; x++) {
          const i = (y * 320 + x) * 4
          if (pixels[i] === 255 && pixels[i + 1] === 255 && pixels[i + 2] === 0) left = Math.min(left, x)
        }
        return left === 320 ? -1 : left
      })
      const beforePan = await cameraLeft()
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not visible')
      const y = box.y + box.height * .2
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .7, y, id: 3 }] })
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * .4, y, id: 3 }] })
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await expect.poll(cameraLeft).toBeGreaterThan(beforePan)
    }
    await pressGamePanel(canvas, true, 10, edition)
    await expect(pause).toBeVisible()
    await expect(reset).toBeEnabled()
    await reset.tap()
    await expect(reset).toBeDisabled()
    if (edition === 'windows') {
      // Starting one contact on the level and another on the minimap must not
      // become a pinch or let the first contact assign a skill on release.
      await pause.getByRole('button', { name: 'Resume', exact: true }).tap()
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not visible')
      const height = await canvas.evaluate((element: HTMLCanvasElement) => element.height)
      const point = (x: number, y: number, id: number) => ({ x: box.x + box.width * x / 960, y: box.y + box.height * y / height, id })
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(460, 90, 4), point(760, height - 60, 5)] })
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(420, 90, 4), point(800, height - 60, 5)] })
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await pressGamePanel(canvas, true, 10, edition)
      await expect(pause).toBeVisible()
      await expect(reset).toBeDisabled()
    }
    await pause.getByRole('button', { name: 'Exit fullscreen', exact: true }).tap()
    await pause.getByRole('button', { name: 'Resume', exact: true }).tap()
    await expect(game).not.toHaveClass(/is-fullscreen/)

    // The reverse gesture also works outside fullscreen, and cancellation of
    // a subsequent gesture must not assign skills or leave input stuck.
    await canvas.scrollIntoViewIfNeeded()
    await pinch(.20, .07)
    await pinch(.07, .16, true)
    await pressGamePanel(canvas, true, 10, edition)
    await expect(pause).toBeVisible()
    await expect(reset).toBeEnabled()
    expect(await page.locator('.skill-button[aria-pressed="true"]').allTextContents()).toEqual(selected)
    expect(await dig.textContent()).toBe(digBefore)
    await reset.tap()
    await expect(reset).toBeDisabled()
    await client.detach()
  })
}
