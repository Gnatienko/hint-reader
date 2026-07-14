import { useCallback, useEffect, useRef, useState } from "react";
import { needsTranslation, translateWord } from "../lib/translation";
import type { Language, LanguageFrom, WordObject } from "../types";

export const PREFETCH_PAGES_AHEAD = 2;

function syncTranslatedIndices(wordObjects: WordObject[]): Set<number> {
  const indices = new Set<number>();
  wordObjects.forEach((item, index) => {
    if (needsTranslation(item.word) && item.translation !== "") {
      indices.add(index);
    }
  });
  return indices;
}

type UseTranslationOptions = {
  language: Language;
  languageFrom: LanguageFrom;
  wordObjectsRef: React.MutableRefObject<WordObject[]>;
  setWordObjects: (words: WordObject[]) => void;
  onWordsTranslated: () => void;
};

export function useTranslation({
  language,
  languageFrom,
  wordObjectsRef,
  setWordObjects,
  onWordsTranslated,
}: UseTranslationOptions) {
  const [translating, setTranslating] = useState(false);

  const translatedIndicesRef = useRef(new Set<number>());
  const inFlightIndicesRef = useRef(new Set<number>());
  const translateGenerationRef = useRef(0);
  const skipLanguageResetRef = useRef(true);
  const lastPagesRef = useRef<number[][]>([]);
  const lastCurrentPageRef = useRef(0);

  // Keep latest callbacks in refs so stable useCallback closures don't go stale.
  const setWordObjectsRef = useRef(setWordObjects);
  const onWordsTranslatedRef = useRef(onWordsTranslated);
  useEffect(() => {
    setWordObjectsRef.current = setWordObjects;
    onWordsTranslatedRef.current = onWordsTranslated;
  });

  const ensureTranslatedForPages = useCallback(
    async (
      pages: number[][],
      fromPage: number,
      toPage: number,
      langFrom: LanguageFrom,
      lang: Language,
    ) => {
      if (pages.length === 0 || wordObjectsRef.current.length === 0) return;

      const generation = translateGenerationRef.current;
      const startPage = Math.max(0, fromPage);
      const endPage = Math.min(toPage, pages.length - 1);

      const pendingIndicesSet = new Set<number>();
      const currentObjects = wordObjectsRef.current;
      for (let page = startPage; page <= endPage; page++) {
        for (const index of pages[page]) {
          const item = currentObjects[index];
          if (!item || !needsTranslation(item.word)) continue;
          if (translatedIndicesRef.current.has(index)) continue;
          if (inFlightIndicesRef.current.has(index)) continue;
          pendingIndicesSet.add(index);
        }
      }
      const pendingIndices = Array.from(pendingIndicesSet);

      if (pendingIndices.length === 0) return;

      for (const index of pendingIndices) {
        inFlightIndicesRef.current.add(index);
      }
      setTranslating(true);

      try {
        for (const index of pendingIndices) {
          if (generation !== translateGenerationRef.current) return;

          const item = wordObjectsRef.current[index];
          if (!item || !needsTranslation(item.word)) {
            inFlightIndicesRef.current.delete(index);
            continue;
          }

          const translation = await translateWord(item.word, langFrom, lang);
          if (generation !== translateGenerationRef.current) return;

          translatedIndicesRef.current.add(index);
          inFlightIndicesRef.current.delete(index);

          const next = [...wordObjectsRef.current];
          if (!next[index]) continue;
          next[index] = { ...next[index], translation };
          wordObjectsRef.current = next;
          setWordObjectsRef.current(next);
        }
        // Persist once after the entire batch, not after every word.
        if (generation === translateGenerationRef.current) {
          onWordsTranslatedRef.current();
        }
      } finally {
        if (
          generation === translateGenerationRef.current &&
          inFlightIndicesRef.current.size === 0
        ) {
          setTranslating(false);
        }
      }
    },
    // wordObjectsRef is a stable ref object; callbacks are accessed via refs above.
    [wordObjectsRef],
  );

  /**
   * Resets translation tracking state when a new document is opened.
   * Must be called before setting the new wordObjects state.
   */
  const initDocument = useCallback((tokenObjects: WordObject[]) => {
    translatedIndicesRef.current = syncTranslatedIndices(tokenObjects);
    inFlightIndicesRef.current.clear();
    translateGenerationRef.current++;
  }, []);

  // Re-translate when the target or source language changes.
  useEffect(() => {
    if (skipLanguageResetRef.current) {
      skipLanguageResetRef.current = false;
      return;
    }

    translateGenerationRef.current++;
    translatedIndicesRef.current.clear();
    inFlightIndicesRef.current.clear();

    const cleared = wordObjectsRef.current.map((item) =>
      needsTranslation(item.word) ? { ...item, translation: "" } : item,
    );
    wordObjectsRef.current = cleared;
    setWordObjectsRef.current(cleared);
    onWordsTranslatedRef.current();

    const pages = lastPagesRef.current;
    if (pages.length === 0) return;

    const currentPage = lastCurrentPageRef.current;
    const endPage = Math.min(
      currentPage + PREFETCH_PAGES_AHEAD,
      pages.length - 1,
    );

    void ensureTranslatedForPages(
      pages,
      currentPage,
      endPage,
      languageFrom,
      language,
    );
  }, [language, languageFrom, ensureTranslatedForPages, wordObjectsRef]);

  return {
    translating,
    lastPagesRef,
    lastCurrentPageRef,
    ensureTranslatedForPages,
    initDocument,
  };
}
