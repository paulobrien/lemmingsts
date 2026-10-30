import { expect, test } from '@playwright/test'
import { gamePanelPosition, pressGamePanel } from './fullscreen-helpers'

test('defers the Windows pause menu until the normal-view panel gesture ends', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO, 'Requires the local Windows ISO')
  await page.goto('/')
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect(page.locator('.game-screen')).toHaveClass(/native-windows-playing/)
  const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
  await canvas.scrollIntoViewIfNeeded()
  const pause = await gamePanelPosition(canvas, 10, 'windows')
  const gameUrl = page.url()
  if (testInfo.project.name.startsWith('android-')) {
    const client = await page.context().newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pause] })
    await expect(page.getByRole('region', { name: 'Paused' })).toHaveCount(0)
    expect(page.url()).toBe(gameUrl)
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await client.detach()
  } else {
    await page.mouse.move(pause.x, pause.y)
    await page.mouse.down()
    await expect(page.getByRole('region', { name: 'Paused' })).toHaveCount(0)
    expect(page.url()).toBe(gameUrl)
    await page.mouse.up()
  }
  await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
  expect(page.url()).toBe(gameUrl)
})

test('the Windows fullscreen minimap moves the view without activating the toolbar', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO, 'Requires the local Windows ISO')
  await page.goto('/')
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect(page.locator('.game-screen')).toHaveClass(/native-windows-playing/)
  const canvas = page.getByLabel('Lemmings level. Drag to move the view.')
  const touch = testInfo.project.name.startsWith('android-')
  await pressGamePanel(canvas, touch, 10, 'windows')
  await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.locator('.game-screen')).toHaveClass(/is-fullscreen/)

  // The yellow camera outline's top edge provides a stable measure of the
  // viewport location without exposing any production internals to tests.
  const cameraLeft = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const row = element.getContext('2d')!.getImageData(608, element.height - 100, 320, 1).data
    for (let x = 0; x < 320; x++) {
      if (row[x * 4] === 255 && row[x * 4 + 1] === 255 && row[x * 4 + 2] === 0) return x
    }
    return -1
  })
  const position = async (x: number) => {
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas is not visible')
    const height = await canvas.evaluate((element: HTMLCanvasElement) => element.height)
    return { x: box.x + box.width * x / 960, y: box.y + box.height * (height - 62) / height }
  }
  const selectedBefore = await page.locator('.skill-button[aria-pressed="true"]').allTextContents()
  const left = await position(616), right = await position(920)
  if (touch) await page.touchscreen.tap(right.x, right.y)
  else await page.mouse.click(right.x, right.y)
  await expect.poll(cameraLeft).toBeGreaterThan(50)
  const afterTap = await cameraLeft()
  if (touch) {
    const client = await page.context().newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [right] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [left] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await client.detach()
  } else {
    await page.mouse.move(right.x, right.y)
    await page.mouse.down()
    await page.mouse.move(left.x, left.y, { steps: 5 })
    await page.mouse.up()
  }
  await expect.poll(cameraLeft).toBeLessThan(afterTap)
  // The original-style horizontal scrollbar moves the same camera. A track
  // tap should move right, then dragging its thumb should move left again.
  const afterMapDrag = await cameraLeft()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  const height = await canvas.evaluate((element: HTMLCanvasElement) => element.height)
  const trackPoint = (x: number) => ({ x: box.x + box.width * x / 960, y: box.y + box.height * (height - 112) / height })
  const trackRight = trackPoint(850), thumbRight = trackPoint(800), thumbLeft = trackPoint(250)
  if (touch) await page.touchscreen.tap(trackRight.x, trackRight.y)
  else await page.mouse.click(trackRight.x, trackRight.y)
  await expect.poll(cameraLeft).toBeGreaterThan(afterMapDrag)
  const afterTrackTap = await cameraLeft()
  if (touch) {
    const client = await page.context().newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [thumbRight] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [thumbLeft] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await client.detach()
  } else {
    await page.mouse.move(thumbRight.x, thumbRight.y)
    await page.mouse.down()
    await page.mouse.move(thumbLeft.x, thumbLeft.y, { steps: 5 })
    await page.mouse.up()
  }
  await expect.poll(cameraLeft).toBeLessThan(afterTrackTap)
  await expect(page.getByRole('region', { name: 'Paused' })).toHaveCount(0)
  await expect(page.getByText('Nuke armed.', { exact: false })).toHaveCount(0)
  expect(await page.locator('.skill-button[aria-pressed="true"]').allTextContents()).toEqual(selectedBefore)

  await pressGamePanel(canvas, touch, 10, 'windows')
  const menu = page.getByRole('region', { name: 'Paused' })
  await expect(menu).toBeVisible()
  const beforeAccessiblePan = await cameraLeft()
  await menu.getByRole('button', { name: 'Move view right' }).click()
  await expect.poll(cameraLeft).toBeGreaterThan(beforeAccessiblePan)
  await menu.getByRole('button', { name: 'Move view left' }).click()
  await expect.poll(cameraLeft).toBe(beforeAccessiblePan)
  const cameraWidth = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const row = element.getContext('2d')!.getImageData(608, element.height - 100, 320, 1).data
    const positions: number[] = []
    for (let x = 0; x < 320; x++) {
      if (row[x * 4] === 255 && row[x * 4 + 1] === 255 && row[x * 4 + 2] === 0) positions.push(x)
    }
    return positions.length ? positions[positions.length - 1] - positions[0] : 0
  })
  const widthBeforeZoom = await cameraWidth()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(cameraWidth).toBeLessThan(widthBeforeZoom)
  const leftAfterZoom = await cameraLeft()
  await menu.getByRole('button', { name: 'Resume', exact: true }).click()
  if (touch) await page.touchscreen.tap(trackRight.x, trackRight.y)
  else await page.mouse.click(trackRight.x, trackRight.y)
  await expect.poll(cameraLeft).toBeGreaterThan(leftAfterZoom)
  await expect(page.getByRole('region', { name: 'Paused' })).toHaveCount(0)
})
