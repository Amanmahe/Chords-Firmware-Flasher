/* -------------------------------------------------------------------------- */
/* Downloaded firmware, kept in IndexedDB                                      */
/* -------------------------------------------------------------------------- */

/*
 * Release files are saved per file name ("Chords-UNO-R4-MINIMA.bin"), so a
 * board can be flashed again without downloading, and offline. Every access
 * is best-effort: IndexedDB can be missing or blocked (private windows,
 * cleared site data), and flashing must still work without it.
 */

const DB_NAME = "chords-firmware";
const STORE = "files";

export interface SavedFirmware {
  name: string;
  version: string | null;
  size: number;
  savedAt: number;
  url: string;
}

interface Record extends SavedFirmware {
  data: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available"));
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "name" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Fires "change" whenever a file is saved or deleted, so the UI can refresh. */
export const firmwareCacheEvents = typeof EventTarget !== "undefined" ? new EventTarget() : null;
const changed = () => firmwareCacheEvents?.dispatchEvent(new Event("change"));

export async function getSavedFirmware(name: string) {
  try {
    return (await run<Record | undefined>("readonly", (s) => s.get(name))) ?? null;
  } catch {
    return null;
  }
}

export async function saveFirmware(file: SavedFirmware, data: Uint8Array) {
  try {
    const copy = data.slice().buffer as ArrayBuffer;
    await run("readwrite", (s) => s.put({ ...file, data: copy } satisfies Record));
    changed();
  } catch {
    /* not saved; flashing still works */
  }
}

/** Saved files without their bytes, newest first. */
export async function listSavedFirmware(): Promise<SavedFirmware[]> {
  try {
    const all = await run<Record[]>("readonly", (s) => s.getAll());
    return all
      .map(({ data: _data, ...meta }) => meta)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function deleteSavedFirmware(name: string) {
  try {
    await run("readwrite", (s) => s.delete(name));
    changed();
  } catch {}
}
