/** One database allows Windows audio, graphics and levels to be replaced together. */
export const GAME_DATABASE = 'lemmings-game-files';
export const ORIGINAL_STORE = 'original-lemmings';
export const WINDOWS_GRAPHICS_STORE = 'windows-graphics';
export const WINDOWS_GAME_STORE = 'windows-game';
const METADATA_STORE = 'metadata';
const MIGRATED = 'windows-legacy-migrated';

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not save game files locally. Check available storage and try again.'));
    transaction.onerror = () => { /* An aborted transaction rolls back every store. */ };
  });
}

function open(name: string, version?: number): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Local storage is unavailable. Enable site storage and try again.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (name === GAME_DATABASE) {
        for (const store of [ORIGINAL_STORE, WINDOWS_GRAPHICS_STORE, WINDOWS_GAME_STORE, METADATA_STORE]) {
          if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
        }
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (blocked) database.close(); else resolve(database);
    };
    request.onerror = () => reject(new Error('Could not open local game storage. Check your browser storage settings.'));
    request.onblocked = () => { blocked = true; reject(new Error('Local game storage is in use by another tab. Close it and try again.')); };
  });
}

async function legacyEntries(name: string, store: string): Promise<[IDBValidKey, unknown][]> {
  const database = await open(name);
  try {
    if (!database.objectStoreNames.contains(store)) return [];
    const transaction = database.transaction(store, 'readonly');
    const done = transactionDone(transaction);
    const result: [IDBValidKey, unknown][] = [];
    const cursor = transaction.objectStore(store).openCursor();
    cursor.onsuccess = () => {
      if (cursor.result) { result.push([cursor.result.key, cursor.result.value]); cursor.result.continue(); }
    };
    await done;
    return result;
  } finally { database.close(); }
}

const cleanedFactories = new WeakSet<IDBFactory>();
function removeMigratedDatabases(): void {
  if (cleanedFactories.has(indexedDB)) return;
  const factory = indexedDB;
  cleanedFactories.add(factory);
  for (const name of ['lemmings-windows-graphics', 'lemmings-windows-game']) {
    // Deletion is best effort after the unified transaction commits. An old tab
    // may delay it; that must not prevent the new installation from being used.
    const deletion = factory.deleteDatabase(name);
    deletion.onerror = deletion.onblocked = () => { cleanedFactories.delete(factory); };
  }
}

async function migrateLegacyWindows(database: IDBDatabase): Promise<void> {
  const check = database.transaction(METADATA_STORE, 'readonly');
  const checked = transactionDone(check);
  const marker = check.objectStore(METADATA_STORE).get(MIGRATED);
  await checked;
  if (marker.result) { removeMigratedDatabases(); return; }
  // Read legacy data before opening the write transaction. Keep the old databases
  // intact if validation, quota, shutdown or an aborted migration interrupts us.
  const [graphics, game] = await Promise.all([
    legacyEntries('lemmings-windows-graphics', 'graphics'),
    legacyEntries('lemmings-windows-game', 'files'),
  ]);
  const transaction = database.transaction([METADATA_STORE, WINDOWS_GRAPHICS_STORE, WINDOWS_GAME_STORE], 'readwrite');
  const done = transactionDone(transaction);
  const metadata = transaction.objectStore(METADATA_STORE);
  const migrated = metadata.get(MIGRATED);
  migrated.onsuccess = () => {
    // A second tab may have finished migration and imported or removed files.
    if (migrated.result) return;
    for (const [name, entries] of [[WINDOWS_GRAPHICS_STORE, graphics], [WINDOWS_GAME_STORE, game]] as const) {
      const store = transaction.objectStore(name);
      for (const [key, value] of entries) store.put(value, key);
    }
    metadata.put(true, MIGRATED);
  };
  await done;
  removeMigratedDatabases();
}

/** Upgrade in place, preserving DOS/audio, then migrate old Windows stores once. */
export async function openGameDatabase(): Promise<IDBDatabase> {
  const database = await open(GAME_DATABASE, 2);
  try { await migrateLegacyWindows(database); return database; }
  catch (error) { database.close(); throw error; }
}
