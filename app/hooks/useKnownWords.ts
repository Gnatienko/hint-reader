import { useState, useRef } from "react";
import type { CefrLevel } from "../cefrWordLists";
import { getWordsForLevel } from "../cefrWordLists";

export function useKnownWords() {
  const [knownWords, setKnownWordsState] = useState<string[]>([]);
  const knownWordsSetRef = useRef<Set<string>>(new Set());

  // Keeps both the array state and the Set ref in sync.
  const setKnownWords = (words: string[]) => {
    knownWordsSetRef.current = new Set(words);
    setKnownWordsState(words);
  };

  const toggleKnownWord = (word: string) => {
    const key = word.toLowerCase();
    if (knownWordsSetRef.current.has(key)) {
      knownWordsSetRef.current.delete(key);
      setKnownWordsState((prev) => prev.filter((w) => w !== key));
    } else {
      knownWordsSetRef.current.add(key);
      setKnownWordsState((prev) => [...prev, key]);
    }
  };

  const removeKnownWord = (word: string) => {
    knownWordsSetRef.current.delete(word);
    setKnownWordsState((prev) => prev.filter((w) => w !== word));
  };

  const markAllWordsByLevel = (level: CefrLevel) => {
    const levelWords = getWordsForLevel(level);
    if (!levelWords.length) return;
    const levelWordKeys = levelWords.map((w) => w.toLowerCase());
    setKnownWordsState((prev) => {
      const existing = new Set(prev);
      const updated = [...prev];
      for (const key of levelWordKeys) {
        if (!existing.has(key)) {
          updated.push(key);
          existing.add(key);
        }
      }
      knownWordsSetRef.current = existing;
      return updated;
    });
  };

  const unmarkAllWordsByLevel = (level: CefrLevel) => {
    const levelWords = getWordsForLevel(level);
    if (!levelWords.length) return;
    const levelSet = new Set(levelWords.map((w) => w.toLowerCase()));
    setKnownWordsState((prev) => {
      const filtered = prev.filter((w) => !levelSet.has(w));
      knownWordsSetRef.current = new Set(filtered);
      return filtered;
    });
  };

  const areAllLevelWordsKnown = (level: CefrLevel): boolean => {
    const levelWords = getWordsForLevel(level);
    if (!levelWords.length) return false;
    return levelWords.every((w) => knownWordsSetRef.current.has(w.toLowerCase()));
  };

  return {
    knownWords,
    knownWordsSet: knownWordsSetRef,
    setKnownWords,
    toggleKnownWord,
    removeKnownWord,
    markAllWordsByLevel,
    unmarkAllWordsByLevel,
    areAllLevelWordsKnown,
  };
}
