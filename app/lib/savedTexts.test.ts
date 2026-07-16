import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSavedText } from "./savedTexts";

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
