import { expect, test } from '@playwright/test'

test('shows verified Windows hints and hides them if imported data changes', async ({ page }) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO,
    'Requires the local Windows ISO')
  await page.goto('/')
  await page.locator('input[accept*=".iso"]').setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await expect(page.getByText('Windows audio, graphics and level data added to this device.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('Game mode')).toHaveValue('windows')
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.getByRole('button', { name: 'Show a hint' })).toBeVisible()
  await page.getByRole('button', { name: 'Show a hint' }).click()
  await expect(page.getByText('Look for a place to dig through the floor.')).toBeVisible()
  await page.getByRole('button', { name: 'Show example first move' }).click()
  await expect(page.getByText(/Tested example, not live advice/)).toBeVisible()
  // Mutate a different level record; the current level still loads but hints
  // must be disabled because the installed edition no longer matches the tested one.
  await page.evaluate(async () => {
    const request = indexedDB.open('lemmings-game-files')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('windows-game', 'readwrite')
      const store = transaction.objectStore('windows-game')
      const get = store.get('LVL0097.LVL')
      get.onsuccess = () => {
        const bytes = new Uint8Array(get.result as ArrayBuffer)
        bytes[0] ^= 1
        store.put(bytes.buffer, 'LVL0097.LVL')
      }
      transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error)
    })
    db.close()
  })
  await page.reload()
  await expect(page.getByText('Hints were verified for a different Windows data set. You can still play this level.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show a hint' })).toHaveCount(0)
})
