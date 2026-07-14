import { useCallback, useEffect, useRef, useState } from "react";
import {
  WELCOME_DOCUMENT_ID,
  WELCOME_DOCUMENT_NAME,
  WELCOME_TEXT,
} from "../lib/defaultText";
import { calculateReadingProgress } from "../lib/readingProgress";
import { getSavedTexts, deleteSavedText } from "../lib/savedTexts";
import { getDisplayNameFromFileName } from "../lib/bookFormats";
import { extractTextFromBookFile } from "../lib/extractBookText";
import { buildWordObjectsFromText } from "../lib/translation";
import type { CefrLevel } from "../cefrWordLists";
import type { Language, LanguageFrom, SavedText, WordObject } from "../types";
import { useKnownWords } from "./useKnownWords";
import { useDocumentPersistence } from "./useDocumentPersistence";
import { useTranslation, PREFETCH_PAGES_AHEAD } from "./useTranslation";

type HintReaderState = {
  wordObjects: WordObject[];
  activeDocumentId: string | null;
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
  activeReadingProgress: number;
};

export function useHintReaderState(): HintReaderState {
  const [inputText, setInputText] = useState("");
  const [wordObjects, setWordObjects] = useState<WordObject[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeDocumentName, setActiveDocumentName] = useState<string | null>(null);
  const [activeSourceFileName, setActiveSourceFileName] = useState<string | null>(null);
  const [textSize, setTextSize] = useState(24);
  const [translationOpacity, setTranslationOpacity] = useState(18);
  const [language, setLanguage] = useState<Language>("uk");
  const [languageFrom, setLanguageFrom] = useState<LanguageFrom>("auto");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeReadingProgress, setActiveReadingProgress] = useState(0);

  const wordObjectsRef = useRef(wordObjects);
  const initializedRef = useRef(false);
  const persistContextRef = useRef({
    activeDocumentId: null as string | null,
    activeDocumentName: null as string | null,
    activeSourceFileName: null as string | null,
    inputText: "",
    knownWords: [] as string[],
    activeReadingProgress: 0,
  });

  useEffect(() => {
    wordObjectsRef.current = wordObjects;
  }, [wordObjects]);

  // ── Sub-hooks ──────────────────────────────────────────────────────────────

  const {
    knownWords,
    setKnownWords,
    toggleKnownWord,
    removeKnownWord,
    markAllWordsByLevel,
    unmarkAllWordsByLevel,
    areAllLevelWordsKnown,
  } = useKnownWords();

  const {
    savedTextsList,
    persistDocument,
    refreshSavedTextsList,
    removeSavedFromList,
  } = useDocumentPersistence(textSize, translationOpacity, language, languageFrom);

  // Keep the persist context ref up to date so persistNow never uses stale values.
  useEffect(() => {
    persistContextRef.current = {
      activeDocumentId,
      activeDocumentName,
      activeSourceFileName,
      inputText,
      knownWords,
      activeReadingProgress,
    };
  }, [
    activeDocumentId,
    activeDocumentName,
    activeSourceFileName,
    inputText,
    knownWords,
    activeReadingProgress,
  ]);

  const persistNow = useCallback(
    (objects?: WordObject[]) => {
      const ctx = persistContextRef.current;
      if (!ctx.activeDocumentId || !ctx.activeDocumentName) return;
      persistDocument(
        ctx.activeDocumentId,
        ctx.activeDocumentName,
        ctx.activeSourceFileName,
        ctx.inputText,
        objects ?? wordObjectsRef.current,
        ctx.knownWords,
        ctx.activeReadingProgress,
      );
    },
    [persistDocument],
  );

  const {
    translating,
    lastPagesRef,
    lastCurrentPageRef,
    ensureTranslatedForPages,
    initDocument,
  } = useTranslation({
    language,
    languageFrom,
    wordObjectsRef,
    setWordObjects,
    onWordsTranslated: persistNow,
  });

  // ── Document management ────────────────────────────────────────────────────

  const openDocument = useCallback(
    (
      text: string,
      name: string,
      sourceFileName: string | null,
      docId: string,
      words: string[],
      objects?: WordObject[],
      readingProgress?: number,
    ) => {
      const existing = getSavedTexts().find((item) => item.id === docId);
      const progress = readingProgress ?? existing?.readingProgress ?? 0;

      const tokenObjects = objects ?? buildWordObjectsFromText(text);
      initDocument(tokenObjects);

      setInputText(text);
      setWordObjects(tokenObjects);
      setKnownWords(words);
      setActiveDocumentId(docId);
      setActiveDocumentName(name);
      setActiveSourceFileName(sourceFileName);
      setActiveReadingProgress(progress);

      persistDocument(docId, name, sourceFileName, text, tokenObjects, words, progress);
    },
    [initDocument, persistDocument, setKnownWords],
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
        saved.readingProgress ?? 0,
      );
    },
    [openDocument],
  );

  // ── Initialisation ─────────────────────────────────────────────────────────

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
        if (typeof parsed.textSize === "number") setTextSize(parsed.textSize);
        if (typeof parsed.translationOpacity === "number")
          setTranslationOpacity(parsed.translationOpacity);
        if (parsed.language === "en" || parsed.language === "uk")
          setLanguage(parsed.language);
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
          initDocument(objects);
          setInputText(parsed.inputText);
          setWordObjects(objects);
          if (typeof parsed.activeDocumentId === "string")
            setActiveDocumentId(parsed.activeDocumentId);
          if (typeof parsed.activeDocumentName === "string")
            setActiveDocumentName(parsed.activeDocumentName);
          if (typeof parsed.activeSourceFileName === "string")
            setActiveSourceFileName(parsed.activeSourceFileName);
          return;
        }
      }

      loadWelcomeDocument();
    } catch {
      loadWelcomeDocument();
    }
  }, [applyDocument, initDocument, loadWelcomeDocument, setKnownWords]);

  // Persist lightweight session snapshot to localStorage on every relevant change.
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

  // Debounced full persist to the saved-texts store.
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
        activeReadingProgress,
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
    activeReadingProgress,
    persistDocument,
  ]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePageChange = useCallback(
    (currentPage: number, pages: number[][]) => {
      lastPagesRef.current = pages;
      lastCurrentPageRef.current = currentPage;

      const progress = calculateReadingProgress(currentPage, pages.length);
      setActiveReadingProgress(progress);

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
    [ensureTranslatedForPages, lastPagesRef, lastCurrentPageRef, languageFrom, language],
  );

  const handleOpenTextFile = useCallback(
    async (file: File) => {
      const text = await extractTextFromBookFile(file);
      const displayName = getDisplayNameFromFileName(file.name) || file.name;

      const existing = getSavedTexts().find(
        (item) => item.sourceFileName === file.name || item.name === displayName,
      );

      if (existing) {
        setTextSize(existing.textSize);
        setTranslationOpacity(existing.translationOpacity);
        setLanguage(existing.language);
        setLanguageFrom(existing.languageFrom);
        openDocument(
          text,
          displayName,
          file.name,
          existing.id,
          existing.knownWords,
          existing.inputText === text && existing.wordObjects.length > 0
            ? existing.wordObjects
            : undefined,
          existing.readingProgress ?? 0,
        );
        return;
      }

      openDocument(text, displayName, file.name, crypto.randomUUID(), []);
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

  const handleLoadSaved = (saved: SavedText) => {
    applyDocument(saved);
  };

  const handleDeleteSaved = (id: string) => {
    deleteSavedText(id);
    removeSavedFromList(id);
    if (activeDocumentId === id) {
      loadWelcomeDocument();
    }
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    wordObjects,
    activeDocumentId,
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
    activeReadingProgress,
  };
}
