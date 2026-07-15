import {
  SAVED_TEXTS_STORE,
  openDb,
  requestToPromise,
  transactionDone,
} from "./db";
import type { SavedText } from "../types";

const VALID_LANGUAGES = ["en", "uk"] as const;
const VALID_LANGUAGES_FROM = ["auto", "es", "en", "bg"] as const;

/**
 * Validates an unknown value as a SavedText record, filling safe defaults for
 * optional/secondary fields. Returns null when essential fields are missing.
 */
export function parseSavedText(value: unknown): SavedText | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== "string" ||
    v.id === "" ||
    typeof v.name !== "string" ||
    typeof v.inputText !== "string"
  ) {
    return null;
  }

  const inputText = v.inputText;
  return {
    id: v.id,
    name: v.name,
    sourceFileName:
      typeof v.sourceFileName === "string" ? v.sourceFileName : undefined,
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
    inputText,
    wordCount:
      typeof v.wordCount === "number"
        ? v.wordCount
        : inputText.trim().split(/\s+/).filter(Boolean).length,
    knownWords: Array.isArray(v.knownWords)
      ? v.knownWords.filter((w): w is string => typeof w === "string")
      : [],
    textSize: typeof v.textSize === "number" ? v.textSize : 24,
    translationOpacity:
      typeof v.translationOpacity === "number" ? v.translationOpacity : 18,
    language: VALID_LANGUAGES.includes(v.language as never)
      ? (v.language as SavedText["language"])
      : "uk",
    languageFrom: VALID_LANGUAGES_FROM.includes(v.languageFrom as never)
      ? (v.languageFrom as SavedText["languageFrom"])
      : "auto",
    readingProgress:
      typeof v.readingProgress === "number" ? v.readingProgress : 0,
  };
}

/** Returns all saved texts, newest first. Throws when storage is unavailable. */
export async function getSavedTexts(): Promise<SavedText[]> {
  const db = await openDb();
  const tx = db.transaction(SAVED_TEXTS_STORE, "readonly");
  const records = await requestToPromise(tx.objectStore(SAVED_TEXTS_STORE).getAll());
  return (records as unknown[])
    .map(parseSavedText)
    .filter((item): item is SavedText => item !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Returns a single saved text by id, or null when absent/invalid. */
export async function getSavedText(id: string): Promise<SavedText | null> {
  const db = await openDb();
  const tx = db.transaction(SAVED_TEXTS_STORE, "readonly");
  const record = await requestToPromise(tx.objectStore(SAVED_TEXTS_STORE).get(id));
  return parseSavedText(record);
}

/** Persists a saved text. Throws on failure so callers can surface it. */
export async function saveSavedText(item: SavedText): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SAVED_TEXTS_STORE, "readwrite");
  tx.objectStore(SAVED_TEXTS_STORE).put(item);
  await transactionDone(tx);
}

/** Deletes a saved text by id. Throws on failure so callers can surface it. */
export async function deleteSavedText(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SAVED_TEXTS_STORE, "readwrite");
  tx.objectStore(SAVED_TEXTS_STORE).delete(id);
  await transactionDone(tx);
}
