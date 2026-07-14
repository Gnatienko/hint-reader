import { SAVED_TEXTS_KEY, SavedText } from "../types";

export function getSavedTexts(): SavedText[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_TEXTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Migration: strip legacy wordObjects blobs to free localStorage quota.
    let needsWrite = false;
    const migrated: SavedText[] = parsed.map((item: Record<string, unknown>) => {
      const hasLegacyBlob = "wordObjects" in item;
      const missingWordCount = !("wordCount" in item);

      if (!hasLegacyBlob && !missingWordCount) return item as unknown as SavedText;

      needsWrite = true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { wordObjects: _dropped, ...rest } = item;
      if (missingWordCount) {
        const inputText = typeof rest.inputText === "string" ? rest.inputText : "";
        (rest as Record<string, unknown>).wordCount =
          inputText.trim().split(/\s+/).filter(Boolean).length;
      }
      return rest as unknown as SavedText;
    });

    if (needsWrite) {
      try {
        window.localStorage.setItem(SAVED_TEXTS_KEY, JSON.stringify(migrated));
      } catch {
        // ignore quota errors during migration write
      }
    }

    return migrated;
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

