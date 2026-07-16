// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WELCOME_DOCUMENT_ID,
  WELCOME_DOCUMENT_NAME,
} from "../lib/defaultText";
import type { SavedText } from "../types";
import { useHintReaderState } from "./useHintReaderState";

vi.mock("../lib/db", () => ({
  getValue: vi.fn(),
  setValue: vi.fn(),
}));
vi.mock("../lib/savedTexts", () => ({
  getSavedText: vi.fn(),
  getSavedTexts: vi.fn(),
  saveSavedText: vi.fn(),
  deleteSavedText: vi.fn(),
}));
vi.mock("../lib/extractBookText", () => ({
  extractTextFromBookFile: vi.fn(),
}));

import { getValue, setValue } from "../lib/db";
import {
  deleteSavedText,
  getSavedText,
  getSavedTexts,
  saveSavedText,
} from "../lib/savedTexts";
import { extractTextFromBookFile } from "../lib/extractBookText";

const getValueMock = vi.mocked(getValue);
const setValueMock = vi.mocked(setValue);
const getSavedTextMock = vi.mocked(getSavedText);
const getSavedTextsMock = vi.mocked(getSavedTexts);
const saveSavedTextMock = vi.mocked(saveSavedText);
const deleteSavedTextMock = vi.mocked(deleteSavedText);
const extractTextFromBookFileMock = vi.mocked(extractTextFromBookFile);

function makeSavedText(overrides: Partial<SavedText>): SavedText {
  return {
    id: "id",
    name: "name",
    createdAt: 0,
    inputText: "text",
    wordCount: 1,
    knownWords: [],
    textSize: 24,
    translationOpacity: 18,
    language: "uk",
    languageFrom: "auto",
    readingProgress: 0,
    ...overrides,
  };
}

let uuidCounter = 0;

beforeEach(() => {
  uuidCounter = 0;
  vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(
    () =>
      `uuid-${uuidCounter++}-0-0-0` as `${string}-${string}-${string}-${string}-${string}`,
  );
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network")));

  getValueMock.mockResolvedValue(undefined);
  setValueMock.mockResolvedValue(undefined);
  getSavedTextMock.mockResolvedValue(null);
  getSavedTextsMock.mockResolvedValue([]);
  saveSavedTextMock.mockResolvedValue(undefined);
  deleteSavedTextMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderReady() {
  const rendered = renderHook(() => useHintReaderState());
  await waitFor(() =>
    expect(rendered.result.current.activeDocumentId).not.toBeNull(),
  );
  return rendered;
}

describe("session restoration", () => {
  it("falls back to the welcome document when there is no saved session", async () => {
    const { result } = await renderReady();

    expect(result.current.activeDocumentId).toBe(WELCOME_DOCUMENT_ID);
    expect(result.current.activeDocumentName).toBe(WELCOME_DOCUMENT_NAME);
    expect(result.current.wordObjects.length).toBeGreaterThan(0);
  });

  it("restores the previously active document referenced by a saved session", async () => {
    const saved = makeSavedText({
      id: "book-1",
      name: "Book One",
      inputText: "hello world",
      knownWords: ["hello"],
      textSize: 32,
      translationOpacity: 50,
      language: "en",
      languageFrom: "es",
      readingProgress: 40,
    });
    getValueMock.mockImplementation(async (key: unknown) => {
      if (key === "session-state") {
        return {
          activeDocumentId: "book-1",
          textSize: 20,
          translationOpacity: 10,
          language: "uk",
          languageFrom: "auto",
        };
      }
      return undefined;
    });
    getSavedTextMock.mockImplementation(async (id: string) =>
      id === "book-1" ? saved : null,
    );

    const { result } = await renderReady();

    expect(result.current.activeDocumentId).toBe("book-1");
    expect(result.current.activeDocumentName).toBe("Book One");
    expect(result.current.textSize).toBe(32);
    expect(result.current.translationOpacity).toBe(50);
    expect(result.current.language).toBe("en");
    expect(result.current.languageFrom).toBe("es");
    expect(result.current.knownWords).toEqual(["hello"]);
    expect(result.current.activeReadingProgress).toBe(40);
  });
});

describe("invalid session settings", () => {
  it("ignores invalid language settings and a non-string document id", async () => {
    getValueMock.mockImplementation(async (key: unknown) => {
      if (key === "session-state") {
        return { language: "xx", languageFrom: "zz", activeDocumentId: 123 };
      }
      return undefined;
    });

    const { result } = await renderReady();

    expect(result.current.activeDocumentId).toBe(WELCOME_DOCUMENT_ID);
    expect(result.current.language).toBe("uk");
    expect(result.current.languageFrom).toBe("auto");
  });
});

describe("opening documents", () => {
  it("opens pasted text as a new document", async () => {
    const { result } = await renderReady();

    act(() => {
      result.current.handleOpenPastedText("Pasted content here");
    });

    expect(result.current.activeDocumentId).not.toBe(WELCOME_DOCUMENT_ID);
    expect(result.current.activeDocumentName).toMatch(/^Pasted text /);
    expect(result.current.wordObjects.map((w) => w.word)).toContain("Pasted");
  });

  it("ignores pasted text that is blank", async () => {
    const { result } = await renderReady();
    const before = result.current.activeDocumentId;

    act(() => {
      result.current.handleOpenPastedText("   ");
    });

    expect(result.current.activeDocumentId).toBe(before);
  });

  it("opens an extracted file as a new document when no matching saved record exists", async () => {
    extractTextFromBookFileMock.mockResolvedValue("Extracted file content");
    const { result } = await renderReady();

    const file = new File(["irrelevant"], "novel.txt", { type: "text/plain" });
    await act(async () => {
      await result.current.handleOpenTextFile(file);
    });

    expect(result.current.activeDocumentName).toBe("novel");
    expect(result.current.activeDocumentId).not.toBe(WELCOME_DOCUMENT_ID);
    expect(result.current.wordObjects.map((w) => w.word)).toContain(
      "Extracted",
    );
  });

  it("reuses settings from a previously imported file with the same source name", async () => {
    const existing = makeSavedText({
      id: "existing-1",
      name: "novel",
      sourceFileName: "novel.txt",
      knownWords: ["extracted"],
      textSize: 40,
      translationOpacity: 60,
      language: "en",
      languageFrom: "bg",
      readingProgress: 77,
    });
    getSavedTextsMock.mockResolvedValue([existing]);
    extractTextFromBookFileMock.mockResolvedValue("Extracted file content");

    const { result } = await renderReady();

    const file = new File(["irrelevant"], "novel.txt", { type: "text/plain" });
    await act(async () => {
      await result.current.handleOpenTextFile(file);
    });

    expect(result.current.activeDocumentId).toBe("existing-1");
    expect(result.current.textSize).toBe(40);
    expect(result.current.translationOpacity).toBe(60);
    expect(result.current.language).toBe("en");
    expect(result.current.languageFrom).toBe("bg");
    expect(result.current.knownWords).toEqual(["extracted"]);
    expect(result.current.activeReadingProgress).toBe(77);
  });
});

describe("saved settings/progress/known words restoration", () => {
  it("restores settings, progress, and known words when loading a saved document", async () => {
    const { result } = await renderReady();

    const saved = makeSavedText({
      id: "saved-1",
      name: "Saved Doc",
      inputText: "known word here",
      knownWords: ["known"],
      textSize: 28,
      translationOpacity: 22,
      language: "en",
      languageFrom: "auto",
      readingProgress: 66,
    });

    act(() => {
      result.current.handleLoadSaved(saved);
    });

    expect(result.current.activeDocumentId).toBe("saved-1");
    expect(result.current.activeDocumentName).toBe("Saved Doc");
    expect(result.current.textSize).toBe(28);
    expect(result.current.translationOpacity).toBe(22);
    expect(result.current.language).toBe("en");
    expect(result.current.knownWords).toEqual(["known"]);
    expect(result.current.activeReadingProgress).toBe(66);
    expect(result.current.wordObjects.map((w) => w.word)).toContain("known");
  });
});

describe("deleting saved documents", () => {
  it("falls back to the welcome document when deleting the active document", async () => {
    const { result } = await renderReady();

    act(() => {
      result.current.handleOpenPastedText("Some content to delete");
    });
    const activeId = result.current.activeDocumentId as string;
    expect(activeId).not.toBe(WELCOME_DOCUMENT_ID);

    await act(async () => {
      result.current.handleDeleteSaved(activeId);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.activeDocumentId).toBe(WELCOME_DOCUMENT_ID),
    );
  });

  it("only removes an inactive document from the saved list, leaving the active document untouched", async () => {
    getSavedTextsMock.mockResolvedValue([
      makeSavedText({ id: "inactive-1", name: "Other" }),
    ]);
    const { result } = await renderReady();

    act(() => {
      result.current.refreshSavedTextsList();
    });
    await waitFor(() => expect(result.current.savedTextsList).toHaveLength(1));

    const activeIdBefore = result.current.activeDocumentId;

    await act(async () => {
      result.current.handleDeleteSaved("inactive-1");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.activeDocumentId).toBe(activeIdBefore);
    await waitFor(() =>
      expect(result.current.savedTextsList).toHaveLength(0),
    );
  });
});

describe("debounced session/document persistence", () => {
  it("saves the session state 300ms after a settings change", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHintReaderState());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.activeDocumentId).toBe(WELCOME_DOCUMENT_ID);

    // Let any session-save effects triggered during hydration settle first.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    setValueMock.mockClear();

    act(() => {
      result.current.setTextSize(99);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(setValueMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(setValueMock).toHaveBeenCalledWith(
      "session-state",
      expect.objectContaining({ textSize: 99 }),
    );
  });

  it("saves the active document 400ms after its known words change", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHintReaderState());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.activeDocumentId).toBe(WELCOME_DOCUMENT_ID);
    saveSavedTextMock.mockClear();

    act(() => {
      result.current.toggleKnownWord("word");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(saveSavedTextMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(saveSavedTextMock).toHaveBeenCalled();
    expect(saveSavedTextMock.mock.calls.at(-1)?.[0]).toMatchObject({
      knownWords: ["word"],
    });
  });
});

describe("file extraction and storage failure paths", () => {
  it("propagates file extraction failures to the caller", async () => {
    extractTextFromBookFileMock.mockRejectedValue(new Error("corrupt file"));
    const { result } = await renderReady();

    const file = new File(["x"], "bad.txt");
    await expect(result.current.handleOpenTextFile(file)).rejects.toThrow(
      "corrupt file",
    );
  });

  it("still opens a new document when listing saved texts fails during file import", async () => {
    getSavedTextsMock.mockRejectedValue(new Error("list failed"));
    extractTextFromBookFileMock.mockResolvedValue("New content here");
    const { result } = await renderReady();

    const file = new File(["x"], "newbook.txt");
    await act(async () => {
      await result.current.handleOpenTextFile(file);
    });

    expect(result.current.activeDocumentName).toBe("newbook");
    expect(result.current.activeDocumentId).not.toBe(WELCOME_DOCUMENT_ID);
  });

  it("sets a storage error and falls back to the welcome document when session restore fails", async () => {
    getValueMock.mockImplementation(async (key: unknown) => {
      if (key === "session-state") return { activeDocumentId: "missing-doc" };
      return undefined;
    });
    getSavedTextMock.mockImplementation(async (id: string) => {
      if (id === "missing-doc") throw new Error("read failed");
      return null;
    });
    // Keep the fallback welcome-document save pending so its success handler
    // doesn't race with (and clear) the restore-failure error being asserted.
    saveSavedTextMock.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useHintReaderState());

    await waitFor(() =>
      expect(result.current.storageError).toBe(
        "Failed to restore the last opened text.",
      ),
    );
    await waitFor(() =>
      expect(result.current.activeDocumentId).toBe(WELCOME_DOCUMENT_ID),
    );
  });

  it("sets a storage error when saving the session state fails", async () => {
    setValueMock.mockRejectedValue(new Error("quota exceeded"));
    // Keep document saves pending so a later successful save can't clear the
    // session-save error being asserted here.
    saveSavedTextMock.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();

    const { result } = renderHook(() => useHintReaderState());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.activeDocumentId).toBe(WELCOME_DOCUMENT_ID);
    expect(result.current.storageError).toBe(
      "Failed to save reader settings.",
    );
  });

  it("surfaces a storage error when saving the active document fails", async () => {
    saveSavedTextMock.mockRejectedValue(new Error("disk full"));
    const { result } = await renderReady();

    act(() => {
      result.current.handleOpenPastedText("Content that fails to persist");
    });

    await waitFor(() =>
      expect(result.current.storageError).toMatch(/^Failed to save/),
    );
  });
});
