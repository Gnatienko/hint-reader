import { Language, LanguageFrom, WordObject } from "../types";

const TRANSLATION_DICTIONARY_KEY = "hint-reader-translation-dictionary";

type TranslationDictionary = Record<string, string>;

const translationDictionary: TranslationDictionary = {};
let translationDictionaryLoaded = false;

function getDictionaryKey(
  word: string,
  languageFrom: LanguageFrom,
  language: Language,
): string {
  return `${languageFrom}:${language}:${word.trim().toLowerCase()}`;
}

function ensureTranslationDictionaryLoaded(): void {
  if (translationDictionaryLoaded || typeof window === "undefined") return;
  translationDictionaryLoaded = true;
  try {
    const raw = window.localStorage.getItem(TRANSLATION_DICTIONARY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return;
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        translationDictionary[key] = value;
      }
    }
  } catch {
    // ignore invalid dictionary payloads
  }
}

function persistTranslationDictionary(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      TRANSLATION_DICTIONARY_KEY,
      JSON.stringify(translationDictionary),
    );
  } catch {
    // ignore write errors
  }
}

export async function translateWord(
  word: string,
  languageFrom: LanguageFrom,
  language: Language,
): Promise<string> {
  if (!word.trim()) return "";
  ensureTranslationDictionaryLoaded();

  const dictionaryKey = getDictionaryKey(word, languageFrom, language);
  const cached = translationDictionary[dictionaryKey];
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
      translationDictionary[dictionaryKey] = first;
      persistTranslationDictionary();
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
 * dictionary, eliminating the need to persist wordObjects per document.
 */
export function buildWordObjectsFromDictionary(
  text: string,
  languageFrom: LanguageFrom,
  language: Language,
): WordObject[] {
  ensureTranslationDictionaryLoaded();
  return tokenize(text).map((word) => ({
    word,
    translation:
      translationDictionary[getDictionaryKey(word, languageFrom, language)] ??
      "",
  }));
}

export function needsTranslation(word: string): boolean {
  return !isPunctuationToken(word) && !isFormattingWhitespaceToken(word);
}

