import { expect, test, type Page } from '@playwright/test'
import { pressGamePanel } from './fullscreen-helpers'

async function storedFiles(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('lemmings-game-files')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const stores = ['original-lemmings', 'windows-graphics', 'windows-game']
      const rows = await new Promise<{ name: string; keys: IDBValidKey[]; values: unknown[] }[]>((resolve, reject) => {
        const transaction = db.transaction(stores, 'readonly')
        const requests = stores.map(name => {
          const store = transaction.objectStore(name)
          return { name, keys: store.getAllKeys(), values: store.getAll() }
        })
        transaction.oncomplete = () => resolve(requests.map(({ name, keys, values }) => ({ name, keys: keys.result, values: values.result })))
        transaction.onabort = () => reject(transaction.error)
      })
      return Promise.all(rows.map(async row => ({
        name: row.name,
        keys: row.keys,
        values: await Promise.all(row.values.map(async value => value instanceof ArrayBuffer
          ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value))) : value)),
      })))
    } finally { db.close() }
  })
}

test('a failed Windows replacement preserves the installed files and remains playable after reload', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO,
    'Requires the local Windows ISO')
  test.setTimeout(60_000)
  await page.goto('/')
  const input = page.locator('input[accept*=".iso"]')
  await input.setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await expect(page.getByText('Windows audio, graphics and level data added to this device.')).toBeVisible({ timeout: 30_000 })
  const before = await storedFiles(page)
  expect(before.every(store => store.keys.length > 0)).toBe(true)

  // Abort the actual browser write transaction after requests have been queued.
  // This represents a quota/storage failure, rather than a validation rejection.
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
      const transaction = original.apply(this, args)
      const stores = Array.from(transaction.objectStoreNames)
      if (this.name === 'lemmings-game-files' && args[1] === 'readwrite' &&
          ['original-lemmings', 'windows-graphics', 'windows-game'].every(name => stores.includes(name))) {
        IDBDatabase.prototype.transaction = original
        queueMicrotask(() => transaction.abort())
      }
      return transaction
    }
  })
  await input.setInputFiles(process.env.LEMMINGS_WINDOWS_ISO!)
  await expect(page.getByText(/Could not save game files locally/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Windows audio, graphics and level data added to this device.')).toHaveCount(0)
  expect(await storedFiles(page)).toEqual(before)
  await page.reload()
  expect(await storedFiles(page)).toEqual(before)
  await expect(page.getByLabel('Game mode')).toHaveValue('windows')
  await page.getByRole('link', { name: 'Play Lemmings' }).click()
  await expect(page.getByRole('button', { name: 'Start level' })).toBeEnabled()
  await page.getByRole('button', { name: 'Start level' }).click()
  await expect(page.locator('.game-screen')).toHaveClass(/native-windows-playing/)
  await pressGamePanel(page.getByLabel('Lemmings level. Drag to move the view.'), testInfo.project.name.startsWith('android-'), 10, 'windows')
  await expect(page.getByRole('region', { name: 'Paused' })).toBeVisible()
})
