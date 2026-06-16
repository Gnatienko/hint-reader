import { useCallback, useEffect, useRef, useState } from "react";
import type { CefrLevel } from "../cefrWordLists";
import { getWordsForLevel } from "../cefrWordLists";
import {
  WELCOME_DOCUMENT_ID,
  WELCOME_DOCUMENT_NAME,
  WELCOME_TEXT,
} from "../lib/defaultText";
import { getSavedTexts, saveSavedText, deleteSavedText } from "../lib/savedTexts";
import {
  buildWordObjectsFromText,
  needsTranslation,
  translateWord,
} from "../lib/translation";
import type { Language, LanguageFrom, SavedText, WordObject } from "../types";

const PREFETCH_PAGES_AHEAD = 2;

type HintReaderState = {
  wordObjects: WordObject[];
  activeDocumentName: string | null;
  textSize: number;
  setTextSize: (size: number) => void;
  translationOpacity: number;
  setTranslationOpacity: (value: number) => void;
  language: Language;
  setLanguage: (value: Language) => void;
  languageFrom: LanguageFrom;
  setLanguageFrom: (value: LanguageFrom) => void;
  translating: boolean;
  knownWords: string[];
  toggleKnownWord: (word: string) => void;
  removeKnownWord: (word: string) => void;
  markAllWordsByLevel: (level: CefrLevel) => void;
  unmarkAllWordsByLevel: (level: CefrLevel) => void;
  areAllLevelWordsKnown: (level: CefrLevel) => boolean;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  savedTextsList: SavedText[];
  refreshSavedTextsList: () => void;
  handleOpenTextFile: (file: File) => Promise<void>;
  handleOpenPastedText: (text: string) => void;
  handleLoadSaved: (saved: SavedText) => void;
  handleDeleteSaved: (id: string) => void;
  handlePageChange: (currentPage: number, pages: number[][]) => void;
};

function syncTranslatedIndices(wordObjects: WordObject[]): Set<number> {
  const indices = new Set<number>();
  wordObjects.forEach((item, index) => {
    if (needsTranslation(item.word) && item.translation !== "") {
      indices.add(index);
    }
  });
  return indices;
}

function buildSavedTextSnapshot(
  id: string,
  name: string,
  sourceFileName: string | undefined,
  inputText: string,
  wordObjects: WordObject[],
  knownWords: string[],
  textSize: number,
  translationOpacity: number,
  language: Language,
  languageFrom: LanguageFrom,
  createdAt?: number,
): SavedText {
  return {
    id,
    name,
    sourceFileName,
    createdAt: createdAt ?? Date.now(),
    inputText,
    wordObjects,
    knownWords,
    textSize,
    translationOpacity,
    language,
    languageFrom,
  };
}

export function useHintReaderState(): HintReaderState {
  const [inputText, setInputText] = useState("");
  const [wordObjects, setWordObjects] = useState<WordObject[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeDocumentName, setActiveDocumentName] = useState<string | null>(
    null,
  );
  const [activeSourceFileName, setActiveSourceFileName] = useState<
    string | null
  >(null);
  const [textSize, setTextSize] = useState(24);
  const [translationOpacity, setTranslationOpacity] = useState(18);
  const [language, setLanguage] = useState<Language>("uk");
  const [languageFrom, setLanguageFrom] = useState<LanguageFrom>("auto");
  const [translating, setTranslating] = useState(false);
  const [knownWords, setKnownWords] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [savedTextsList, setSavedTextsList] = useState<SavedText[]>([]);

  const translatedIndicesRef = useRef(new Set<number>());
  const inFlightIndicesRef = useRef(new Set<number>());
  const wordObjectsRef = useRef(wordObjects);
  const lastPagesRef = useRef<number[][]>([]);
  const lastCurrentPageRef = useRef(0);
  const translateGenerationRef = useRef(0);
  const skipLanguageResetRef = useRef(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    wordObjectsRef.current = wordObjects;
  }, [wordObjects]);

  const persistDocument = useCallback(
    (
      docId: string,
      docName: string,
      sourceFileName: string | null,
      text: string,
      objects: WordObject[],
      words: string[],
    ) => {
      const existing = getSavedTexts().find((item) => item.id === docId);
      const snapshot = buildSavedTextSnapshot(
        docId,
        docName,
        sourceFileName ?? undefined,
        text,
        objects,
        words,
        textSize,
        translationOpacity,
        language,
        languageFrom,
        existing?.createdAt,
      );
      saveSavedText(snapshot);
    },
    [textSize, translationOpacity, language, languageFrom],
  );

  const openDocument = useCallback(
    (
      text: string,
      name: string,
      sourceFileName: string | null,
      docId: string,
      words: string[],
      objects?: WordObject[],
    ) => {
      const tokenObjects = objects ?? buildWordObjectsFromText(text);
      translatedIndicesRef.current = syncTranslatedIndices(tokenObjects);
      inFlightIndicesRef.current.clear();
      translateGenerationRef.current++;

      setInputText(text);
      setWordObjects(tokenObjects);
      setKnownWords(words);
      setActiveDocumentId(docId);
      setActiveDocumentName(name);
      setActiveSourceFileName(sourceFileName);

      persistDocument(
        docId,
        name,
        sourceFileName,
        text,
        tokenObjects,
        words,
      );
    },
    [persistDocument],
  );

  const loadWelcomeDocument = useCallback(() => {
    const existing = getSavedTexts().find((item) => item.id === WELCOME_DOCUMENT_ID);
    if (existing) {
      openDocument(
        existing.inputText,
        existing.name,
        existing.sourceFileName ?? null,
        existing.id,
        existing.knownWords,
        existing.wordObjects,
      );
      return;
    }

    const objects = buildWordObjectsFromText(WELCOME_TEXT);
    openDocument(
      WELCOME_TEXT,
      WELCOME_DOCUMENT_NAME,
      null,
      WELCOME_DOCUMENT_ID,
      [],
      objects,
    );
  }, [openDocument]);

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

      const pendingIndices: number[] = [];
      const currentObjects = wordObjectsRef.current;
      for (let page = startPage; page <= endPage; page++) {
        for (const index of pages[page]) {
          const item = currentObjects[index];
          if (!item || !needsTranslation(item.word)) continue;
          if (translatedIndicesRef.current.has(index)) continue;
          if (inFlightIndicesRef.current.has(index)) continue;
          if (!pendingIndices.includes(index)) {
            pendingIndices.push(index);
          }
        }
      }

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

          setWordObjects((prev) => {
            const next = [...prev];
            if (!next[index]) return prev;
            next[index] = { ...next[index], translation };
            return next;
          });
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
    [],
  );

  const handlePageChange = useCallback(
    (currentPage: number, pages: number[][]) => {
      lastPagesRef.current = pages;
      lastCurrentPageRef.current = currentPage;

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
    },
    [ensureTranslatedForPages, languageFrom, language],
  );

  const applyDocument = useCallback(
    (saved: SavedText) => {
      setTextSize(saved.textSize);
      setTranslationOpacity(saved.translationOpacity);
      setLanguage(saved.language);
      setLanguageFrom(saved.languageFrom);
      openDocument(
        saved.inputText,
        saved.name,
        saved.sourceFileName ?? null,
        saved.id,
        saved.knownWords,
        saved.wordObjects,
      );
    },
    [openDocument],
  );

  useEffect(() => {
    if (initializedRef.current || typeof window === "undefined") return;
    initializedRef.current = true;

    try {
      const raw = window.localStorage.getItem("hint-reader-state");
      const parsed = raw ? JSON.parse(raw) : null;
      const savedTexts = getSavedTexts();

      if (parsed) {
        if (Array.isArray(parsed.knownWords)) {
          const normalized = parsed.knownWords
            .filter((w: unknown) => typeof w === "string")
            .map((w: string) => w.toLowerCase());
          setKnownWords(Array.from(new Set(normalized)));
        }
        if (typeof parsed.textSize === "number") {
          setTextSize(parsed.textSize);
        }
        if (typeof parsed.translationOpacity === "number") {
          setTranslationOpacity(parsed.translationOpacity);
        }
        if (parsed.language === "en" || parsed.language === "uk") {
          setLanguage(parsed.language);
        }
        if (
          parsed.languageFrom === "auto" ||
          parsed.languageFrom === "es" ||
          parsed.languageFrom === "en" ||
          parsed.languageFrom === "bg"
        ) {
          setLanguageFrom(parsed.languageFrom);
        }

        if (typeof parsed.activeDocumentId === "string") {
          const savedDoc = savedTexts.find(
            (item) => item.id === parsed.activeDocumentId,
          );
          if (savedDoc && savedDoc.wordObjects.length > 0) {
            applyDocument(savedDoc);
            return;
          }
        }

        if (
          Array.isArray(parsed.wordObjects) &&
          parsed.wordObjects.length > 0 &&
          typeof parsed.inputText === "string"
        ) {
          const objects = parsed.wordObjects as WordObject[];
          setInputText(parsed.inputText);
          setWordObjects(objects);
          if (typeof parsed.activeDocumentId === "string") {
            setActiveDocumentId(parsed.activeDocumentId);
          }
          if (typeof parsed.activeDocumentName === "string") {
            setActiveDocumentName(parsed.activeDocumentName);
          }
          if (typeof parsed.activeSourceFileName === "string") {
            setActiveSourceFileName(parsed.activeSourceFileName);
          }
          translatedIndicesRef.current = syncTranslatedIndices(objects);
          return;
        }
      }

      loadWelcomeDocument();
    } catch {
      loadWelcomeDocument();
    }
  }, [applyDocument, loadWelcomeDocument]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const data = {
        inputText,
        wordObjects,
        activeDocumentId,
        activeDocumentName,
        activeSourceFileName,
        knownWords,
        textSize,
        translationOpacity,
        language,
        languageFrom,
      };
      window.localStorage.setItem("hint-reader-state", JSON.stringify(data));
    } catch {
      // ignore write errors
    }
  }, [
    inputText,
    wordObjects,
    activeDocumentId,
    activeDocumentName,
    activeSourceFileName,
    knownWords,
    textSize,
    translationOpacity,
    language,
    languageFrom,
  ]);

  useEffect(() => {
    if (!activeDocumentId || !activeDocumentName) return;
    const timer = window.setTimeout(() => {
      persistDocument(
        activeDocumentId,
        activeDocumentName,
        activeSourceFileName,
        inputText,
        wordObjects,
        knownWords,
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    activeDocumentId,
    activeDocumentName,
    activeSourceFileName,
    inputText,
    wordObjects,
    knownWords,
    persistDocument,
  ]);

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
    setWordObjects(cleared);

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
  }, [language, languageFrom, ensureTranslatedForPages]);

  const handleOpenTextFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const displayName = file.name.replace(/\.txt$/i, "") || file.name;

      const existing = getSavedTexts().find(
        (item) => item.sourceFileName === file.name || item.name === displayName,
      );

      const docId = existing?.id ?? crypto.randomUUID();
      openDocument(
        text,
        displayName,
        file.name,
        docId,
        existing?.knownWords ?? [],
      );
    },
    [openDocument],
  );

  const handleOpenPastedText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const displayName = `Pasted text ${new Date().toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      })}`;

      openDocument(trimmed, displayName, null, crypto.randomUUID(), []);
    },
    [openDocument],
  );

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

  const refreshSavedTextsList = () => {
    setSavedTextsList(getSavedTexts());
  };

  const handleLoadSaved = (saved: SavedText) => {
    applyDocument(saved);
  };

  const handleDeleteSaved = (id: string) => {
    deleteSavedText(id);
    setSavedTextsList((prev) => prev.filter((s) => s.id !== id));
    if (activeDocumentId === id) {
      loadWelcomeDocument();
    }
  };

  return {
    wordObjects,
    activeDocumentName,
    textSize,
    setTextSize,
    translationOpacity,
    setTranslationOpacity,
    language,
    setLanguage,
    languageFrom,
    setLanguageFrom,
    translating,
    knownWords,
    toggleKnownWord,
    removeKnownWord,
    markAllWordsByLevel,
    unmarkAllWordsByLevel,
    areAllLevelWordsKnown,
    isSettingsOpen,
    setIsSettingsOpen,
    savedTextsList,
    refreshSavedTextsList,
    handleOpenTextFile,
    handleOpenPastedText,
    handleLoadSaved,
    handleDeleteSaved,
    handlePageChange,
  };
}
