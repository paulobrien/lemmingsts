import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('defaults to Windows when both editions are available and keeps a DOS choice', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO,
    'Requires local DOS files and LEMMINGS_WINDOWS_ISO')
  const files = (await readdir(resolve('dos/lemmings'))).filter(name => name.toLowerCase().endsWith('.dat'))
    .map(name => resolve('dos/lemmings', name))
  await page.goto('/')
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  const mode = page.getByLabel('Game mode')
  await expect(mode).toHaveValue('windows')
  const styling = (label: string) => page.getByLabel(label).evaluate(element => {
    const css = getComputedStyle(element)
    return { background: css.backgroundColor, border: css.borderColor, borderWidth: css.borderWidth,
      color: css.color, font: css.font, minHeight: css.minHeight }
  })
  expect(await styling('Game mode')).toEqual(await styling('Difficulty'))
  await mode.selectOption('dos')
  await page.reload()
  await expect(mode).toHaveValue('dos')
})
