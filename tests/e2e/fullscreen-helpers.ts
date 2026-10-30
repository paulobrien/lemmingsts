import { expect, type Locator } from '@playwright/test'

export async function gamePanelPosition(canvas: Locator, column: number, edition: 'dos' | 'windows' = 'dos') {
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  const { width, height } = await canvas.evaluate((element: HTMLCanvasElement) => ({ width: element.width, height: element.height }))
  const x = edition === 'windows' ? 8 + (column + .5) * 44 : (column * 16 + 8) * 2
  const y = edition === 'windows' ? height - 67 : 440
  return { x: bounds!.x + bounds!.width * x / width, y: bounds!.y + bounds!.height * y / height }
}

/** Press a button on either edition's rendered game panel. */
export async function pressGamePanel(canvas: Locator, touch: boolean, column: number, edition: 'dos' | 'windows' = 'dos') {
  // Wait for the native panel and its minimap to be painted before measuring
  // or tapping it. Starting a level and rotating can change canvas geometry.
  if (edition === 'windows') {
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
      const row = element.getContext('2d')!.getImageData(608, element.height - 100, 320, 76).data
      for (let i = 0; i < row.length; i += 4) {
        if (row[i] === 255 && row[i + 1] === 255 && row[i + 2] === 0) return true
      }
      return false
    })).toBe(true)
  }
  await canvas.scrollIntoViewIfNeeded()
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  const { width, height } = await canvas.evaluate((element: HTMLCanvasElement) => ({ width: element.width, height: element.height }))
  const x = edition === 'windows' ? 8 + (column + .5) * 44 : (column * 16 + 8) * 2
  const y = edition === 'windows' ? height - 67 : 440
  const position = { x: bounds!.width * x / width, y: bounds!.height * y / height }
  if (touch) await canvas.tap({ position })
  else await canvas.click({ position })
}

export const pauseFromGamePanel = (canvas: Locator, touch: boolean) => pressGamePanel(canvas, touch, 10)
