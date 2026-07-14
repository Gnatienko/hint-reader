import { useState } from "react";
import type { CefrLevel } from "../cefrWordLists";
import { getWordsForLevel } from "../cefrWordLists";

export function useKnownWords() {
  const [knownWords, setKnownWords] = useState<string[]>([]);

  const toggleKnownWord = (word: string) => {
    const key = word.toLowerCase();
    setKnownWords((prev) =>
      prev.includes(key) ? prev.filter((w) => w !== key) : [...prev, key],
    );
  };

  const removeKnownWord = (word: string) => {
    setKnownWords((prev) => prev.filter((w) => w !== word));
  };

  const markAllWordsByLevel = (level: CefrLevel) => {
    const levelWords = getWordsForLevel(level);
    if (!levelWords.length) return;
    setKnownWords((prev) => {
      const existing = new Set(prev);
      const updated = [...prev];
      for (const w of levelWords) {
        const key = w.toLowerCase();
        if (!existing.has(key)) {
          updated.push(key);
          existing.add(key);
        }
      }
      return updated;
    });
  };

  const unmarkAllWordsByLevel = (level: CefrLevel) => {
    const levelWords = getWordsForLevel(level);
    if (!levelWords.length) return;
    const levelSet = new Set(levelWords.map((w) => w.toLowerCase()));
    setKnownWords((prev) => prev.filter((w) => !levelSet.has(w)));
  };

  const areAllLevelWordsKnown = (level: CefrLevel): boolean => {
    const levelWords = getWordsForLevel(level);
    if (!levelWords.length) return false;
    const knownSet = new Set(knownWords);
    return levelWords.every((w) => knownSet.has(w.toLowerCase()));
  };

  return {
    knownWords,
    setKnownWords,
    toggleKnownWord,
    removeKnownWord,
    markAllWordsByLevel,
    unmarkAllWordsByLevel,
    areAllLevelWordsKnown,
  };
}
