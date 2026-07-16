// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildWordObjectsFromDictionary,
  buildWordObjectsFromText,
  getFormattingWhitespaceKind,
  isFormattingWhitespaceToken,
  isPunctuationToken,
  needsTranslation,
  tokenize,
  translateWord,
} from "./translation";

describe("tokenize", () => {
  it("separates words and punctuation while discarding ordinary spaces", () => {
    expect(tokenize("Hello, world! How are you?")).toEqual([
      "Hello",
      ",",
      "world",
      "!",
      "How",
      "are",
      "you",
      "?",
    ]);
  });

  it("preserves newlines and tabs used for document formatting", () => {
    expect(tokenize("First\nSecond\tThird")).toEqual([
      "First",
      "\n",
      "Second",
      "\t",
      "Third",
    ]);
  });

  it("handles empty and whitespace-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("token classification", () => {
  it("identifies punctuation and formatting whitespace", () => {
    expect(isPunctuationToken("—")).toBe(true);
    expect(isPunctuationToken("word")).toBe(false);
    expect(isFormattingWhitespaceToken("\n")).toBe(true);
    expect(isFormattingWhitespaceToken(" ")).toBe(false);
  });

  it("classifies line, paragraph, and tab formatting", () => {
    expect(getFormattingWhitespaceKind("\n")).toBe("line");
    expect(getFormattingWhitespaceKind("\n \n")).toBe("paragraph");
    expect(getFormattingWhitespaceKind("\t\t")).toBe("tab");
    expect(getFormattingWhitespaceKind(" ")).toBeNull();
  });

  it("only requests translations for word tokens", () => {
    expect(needsTranslation("hola")).toBe(true);
    expect(needsTranslation(".")).toBe(false);
    expect(needsTranslation("\n")).toBe(false);
  });
});

function mockFetchJson(payload: unknown) {
  return vi.fn().mockResolvedValue({
    json: () => Promise.resolve(payload),
  });
}

describe("translateWord", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the translated text from a successful fetch", async () => {
    const fetchMock = mockFetchJson([[["bonjour", "hello"]]]);
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateWord("hello-success", "auto", "en");

    expect(result).toBe("bonjour");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("https://translate.googleapis.com/translate_a/single");
    expect(url).toContain("sl=auto");
    expect(url).toContain("tl=en");
    expect(url).toContain("q=hello-success");
  });

  it("returns an empty string for a malformed response shape", async () => {
    vi.stubGlobal("fetch", mockFetchJson({ unexpected: true }));
    expect(await translateWord("hello-malformed-1", "auto", "en")).toBe("");
  });

  it("returns an empty string when the response array is empty", async () => {
    vi.stubGlobal("fetch", mockFetchJson([]));
    expect(await translateWord("hello-malformed-2", "auto", "en")).toBe("");
  });

  it("returns an empty string when the network request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    expect(await translateWord("hello-network-fail", "auto", "en")).toBe("");
  });

  it("returns an empty string immediately for blank input without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await translateWord("   ", "auto", "en")).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("translation caching", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("avoids repeated fetches for a cached word", async () => {
    const fetchMock = mockFetchJson([[["cached-value", "cache-word"]]]);
    vi.stubGlobal("fetch", fetchMock);

    const first = await translateWord("cache-word", "auto", "en");
    const second = await translateWord("cache-word", "auto", "en");

    expect(first).toBe("cached-value");
    expect(second).toBe("cached-value");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats case differences and surrounding whitespace as the same entry", async () => {
    const fetchMock = mockFetchJson([[["value"]]]);
    vi.stubGlobal("fetch", fetchMock);

    await translateWord("MixedCase", "auto", "en");
    await translateWord("  mixedcase  ", "auto", "en");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses separate cache entries for different language combinations", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve([[["from-auto-en"]]]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve([[["from-auto-uk"]]]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve([[["from-es-en"]]]) });
    vi.stubGlobal("fetch", fetchMock);

    expect(await translateWord("combo-word", "auto", "en")).toBe("from-auto-en");
    expect(await translateWord("combo-word", "auto", "uk")).toBe("from-auto-uk");
    expect(await translateWord("combo-word", "es", "en")).toBe("from-es-en");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Repeats now hit each combination's own cache entry rather than fetching again.
    expect(await translateWord("combo-word", "auto", "en")).toBe("from-auto-en");
    expect(await translateWord("combo-word", "auto", "uk")).toBe("from-auto-uk");
    expect(await translateWord("combo-word", "es", "en")).toBe("from-es-en");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("buildWordObjectsFromText", () => {
  it("creates a word object with an empty translation for every token", () => {
    expect(buildWordObjectsFromText("Hi, Bob!")).toEqual([
      { word: "Hi", translation: "" },
      { word: ",", translation: "" },
      { word: "Bob", translation: "" },
      { word: "!", translation: "" },
    ]);
  });

  it("returns an empty array for blank text", () => {
    expect(buildWordObjectsFromText("   ")).toEqual([]);
  });
});

describe("buildWordObjectsFromDictionary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pre-fills translations already cached and leaves the rest blank", async () => {
    vi.stubGlobal("fetch", mockFetchJson([[["translated-dictword"]]]));
    await translateWord("dictword", "auto", "en");

    expect(
      buildWordObjectsFromDictionary("dictword uncached", "auto", "en"),
    ).toEqual([
      { word: "dictword", translation: "translated-dictword" },
      { word: "uncached", translation: "" },
    ]);
  });

  it("ignores cached translations from a different language combination", async () => {
    vi.stubGlobal("fetch", mockFetchJson([[["translated-otherword"]]]));
    await translateWord("otherword", "auto", "en");

    expect(buildWordObjectsFromDictionary("otherword", "auto", "uk")).toEqual([
      { word: "otherword", translation: "" },
    ]);
  });
});

describe("loadTranslationDictionary storage scenarios", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("./db");
    vi.unstubAllGlobals();
  });

  it("loads a valid persisted dictionary into the in-memory cache", async () => {
    vi.doMock("./db", () => ({
      getValue: vi.fn().mockResolvedValue({ "auto:en:hello": "hola" }),
      setValue: vi.fn().mockResolvedValue(undefined),
    }));

    const mod = await import("./translation");
    await mod.loadTranslationDictionary();

    expect(mod.buildWordObjectsFromDictionary("hello", "auto", "en")).toEqual([
      { word: "hello", translation: "hola" },
    ]);
  });

  it("starts empty when the persisted value has an invalid shape", async () => {
    vi.doMock("./db", () => ({
      getValue: vi.fn().mockResolvedValue(["not", "an", "object"]),
      setValue: vi.fn().mockResolvedValue(undefined),
    }));

    const mod = await import("./translation");
    await mod.loadTranslationDictionary();

    expect(mod.buildWordObjectsFromDictionary("hello", "auto", "en")).toEqual([
      { word: "hello", translation: "" },
    ]);
  });

  it("starts empty and does not throw when storage is unavailable", async () => {
    vi.doMock("./db", () => ({
      getValue: vi
        .fn()
        .mockRejectedValue(new Error("IndexedDB is not available")),
      setValue: vi
        .fn()
        .mockRejectedValue(new Error("IndexedDB is not available")),
    }));

    const mod = await import("./translation");
    await expect(mod.loadTranslationDictionary()).resolves.toBeUndefined();

    expect(mod.buildWordObjectsFromDictionary("hello", "auto", "en")).toEqual([
      { word: "hello", translation: "" },
    ]);
  });
});

describe("cache eviction and persistence debounce", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("./db");
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("evicts the least recently used entry once the cache exceeds its cap", async () => {
    vi.doMock("./db", () => ({
      getValue: vi.fn().mockResolvedValue(undefined),
      setValue: vi.fn().mockResolvedValue(undefined),
    }));
    const mod = await import("./translation");

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          json: () => Promise.resolve([[[`translated-${callCount}`]]]),
        });
      }),
    );

    const MAX_ENTRIES = 10000;
    for (let i = 0; i < MAX_ENTRIES + 1; i++) {
      await mod.translateWord(`word-${i}`, "auto", "en");
    }
    expect(callCount).toBe(MAX_ENTRIES + 1);

    // The oldest entry (word-0) should have been evicted, forcing a re-fetch.
    await mod.translateWord("word-0", "auto", "en");
    expect(callCount).toBe(MAX_ENTRIES + 2);

    // The most recently inserted entry should still be cached.
    await mod.translateWord(`word-${MAX_ENTRIES}`, "auto", "en");
    expect(callCount).toBe(MAX_ENTRIES + 2);
  }, 20000);

  it("debounces persistence so several cache writes trigger a single save", async () => {
    vi.useFakeTimers();
    const setValueMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock("./db", () => ({
      getValue: vi.fn().mockResolvedValue(undefined),
      setValue: setValueMock,
    }));
    const mod = await import("./translation");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: () => Promise.resolve([[["t"]]]) }),
    );

    await mod.translateWord("debounce-1", "auto", "en");
    await vi.advanceTimersByTimeAsync(500);
    await mod.translateWord("debounce-2", "auto", "en");
    expect(setValueMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(setValueMock).toHaveBeenCalledTimes(1);
    expect(setValueMock.mock.calls[0][1]).toMatchObject({
      "auto:en:debounce-1": "t",
      "auto:en:debounce-2": "t",
    });
  });
});
