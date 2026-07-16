import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKnownWords } from "./useKnownWords";

vi.mock("../cefrWordLists", () => ({
  getWordsForLevel: vi.fn(),
}));

import { getWordsForLevel } from "../cefrWordLists";

const getWordsForLevelMock = vi.mocked(getWordsForLevel);

function setup() {
  return renderHook(() => useKnownWords());
}

describe("useKnownWords", () => {
  afterEach(() => {
    getWordsForLevelMock.mockReset();
  });

  it("starts with an empty known-words list and set", () => {
    const { result } = setup();

    expect(result.current.knownWords).toEqual([]);
    expect(result.current.knownWordsSet.current.size).toBe(0);
  });

  it("lowercases when toggling a word on and off", () => {
    const { result } = setup();

    act(() => {
      result.current.toggleKnownWord("Hello");
    });

    expect(result.current.knownWords).toEqual(["hello"]);
    expect(result.current.knownWordsSet.current.has("hello")).toBe(true);

    act(() => {
      result.current.toggleKnownWord("HELLO");
    });

    expect(result.current.knownWords).toEqual([]);
    expect(result.current.knownWordsSet.current.has("hello")).toBe(false);
  });

  it("keeps the array and set in sync when setKnownWords replaces the list", () => {
    const { result } = setup();

    act(() => {
      result.current.setKnownWords(["alpha", "beta"]);
    });

    expect(result.current.knownWords).toEqual(["alpha", "beta"]);
    expect(result.current.knownWordsSet.current.has("alpha")).toBe(true);
    expect(result.current.knownWordsSet.current.has("beta")).toBe(true);
  });

  it("removes an exact known-word string without lowercasing", () => {
    const { result } = setup();

    act(() => {
      result.current.setKnownWords(["Hello", "world"]);
    });
    act(() => {
      result.current.removeKnownWord("Hello");
    });

    expect(result.current.knownWords).toEqual(["world"]);
    expect(result.current.knownWordsSet.current.has("Hello")).toBe(false);
    expect(result.current.knownWordsSet.current.has("world")).toBe(true);
  });

  it("marks and unmarks all words for a CEFR level", () => {
    getWordsForLevelMock.mockReturnValue(["Cat", "dog", "Bird"]);
    const { result } = setup();

    act(() => {
      result.current.setKnownWords(["extra"]);
    });
    act(() => {
      result.current.markAllWordsByLevel("A1");
    });

    expect(result.current.knownWords).toEqual([
      "extra",
      "cat",
      "dog",
      "bird",
    ]);
    expect(result.current.areAllLevelWordsKnown("A1")).toBe(true);

    act(() => {
      result.current.unmarkAllWordsByLevel("A1");
    });

    expect(result.current.knownWords).toEqual(["extra"]);
    expect(result.current.areAllLevelWordsKnown("A1")).toBe(false);
  });

  it("no-ops level mark/unmark when the level list is empty", () => {
    getWordsForLevelMock.mockReturnValue([]);
    const { result } = setup();

    act(() => {
      result.current.setKnownWords(["keep"]);
    });
    act(() => {
      result.current.markAllWordsByLevel("C1");
      result.current.unmarkAllWordsByLevel("C1");
    });

    expect(result.current.knownWords).toEqual(["keep"]);
    expect(result.current.areAllLevelWordsKnown("C1")).toBe(false);
  });

  it("reports whether every word for a level is already known", () => {
    getWordsForLevelMock.mockReturnValue(["one", "two"]);
    const { result } = setup();

    expect(result.current.areAllLevelWordsKnown("B1")).toBe(false);

    act(() => {
      result.current.setKnownWords(["one"]);
    });
    expect(result.current.areAllLevelWordsKnown("B1")).toBe(false);

    act(() => {
      result.current.setKnownWords(["one", "two", "three"]);
    });
    expect(result.current.areAllLevelWordsKnown("B1")).toBe(true);
  });
});
