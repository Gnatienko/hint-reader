const DB_NAME = "hint-reader";
const DB_VERSION = 2;

export const SAVED_TEXTS_STORE = "savedTexts";
export const KEY_VALUE_STORE = "keyValue";

let dbPromise: Promise<IDBDatabase> | null = null;

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function openDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SAVED_TEXTS_STORE)) {
          db.createObjectStore(SAVED_TEXTS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(KEY_VALUE_STORE)) {
          db.createObjectStore(KEY_VALUE_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to open IndexedDB"));
    });
    // Allow a retry on the next call if opening failed.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/** Reads a value from the keyValue store; undefined when absent. */
export async function getValue(key: string): Promise<unknown> {
  const db = await openDb();
  const tx = db.transaction(KEY_VALUE_STORE, "readonly");
  return requestToPromise(tx.objectStore(KEY_VALUE_STORE).get(key));
}

/** Writes a value to the keyValue store. Throws on failure. */
export async function setValue(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(KEY_VALUE_STORE, "readwrite");
  tx.objectStore(KEY_VALUE_STORE).put(value, key);
  await transactionDone(tx);
}
