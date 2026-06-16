import { SAVED_TEXTS_KEY, SavedText } from "../types";

export function getSavedTexts(): SavedText[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_TEXTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSavedText(item: SavedText): void {
  const list = getSavedTexts();
  const without = list.filter((s) => s.id !== item.id);
  without.unshift(item);
  try {
    window.localStorage.setItem(SAVED_TEXTS_KEY, JSON.stringify(without));
  } catch {
    // ignore
  }
}

export function deleteSavedText(id: string): void {
  const list = getSavedTexts().filter((s) => s.id !== id);
  try {
    window.localStorage.setItem(SAVED_TEXTS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

