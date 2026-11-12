import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('the DOS minimap follows camera changes while the game is paused', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1', 'Requires original DOS game files')
  const directory = resolve('dos/lemmings')
  const files = (await readdir(directory)).filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve(directory, name))
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await expect(page.getByLabel('Game mode')).toHaveValue('dos')
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
  const map = () => canvas.evaluate((element: HTMLCanvasElement) =>
    Array.from(element.getContext('2d')!.getImageData(416, 436, 208, 40).data))
  // Ensure a game frame has painted the panel before pausing.
  await expect.poll(async () => (await map()).some((value, index, pixels) =>
    index % 4 === 0 && value === 255 && pixels[index + 1] === 255 && pixels[index + 2] === 255)).toBe(true)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const pause = page.getByRole('region', { name: 'Paused' })
  await expect(pause).toBeVisible()
  let before = await map()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(map).not.toEqual(before)

  const position = async (x: number, y: number) => {
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas is not visible')
    return { x: box.x + box.width * x / 800, y: box.y + box.height * y / 480 }
  }
  before = await map()
  const start = await position(520, 455), end = await position(600, 455)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 4 })
  await page.mouse.up()
  await expect.poll(map).not.toEqual(before)

  await canvas.scrollIntoViewIfNeeded()
  before = await map()
  const sceneStart = await position(300, 150), sceneEnd = await position(480, 150)
  await page.mouse.move(sceneStart.x, sceneStart.y)
  await page.mouse.down()
  await page.mouse.move(sceneEnd.x, sceneEnd.y, { steps: 4 })
  await page.mouse.up()
  await expect.poll(map).not.toEqual(before)

  if (testInfo.project.name.startsWith('android-')) {
    before = await map()
    const a = await position(300, 150), b = await position(390, 150), wider = await position(460, 150)
    const client = await page.context().newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 1 }, { ...b, id: 2 }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...a, id: 1 }, { ...wider, id: 2 }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await client.detach()
    await expect.poll(map).not.toEqual(before)
  }

  await pause.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  await expect(page.locator('.game-screen')).toHaveClass(/is-fullscreen/)
  before = await map()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(map).not.toEqual(before)
})
