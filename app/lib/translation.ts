import { Language, LanguageFrom, WordObject } from "../types";

export async function translateWord(
  word: string,
  languageFrom: LanguageFrom,
  language: Language,
): Promise<string> {
  if (!word.trim()) return "";

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
    return typeof first === "string" ? first : "";
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

export function needsTranslation(word: string): boolean {
  return !isPunctuationToken(word) && !isFormattingWhitespaceToken(word);
}

