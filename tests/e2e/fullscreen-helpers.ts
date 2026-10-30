import { expect, type Locator } from '@playwright/test'

export async function gamePanelPosition(canvas: Locator, column: number, edition: 'dos' | 'windows' = 'dos') {
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  return { x: bounds!.x + bounds!.width * (edition === 'windows' ? 32 + (column * 16 + 8) * 2.3 : (column * 16 + 8) * 2) / 800, y: bounds!.y + bounds!.height * (edition === 'windows' ? 449 : 440) / 480 }
}

/** Press a button on the original DOS panel using the rendered canvas. */
export async function pressGamePanel(canvas: Locator, touch: boolean, column: number, edition: 'dos' | 'windows' = 'dos') {
  // Wait for the native panel and its minimap to be painted before measuring
  // or tapping it. Starting a level and rotating can change canvas geometry.
  if (edition === 'windows') {
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
      const row = element.getContext('2d')!.getImageData(519, 426, 240, 1).data
      for (let i = 0; i < row.length; i += 4) {
        if (row[i] === 255 && row[i + 1] === 255 && row[i + 2] === 0) return true
      }
      return false
    })).toBe(true)
  }
  await canvas.scrollIntoViewIfNeeded()
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  // The stage buffer is 800x480. Its original panel begins at y=380,
  // DOS stays at 2x; the centered Windows panel is 2.3x.
  const position = { x: bounds!.width * (edition === 'windows' ? 32 + (column * 16 + 8) * 2.3 : (column * 16 + 8) * 2) / 800, y: bounds!.height * (edition === 'windows' ? 449 : 440) / 480 }
  if (touch) await canvas.tap({ position })
  else await canvas.click({ position })
}

export const pauseFromGamePanel = (canvas: Locator, touch: boolean) => pressGamePanel(canvas, touch, 10)
