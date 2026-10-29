import { expect, type Locator } from '@playwright/test'

export async function gamePanelPosition(canvas: Locator, column: number) {
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  return { x: bounds!.x + bounds!.width * ((column * 16 + 8) * 2) / 800, y: bounds!.y + bounds!.height * 440 / 480 }
}

/** Press a button on the original DOS panel using the rendered canvas. */
export async function pressGamePanel(canvas: Locator, touch: boolean, column: number) {
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  // The stage buffer is 800x480. Its original panel begins at y=380,
  // Panel icons are 16 pixels wide at the panel's default 2x scale.
  const position = { x: bounds!.width * ((column * 16 + 8) * 2) / 800, y: bounds!.height * 440 / 480 }
  if (touch) await canvas.tap({ position })
  else await canvas.click({ position })
}

export const pauseFromGamePanel = (canvas: Locator, touch: boolean) => pressGamePanel(canvas, touch, 10)
