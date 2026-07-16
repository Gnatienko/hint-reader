import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  KEY_VALUE_STORE,
  SAVED_TEXTS_STORE,
  getValue,
  openDb,
  requestToPromise,
  setValue,
  transactionDone,
} from "./db";

const DB_NAME = "hint-reader";

async function clearStores() {
  const db = await openDb();
  const tx = db.transaction([KEY_VALUE_STORE, SAVED_TEXTS_STORE], "readwrite");
  tx.objectStore(KEY_VALUE_STORE).clear();
  tx.objectStore(SAVED_TEXTS_STORE).clear();
  await transactionDone(tx);
}

describe("db", () => {
  beforeEach(async () => {
    await clearStores();
  });

  it("creates the expected object stores on open", async () => {
    const db = await openDb();

    expect(db.name).toBe(DB_NAME);
    expect(db.objectStoreNames.contains(KEY_VALUE_STORE)).toBe(true);
    expect(db.objectStoreNames.contains(SAVED_TEXTS_STORE)).toBe(true);
  });

  it("round-trips values through the keyValue store", async () => {
    await setValue("knownWords", ["hello", "world"]);
    await expect(getValue("knownWords")).resolves.toEqual(["hello", "world"]);
  });

  it("returns undefined for a missing keyValue entry", async () => {
    await expect(getValue("missing-key")).resolves.toBeUndefined();
  });

  it("overwrites an existing keyValue entry", async () => {
    await setValue("counter", 1);
    await setValue("counter", 2);
    await expect(getValue("counter")).resolves.toBe(2);
  });

  it("resolves requestToPromise on success and rejects on error", async () => {
    const ok = {
      result: "done",
      error: null,
      onsuccess: null as ((this: IDBRequest, ev: Event) => void) | null,
      onerror: null as ((this: IDBRequest, ev: Event) => void) | null,
    };
    const okPromise = requestToPromise(ok as unknown as IDBRequest<string>);
    ok.onsuccess?.call(ok as unknown as IDBRequest, new Event("success"));
    await expect(okPromise).resolves.toBe("done");

    const fail = {
      result: undefined,
      error: new DOMException("boom"),
      onsuccess: null as ((this: IDBRequest, ev: Event) => void) | null,
      onerror: null as ((this: IDBRequest, ev: Event) => void) | null,
    };
    const failPromise = requestToPromise(fail as unknown as IDBRequest<unknown>);
    fail.onerror?.call(fail as unknown as IDBRequest, new Event("error"));
    await expect(failPromise).rejects.toThrow("boom");

    const fallback = {
      result: undefined,
      error: null,
      onsuccess: null as ((this: IDBRequest, ev: Event) => void) | null,
      onerror: null as ((this: IDBRequest, ev: Event) => void) | null,
    };
    const fallbackPromise = requestToPromise(
      fallback as unknown as IDBRequest<unknown>,
    );
    fallback.onerror?.call(
      fallback as unknown as IDBRequest,
      new Event("error"),
    );
    await expect(fallbackPromise).rejects.toThrow("IndexedDB request failed");
  });

  it("resolves transactionDone on complete and rejects on abort or error", async () => {
    const complete = {
      error: null,
      oncomplete: null as ((this: IDBTransaction, ev: Event) => void) | null,
      onerror: null as ((this: IDBTransaction, ev: Event) => void) | null,
      onabort: null as ((this: IDBTransaction, ev: Event) => void) | null,
    };
    const completePromise = transactionDone(
      complete as unknown as IDBTransaction,
    );
    complete.oncomplete?.call(
      complete as unknown as IDBTransaction,
      new Event("complete"),
    );
    await expect(completePromise).resolves.toBeUndefined();

    const aborted = {
      error: new DOMException("aborted"),
      oncomplete: null as ((this: IDBTransaction, ev: Event) => void) | null,
      onerror: null as ((this: IDBTransaction, ev: Event) => void) | null,
      onabort: null as ((this: IDBTransaction, ev: Event) => void) | null,
    };
    const abortPromise = transactionDone(aborted as unknown as IDBTransaction);
    aborted.onabort?.call(
      aborted as unknown as IDBTransaction,
      new Event("abort"),
    );
    await expect(abortPromise).rejects.toThrow("aborted");

    const failed = {
      error: null,
      oncomplete: null as ((this: IDBTransaction, ev: Event) => void) | null,
      onerror: null as ((this: IDBTransaction, ev: Event) => void) | null,
      onabort: null as ((this: IDBTransaction, ev: Event) => void) | null,
    };
    const errorPromise = transactionDone(failed as unknown as IDBTransaction);
    failed.onerror?.call(
      failed as unknown as IDBTransaction,
      new Event("error"),
    );
    await expect(errorPromise).rejects.toThrow("IndexedDB transaction failed");
  });
});

describe("openDb failure paths", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("rejects with a clear error when IndexedDB is unavailable", async () => {
    vi.resetModules();
    const indexedDbDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "indexedDB",
    );
    Reflect.deleteProperty(globalThis, "indexedDB");
    Reflect.deleteProperty(window, "indexedDB");

    try {
      const { openDb: openDbFresh } = await import("./db");
      await expect(openDbFresh()).rejects.toThrow("IndexedDB is not available");
    } finally {
      if (indexedDbDescriptor) {
        Object.defineProperty(globalThis, "indexedDB", indexedDbDescriptor);
      }
    }
  });

  it("rejects when the IndexedDB open request fails", async () => {
    vi.resetModules();
    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      const request = {
        result: undefined,
        error: new DOMException("open failed"),
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null,
        onerror: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null,
        onupgradeneeded: null as
          | ((this: IDBOpenDBRequest, ev: Event) => void)
          | null,
      };
      queueMicrotask(() => {
        request.onerror?.call(
          request as unknown as IDBOpenDBRequest,
          new Event("error"),
        );
      });
      return request as unknown as IDBOpenDBRequest;
    });

    const { openDb: openDbFresh } = await import("./db");
    await expect(openDbFresh()).rejects.toThrow("open failed");
  });
});
