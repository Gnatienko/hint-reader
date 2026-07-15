import { useCallback, useEffect, useRef, useState } from "react";
import {
  WELCOME_DOCUMENT_ID,
  WELCOME_DOCUMENT_NAME,
  WELCOME_TEXT,
} from "../lib/defaultText";
import { getValue, setValue } from "../lib/db";
import { calculateReadingProgress } from "../lib/readingProgress";
import { getSavedText, getSavedTexts, deleteSavedText } from "../lib/savedTexts";
import { getDisplayNameFromFileName } from "../lib/bookFormats";
import { extractTextFromBookFile } from "../lib/extractBookText";
import {
  buildWordObjectsFromDictionary,
  loadTranslationDictionary,
} from "../lib/translation";
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
  knownWordsSet: { current: Set<string> };
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
  storageError: string | null;
  clearStorageError: () => void;
};

const SESSION_STATE_KEY = "session-state";
const SESSION_WRITE_DEBOUNCE_MS = 300;

/** localStorage keys used by older versions; cleared once to free quota. */
const LEGACY_LOCAL_STORAGE_KEYS = [
  "hint-reader-state",
  "hint-reader-saved-texts",
  "hint-reader-translation-dictionary",
];

function parseSessionLanguage(value: unknown): Language | null {
  return value === "en" || value === "uk" ? value : null;
}

function parseSessionLanguageFrom(value: unknown): LanguageFrom | null {
  return value === "auto" || value === "es" || value === "en" || value === "bg"
    ? value
    : null;
}

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
  // Blocks session-snapshot writes until startup restore finishes, so the
  // initial default state can't overwrite the persisted snapshot.
  const hydratedRef = useRef(false);
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
    knownWordsSet,
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
    storageError,
    setStorageError,
    clearStorageError,
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
    () => {
      const ctx = persistContextRef.current;
      if (!ctx.activeDocumentId || !ctx.activeDocumentName) return;
      persistDocument(
        ctx.activeDocumentId,
        ctx.activeDocumentName,
        ctx.activeSourceFileName,
        ctx.inputText,
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
      readingProgress?: number,
      langFromOverride?: LanguageFrom,
      langOverride?: Language,
    ) => {
      const langFrom = langFromOverride ?? languageFrom;
      const lang = langOverride ?? language;
      const progress = readingProgress ?? 0;

      const tokenObjects = buildWordObjectsFromDictionary(text, langFrom, lang);
      initDocument(tokenObjects);

      setInputText(text);
      setWordObjects(tokenObjects);
      setKnownWords(words);
      setActiveDocumentId(docId);
      setActiveDocumentName(name);
      setActiveSourceFileName(sourceFileName);
      setActiveReadingProgress(progress);

      persistDocument(docId, name, sourceFileName, text, words, progress);
    },
    [initDocument, persistDocument, setKnownWords, language, languageFrom],
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
        saved.readingProgress ?? 0,
        saved.languageFrom,
        saved.language,
      );
    },
    [openDocument],
  );

  const loadWelcomeDocument = useCallback(async () => {
    const existing = await getSavedText(WELCOME_DOCUMENT_ID).catch(() => null);
    if (existing) {
      openDocument(
        existing.inputText,
        existing.name,
        existing.sourceFileName ?? null,
        existing.id,
        existing.knownWords,
        existing.readingProgress ?? 0,
        existing.languageFrom,
        existing.language,
      );
      return;
    }

    openDocument(
      WELCOME_TEXT,
      WELCOME_DOCUMENT_NAME,
      null,
      WELCOME_DOCUMENT_ID,
      [],
    );
  }, [openDocument]);

  // ── Initialisation ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (initializedRef.current || typeof window === "undefined") return;
    initializedRef.current = true;

    void (async () => {
      try {
        // Old versions kept everything in localStorage; free that quota.
        try {
          for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
            window.localStorage.removeItem(key);
          }
        } catch {
          // localStorage unavailable: nothing to clean up.
        }

        // Populate the in-memory cache before building word objects.
        await loadTranslationDictionary();

        let parsed: Record<string, unknown> | null = null;
        try {
          const candidate = await getValue(SESSION_STATE_KEY);
          if (
            candidate &&
            typeof candidate === "object" &&
            !Array.isArray(candidate)
          ) {
            parsed = candidate as Record<string, unknown>;
          }
        } catch (error) {
          console.error("Failed to load session state", error);
        }

        if (parsed) {
          if (typeof parsed.textSize === "number") setTextSize(parsed.textSize);
          if (typeof parsed.translationOpacity === "number")
            setTranslationOpacity(parsed.translationOpacity);
          const sessionLang = parseSessionLanguage(parsed.language);
          const sessionLangFrom = parseSessionLanguageFrom(parsed.languageFrom);
          if (sessionLang) setLanguage(sessionLang);
          if (sessionLangFrom) setLanguageFrom(sessionLangFrom);

          if (typeof parsed.activeDocumentId === "string") {
            const savedDoc = await getSavedText(parsed.activeDocumentId).catch(
              (error) => {
                console.error("Failed to restore active document", error);
                setStorageError("Failed to restore the last opened text.");
                return null;
              },
            );
            if (savedDoc) {
              applyDocument(savedDoc);
              return;
            }
          }
        }

        await loadWelcomeDocument();
      } finally {
        hydratedRef.current = true;
      }
    })();
  }, [applyDocument, loadWelcomeDocument, setStorageError]);

  // Persist a lightweight session snapshot (settings + active document id).
  // Skipped until hydration so startup defaults never clobber the stored one.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      if (!hydratedRef.current) return;
      void setValue(SESSION_STATE_KEY, {
        activeDocumentId,
        textSize,
        translationOpacity,
        language,
        languageFrom,
      }).catch((error) => {
        console.error("Failed to save session state", error);
        setStorageError("Failed to save reader settings.");
      });
    }, SESSION_WRITE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    activeDocumentId,
    textSize,
    translationOpacity,
    language,
    languageFrom,
    setStorageError,
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

      const savedTexts = await getSavedTexts().catch(() => [] as SavedText[]);
      const existing = savedTexts.find(
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
          existing.readingProgress ?? 0,
          existing.languageFrom,
          existing.language,
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
    void deleteSavedText(id)
      .then(() => {
        removeSavedFromList(id);
        if (activeDocumentId === id) {
          void loadWelcomeDocument();
        }
      })
      .catch((error) => {
        console.error("Failed to delete saved text", error);
        setStorageError("Failed to delete the saved text.");
      });
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
    knownWordsSet,
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
    storageError,
    clearStorageError,
  };
}
