import { getValue, setValue } from "./db";
import { Language, LanguageFrom, WordObject } from "../types";

const TRANSLATION_DICTIONARY_KEY = "translation-dictionary";

/** Hard cap on cached translations; oldest (least recently used) are evicted. */
const MAX_DICTIONARY_ENTRIES = 10000;
const PERSIST_DEBOUNCE_MS = 1000;

// Map iteration order doubles as LRU order: re-inserting a key on use moves
// it to the end, so eviction always removes the least recently used entry.
const translationDictionary = new Map<string, string>();
let loadPromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function getDictionaryKey(
  word: string,
  languageFrom: LanguageFrom,
  language: Language,
): string {
  return `${languageFrom}:${language}:${word.trim().toLowerCase()}`;
}

/**
 * Loads the persisted dictionary from IndexedDB into memory. Callers that
 * rely on the synchronous in-memory cache (buildWordObjectsFromDictionary)
 * should await this first; repeated calls reuse the same promise.
 */
export function loadTranslationDictionary(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!loadPromise) {
    window.addEventListener("pagehide", flushTranslationDictionary);
    loadPromise = getValue(TRANSLATION_DICTIONARY_KEY)
      .then((parsed) => {
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === "string") {
            translationDictionary.set(key, value);
          }
        }
        evictOverflow();
      })
      .catch(() => {
        // Cache only: start empty when storage is unavailable.
      });
  }
  return loadPromise;
}

function evictOverflow(): void {
  while (translationDictionary.size > MAX_DICTIONARY_ENTRIES) {
    const oldest = translationDictionary.keys().next().value;
    if (oldest === undefined) break;
    translationDictionary.delete(oldest);
  }
}

function getCachedTranslation(key: string): string | undefined {
  const value = translationDictionary.get(key);
  if (value !== undefined) {
    translationDictionary.delete(key);
    translationDictionary.set(key, value);
  }
  return value;
}

function setCachedTranslation(key: string, value: string): void {
  translationDictionary.delete(key);
  translationDictionary.set(key, value);
  evictOverflow();
  schedulePersist();
}

function schedulePersist(): void {
  if (typeof window === "undefined" || persistTimer !== null) return;
  persistTimer = setTimeout(flushTranslationDictionary, PERSIST_DEBOUNCE_MS);
}

function flushTranslationDictionary(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (typeof window === "undefined") return;
  void setValue(
    TRANSLATION_DICTIONARY_KEY,
    Object.fromEntries(translationDictionary),
  ).catch(() => {
    // Cache only: a failed write just costs re-fetches later.
  });
}

export async function translateWord(
  word: string,
  languageFrom: LanguageFrom,
  language: Language,
): Promise<string> {
  if (!word.trim()) return "";
  await loadTranslationDictionary();

  const dictionaryKey = getDictionaryKey(word, languageFrom, language);
  const cached = getCachedTranslation(dictionaryKey);
  if (typeof cached === "string") {
    return cached;
  }

  const params = new URLSearchParams({
    client: "gtx",
    sl: languageFrom,
    tl: language,
    dt: "t",
    q: word,
  });

  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
    );
    const data = await res.json();
    const first = data?.[0]?.[0]?.[0];
    if (typeof first === "string") {
      setCachedTranslation(dictionaryKey, first);
      return first;
    }
    return "";
  } catch {
    return "";
  }
}

export function tokenize(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split(/(\s+|[.,!?;:"()«»—–-])/u)
    .filter(
      (token) =>
        token !== "" &&
        (!/^\s+$/u.test(token) || keepsFormattingWhitespace(token)),
    );
}

const PUNCTUATION_RE = /^[.,!?;:"()«»—–-]$/u;

export function isPunctuationToken(token: string): boolean {
  return PUNCTUATION_RE.test(token);
}

function keepsFormattingWhitespace(token: string): boolean {
  return /[\n\t]/u.test(token);
}

export function isFormattingWhitespaceToken(token: string): boolean {
  return /^\s+$/u.test(token) && keepsFormattingWhitespace(token);
}

export type FormattingWhitespaceKind = "line" | "paragraph" | "tab";

export function getFormattingWhitespaceKind(
  token: string,
): FormattingWhitespaceKind | null {
  if (!isFormattingWhitespaceToken(token)) return null;
  if (/^\t+$/u.test(token)) return "tab";
  if (/\n\s*\n/u.test(token)) return "paragraph";
  if (/\n/u.test(token)) return "line";
  return null;
}

export function buildWordObjectsFromText(text: string): WordObject[] {
  return tokenize(text).map((word) => ({
    word,
    translation: "",
  }));
}

/**
 * Like buildWordObjectsFromText but pre-fills translations from the in-memory
 * dictionary. Await loadTranslationDictionary() beforehand so the cache is
 * populated; otherwise the hints start empty and fill in via translateWord.
 */
export function buildWordObjectsFromDictionary(
  text: string,
  languageFrom: LanguageFrom,
  language: Language,
): WordObject[] {
  return tokenize(text).map((word) => ({
    word,
    translation:
      translationDictionary.get(getDictionaryKey(word, languageFrom, language)) ??
      "",
  }));
}

export function needsTranslation(word: string): boolean {
  return !isPunctuationToken(word) && !isFormattingWhitespaceToken(word);
}

