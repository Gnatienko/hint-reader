import { useCallback, useState } from "react";
import { getSavedTexts, saveSavedText } from "../lib/savedTexts";
import type { Language, LanguageFrom, SavedText } from "../types";

function buildSavedTextSnapshot(
  id: string,
  name: string,
  sourceFileName: string | undefined,
  inputText: string,
  knownWords: string[],
  textSize: number,
  translationOpacity: number,
  language: Language,
  languageFrom: LanguageFrom,
  readingProgress: number,
  createdAt?: number,
): SavedText {
  return {
    id,
    name,
    sourceFileName,
    createdAt: createdAt ?? Date.now(),
    inputText,
    wordCount: inputText.trim().split(/\s+/).filter(Boolean).length,
    knownWords,
    textSize,
    translationOpacity,
    language,
    languageFrom,
    readingProgress,
  };
}

export function useDocumentPersistence(
  textSize: number,
  translationOpacity: number,
  language: Language,
  languageFrom: LanguageFrom,
) {
  const [savedTextsList, setSavedTextsList] = useState<SavedText[]>([]);

  const persistDocument = useCallback(
    (
      docId: string,
      docName: string,
      sourceFileName: string | null,
      text: string,
      words: string[],
      readingProgress: number,
    ) => {
      const existing = getSavedTexts().find((item) => item.id === docId);
      const snapshot = buildSavedTextSnapshot(
        docId,
        docName,
        sourceFileName ?? undefined,
        text,
        words,
        textSize,
        translationOpacity,
        language,
        languageFrom,
        readingProgress,
        existing?.createdAt,
      );
      saveSavedText(snapshot);
    },
    [textSize, translationOpacity, language, languageFrom],
  );

  const refreshSavedTextsList = useCallback(() => {
    setSavedTextsList(getSavedTexts());
  }, []);

  const removeSavedFromList = useCallback((id: string) => {
    setSavedTextsList((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { savedTextsList, persistDocument, refreshSavedTextsList, removeSavedFromList };
}
