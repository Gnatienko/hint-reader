import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedText } from "../types";
import {
  KEY_VALUE_STORE,
  SAVED_TEXTS_STORE,
  openDb,
  transactionDone,
} from "./db";
import {
  deleteSavedText,
  getSavedText,
  getSavedTexts,
  parseSavedText,
  saveSavedText,
} from "./savedTexts";

function makeSavedText(overrides: Partial<SavedText> = {}): SavedText {
  return {
    id: "id",
    name: "name",
    createdAt: 0,
    inputText: "hello world",
    wordCount: 2,
    knownWords: [],
    textSize: 24,
    translationOpacity: 18,
    language: "uk",
    languageFrom: "auto",
    readingProgress: 0,
    ...overrides,
  };
}

async function clearSavedTextsStore() {
  const db = await openDb();
  const tx = db.transaction(
    [SAVED_TEXTS_STORE, KEY_VALUE_STORE],
    "readwrite",
  );
  tx.objectStore(SAVED_TEXTS_STORE).clear();
  tx.objectStore(KEY_VALUE_STORE).clear();
  await transactionDone(tx);
}

describe("parseSavedText", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves a complete valid saved record", () => {
    const record = {
      id: "book-1",
      name: "My book",
      sourceFileName: "my-book.epub",
      createdAt: 123,
      inputText: "one two",
      wordCount: 2,
      knownWords: ["one"],
      textSize: 30,
      translationOpacity: 40,
      language: "en",
      languageFrom: "es",
      readingProgress: 62.5,
    };

    expect(parseSavedText(record)).toEqual(record);
  });

  it("rejects records missing essential string fields", () => {
    expect(parseSavedText(null)).toBeNull();
    expect(parseSavedText({ name: "Book", inputText: "text" })).toBeNull();
    expect(
      parseSavedText({ id: "", name: "Book", inputText: "text" }),
    ).toBeNull();
    expect(
      parseSavedText({ id: "1", name: 42, inputText: "text" }),
    ).toBeNull();
    expect(
      parseSavedText({ id: "1", name: "Book", inputText: null }),
    ).toBeNull();
  });

  it("fills safe defaults and filters invalid known words", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T00:00:00Z"));

    expect(
      parseSavedText({
        id: "book-2",
        name: "Imported",
        inputText: "  one   two\nthree ",
        knownWords: ["one", 2, null],
        language: "invalid",
        languageFrom: "invalid",
      }),
    ).toEqual({
      id: "book-2",
      name: "Imported",
      sourceFileName: undefined,
      createdAt: Date.now(),
      inputText: "  one   two\nthree ",
      wordCount: 3,
      knownWords: ["one"],
      textSize: 24,
      translationOpacity: 18,
      language: "uk",
      languageFrom: "auto",
      readingProgress: 0,
    });
  });
});

describe("savedTexts CRUD", () => {
  beforeEach(async () => {
    await clearSavedTextsStore();
  });

  it("saves and loads a single saved text by id", async () => {
    const item = makeSavedText({
      id: "book-1",
      name: "Chapter 1",
      knownWords: ["hello"],
      language: "en",
    });

    await saveSavedText(item);

    await expect(getSavedText("book-1")).resolves.toEqual(item);
    await expect(getSavedText("missing")).resolves.toBeNull();
  });

  it("returns saved texts newest first", async () => {
    await saveSavedText(
      makeSavedText({ id: "old", name: "Old", createdAt: 100 }),
    );
    await saveSavedText(
      makeSavedText({ id: "new", name: "New", createdAt: 300 }),
    );
    await saveSavedText(
      makeSavedText({ id: "mid", name: "Mid", createdAt: 200 }),
    );

    const items = await getSavedTexts();
    expect(items.map((item) => item.id)).toEqual(["new", "mid", "old"]);
  });

  it("updates an existing saved text when saving the same id", async () => {
    await saveSavedText(makeSavedText({ id: "book-1", name: "Draft" }));
    await saveSavedText(
      makeSavedText({ id: "book-1", name: "Final", readingProgress: 50 }),
    );

    await expect(getSavedText("book-1")).resolves.toMatchObject({
      name: "Final",
      readingProgress: 50,
    });
    await expect(getSavedTexts()).resolves.toHaveLength(1);
  });

  it("deletes a saved text by id", async () => {
    await saveSavedText(makeSavedText({ id: "keep", name: "Keep" }));
    await saveSavedText(makeSavedText({ id: "drop", name: "Drop" }));

    await deleteSavedText("drop");

    await expect(getSavedText("drop")).resolves.toBeNull();
    await expect(getSavedTexts()).resolves.toEqual([
      makeSavedText({ id: "keep", name: "Keep" }),
    ]);
  });

  it("skips invalid records when listing saved texts", async () => {
    await saveSavedText(makeSavedText({ id: "valid", name: "Valid" }));

    const db = await openDb();
    const tx = db.transaction(SAVED_TEXTS_STORE, "readwrite");
    tx.objectStore(SAVED_TEXTS_STORE).put({
      id: "broken",
      name: "Broken",
      // missing inputText
    });
    await transactionDone(tx);

    await expect(getSavedTexts()).resolves.toEqual([
      makeSavedText({ id: "valid", name: "Valid" }),
    ]);
  });
});
