import { expect, test } from '@playwright/test'

test('a fresh browser loads bundled Windows and refresh restores it after removal', async ({ page }) => {
  test.skip(process.env.RUN_BUNDLED_GAME_TESTS !== '1', 'Requires a locally built deployment with the owner’s game files')
  test.setTimeout(90_000)
  await page.goto('/')
  const mode = page.getByLabel('Game mode')
  await expect(mode).toHaveValue('windows', { timeout: 45_000 })
  await expect(mode.locator('option[value="windows"]')).not.toHaveAttribute('disabled', '')
  await expect(mode.locator('option[value="dos"]')).not.toHaveAttribute('disabled', '', { timeout: 45_000 })
  await page.getByRole('button', { name: 'Remove Windows files' }).click()
  await expect(page.getByText('Windows files removed from this browser.')).toBeVisible()
  await expect(mode.locator('option[value="windows"]')).toHaveAttribute('disabled', '')
  await page.reload()
  await expect(mode).toHaveValue('windows', { timeout: 45_000 })
  await expect(mode.locator('option[value="windows"]')).not.toHaveAttribute('disabled', '')
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.getByRole('button', { name: 'Start level' })).toBeEnabled()
})

test('an existing Windows install receives the missing original fast-forward artwork', async ({ page }) => {
  test.skip(process.env.RUN_BUNDLED_GAME_TESTS !== '1', 'Requires a locally built deployment with the owner’s game files')
  test.setTimeout(90_000)
  await page.goto('/')
  await expect(page.getByLabel('Game mode')).toHaveValue('windows', { timeout: 45_000 })
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('lemmings-game-files')
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('windows-graphics', 'readwrite')
      transaction.objectStore('windows-graphics').delete('ICO_FF.SPR')
      transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error)
    })
    db.close()
  })
  await page.reload()
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('lemmings-game-files')
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const request = db.transaction('windows-graphics').objectStore('windows-graphics').get('ICO_FF.SPR')
        request.onsuccess = () => resolve(request.result instanceof ArrayBuffer)
        request.onerror = () => reject(request.error)
      })
    } finally { db.close() }
  }), { timeout: 45_000 }).toBe(true)
  await expect(page.getByLabel('Game mode')).toHaveValue('windows')
})
