// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Language, LanguageFrom, WordObject } from "../types";
import { useTranslation } from "./useTranslation";

vi.mock("../lib/translation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/translation")>();
  return {
    ...actual,
    translateWord: vi.fn(),
  };
});

import { translateWord } from "../lib/translation";

const translateWordMock = vi.mocked(translateWord);

type Props = { language: Language; languageFrom: LanguageFrom };

function setup(initialWords: WordObject[], initialProps: Props) {
  const wordObjectsRef: { current: WordObject[] } = { current: initialWords };
  const setWordObjects = vi.fn((words: WordObject[]) => {
    wordObjectsRef.current = words;
  });
  const onWordsTranslated = vi.fn();

  const rendered = renderHook(
    (props: Props) =>
      useTranslation({
        language: props.language,
        languageFrom: props.languageFrom,
        wordObjectsRef,
        setWordObjects,
        onWordsTranslated,
      }),
    { initialProps },
  );

  return { ...rendered, wordObjectsRef, setWordObjects, onWordsTranslated };
}

describe("useTranslation", () => {
  afterEach(() => {
    translateWordMock.mockReset();
  });

  it("translates only the words within the requested (visible + prefetched) page range", async () => {
    translateWordMock.mockResolvedValue("t");
    const words: WordObject[] = [
      { word: "one", translation: "" },
      { word: "two", translation: "" },
      { word: "three", translation: "" },
      { word: "four", translation: "" },
    ];
    const { result, wordObjectsRef } = setup(words, {
      language: "en",
      languageFrom: "auto",
    });
    const pages = [[0], [1], [2], [3]];

    await act(async () => {
      await result.current.ensureTranslatedForPages(pages, 1, 2, "auto", "en");
    });

    expect(translateWordMock).toHaveBeenCalledTimes(2);
    expect(translateWordMock).toHaveBeenCalledWith("two", "auto", "en");
    expect(translateWordMock).toHaveBeenCalledWith("three", "auto", "en");
    expect(wordObjectsRef.current[0].translation).toBe("");
    expect(wordObjectsRef.current[3].translation).toBe("");
  });

  it("skips punctuation and formatting whitespace tokens", async () => {
    translateWordMock.mockResolvedValue("t");
    const words: WordObject[] = [
      { word: "Hello", translation: "" },
      { word: ",", translation: "" },
      { word: "\n", translation: "" },
      { word: "world", translation: "" },
    ];
    const { result } = setup(words, { language: "en", languageFrom: "auto" });
    const pages = [[0, 1, 2, 3]];

    await act(async () => {
      await result.current.ensureTranslatedForPages(pages, 0, 0, "auto", "en");
    });

    expect(translateWordMock).toHaveBeenCalledTimes(2);
    expect(translateWordMock).toHaveBeenCalledWith("Hello", "auto", "en");
    expect(translateWordMock).toHaveBeenCalledWith("world", "auto", "en");
  });

  it("suppresses duplicate requests for a word that is already in flight", async () => {
    let resolveTranslate: (value: string) => void = () => {};
    translateWordMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTranslate = resolve;
        }),
    );
    const words: WordObject[] = [{ word: "one", translation: "" }];
    const { result } = setup(words, { language: "en", languageFrom: "auto" });
    const pages = [[0]];

    let firstCall!: Promise<void>;
    let secondCall!: Promise<void>;
    act(() => {
      firstCall = result.current.ensureTranslatedForPages(
        pages,
        0,
        0,
        "auto",
        "en",
      );
      secondCall = result.current.ensureTranslatedForPages(
        pages,
        0,
        0,
        "auto",
        "en",
      );
    });

    expect(translateWordMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveTranslate("uno");
      await firstCall;
      await secondCall;
    });

    expect(translateWordMock).toHaveBeenCalledTimes(1);
  });

  it("does not re-request a word that has already been translated", async () => {
    translateWordMock.mockResolvedValue("uno");
    const words: WordObject[] = [{ word: "one", translation: "" }];
    const { result } = setup(words, { language: "en", languageFrom: "auto" });
    const pages = [[0]];

    await act(async () => {
      await result.current.ensureTranslatedForPages(pages, 0, 0, "auto", "en");
    });
    await act(async () => {
      await result.current.ensureTranslatedForPages(pages, 0, 0, "auto", "en");
    });

    expect(translateWordMock).toHaveBeenCalledTimes(1);
  });

  it("cancels stale in-flight results and clears translations when the language changes", async () => {
    let resolveTranslate: (value: string) => void = () => {};
    translateWordMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTranslate = resolve;
        }),
    );
    const words: WordObject[] = [{ word: "one", translation: "" }];
    const { result, rerender, wordObjectsRef, onWordsTranslated } = setup(
      words,
      { language: "en", languageFrom: "auto" },
    );
    const pages = [[0]];

    act(() => {
      void result.current.ensureTranslatedForPages(pages, 0, 0, "auto", "en");
    });
    expect(translateWordMock).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ language: "uk", languageFrom: "auto" });
    });

    expect(wordObjectsRef.current[0].translation).toBe("");
    expect(onWordsTranslated).toHaveBeenCalled();

    await act(async () => {
      resolveTranslate("uno");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(wordObjectsRef.current[0].translation).toBe("");
  });

  it("tracks the translating state and calls onWordsTranslated once per completed batch", async () => {
    let resolveTranslate: (value: string) => void = () => {};
    translateWordMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTranslate = resolve;
        }),
    );
    const words: WordObject[] = [{ word: "one", translation: "" }];
    const { result, onWordsTranslated } = setup(words, {
      language: "en",
      languageFrom: "auto",
    });
    const pages = [[0]];

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.ensureTranslatedForPages(
        pages,
        0,
        0,
        "auto",
        "en",
      );
    });

    expect(result.current.translating).toBe(true);
    expect(onWordsTranslated).not.toHaveBeenCalled();

    await act(async () => {
      resolveTranslate("uno");
      await pending;
    });

    expect(result.current.translating).toBe(false);
    expect(onWordsTranslated).toHaveBeenCalledTimes(1);
  });

  it("recognizes translations that were already cached when the document was initialized", async () => {
    translateWordMock.mockResolvedValue("t");
    const words: WordObject[] = [
      { word: "one", translation: "uno" },
      { word: "two", translation: "" },
    ];
    const { result } = setup(words, { language: "en", languageFrom: "auto" });

    act(() => {
      result.current.initDocument(words);
    });

    const pages = [[0, 1]];
    await act(async () => {
      await result.current.ensureTranslatedForPages(pages, 0, 0, "auto", "en");
    });

    expect(translateWordMock).toHaveBeenCalledTimes(1);
    expect(translateWordMock).toHaveBeenCalledWith("two", "auto", "en");
  });
});
