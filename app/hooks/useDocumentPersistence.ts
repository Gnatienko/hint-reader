import { useCallback, useRef, useState } from "react";
import { getSavedText, getSavedTexts, saveSavedText } from "../lib/savedTexts";
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
  const [storageError, setStorageError] = useState<string | null>(null);
  // Serialize writes so a slow save can't be overtaken by a newer one.
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const clearStorageError = useCallback(() => setStorageError(null), []);

  const persistDocument = useCallback(
    (
      docId: string,
      docName: string,
      sourceFileName: string | null,
      text: string,
      words: string[],
      readingProgress: number,
    ) => {
      writeQueueRef.current = writeQueueRef.current.then(async () => {
        try {
          const existing = await getSavedText(docId);
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
          await saveSavedText(snapshot);
          setStorageError(null);
        } catch (error) {
          console.error("Failed to save document", error);
          setStorageError(
            `Failed to save "${docName}". Your reading progress and known words may be lost when you close this tab.`,
          );
        }
      });
    },
    [textSize, translationOpacity, language, languageFrom],
  );

  const refreshSavedTextsList = useCallback(() => {
    getSavedTexts()
      .then(setSavedTextsList)
      .catch((error) => {
        console.error("Failed to load saved texts", error);
        setStorageError("Failed to load saved texts from storage.");
      });
  }, []);

  const removeSavedFromList = useCallback((id: string) => {
    setSavedTextsList((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    savedTextsList,
    persistDocument,
    refreshSavedTextsList,
    removeSavedFromList,
    storageError,
    setStorageError,
    clearStorageError,
  };
}
