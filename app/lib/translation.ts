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
    .filter((t) => t !== "" && !/^\s+$/u.test(t));
}

const PUNCTUATION_RE = /^[.,!?;:"()«»—–-]$/u;

export function isPunctuationToken(token: string): boolean {
  return PUNCTUATION_RE.test(token);
}

export function buildWordObjectsFromText(text: string): WordObject[] {
  return tokenize(text).map((word) => ({
    word,
    translation: isPunctuationToken(word) ? "" : "",
  }));
}

export function needsTranslation(word: string): boolean {
  return !isPunctuationToken(word);
}

