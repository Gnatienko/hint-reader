// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SavedText } from "../types";
import { useDocumentPersistence } from "./useDocumentPersistence";

vi.mock("../lib/savedTexts", () => ({
  getSavedText: vi.fn(),
  getSavedTexts: vi.fn(),
  saveSavedText: vi.fn(),
}));

import { getSavedText, getSavedTexts, saveSavedText } from "../lib/savedTexts";

const getSavedTextMock = vi.mocked(getSavedText);
const getSavedTextsMock = vi.mocked(getSavedTexts);
const saveSavedTextMock = vi.mocked(saveSavedText);

function makeSavedText(overrides: Partial<SavedText>): SavedText {
  return {
    id: "id",
    name: "name",
    createdAt: 0,
    inputText: "",
    wordCount: 0,
    knownWords: [],
    textSize: 24,
    translationOpacity: 18,
    language: "uk",
    languageFrom: "auto",
    readingProgress: 0,
    ...overrides,
  };
}

function setup(
  textSize = 24,
  translationOpacity = 18,
  language: SavedText["language"] = "uk",
  languageFrom: SavedText["languageFrom"] = "auto",
) {
  return renderHook(() =>
    useDocumentPersistence(textSize, translationOpacity, language, languageFrom),
  );
}

describe("useDocumentPersistence", () => {
  afterEach(() => {
    getSavedTextMock.mockReset();
    getSavedTextsMock.mockReset();
    saveSavedTextMock.mockReset();
  });

  it("creates a snapshot with a computed word count and the current settings", async () => {
    getSavedTextMock.mockResolvedValue(null);
    saveSavedTextMock.mockResolvedValue(undefined);

    const { result } = setup(30, 40, "en", "es");

    act(() => {
      result.current.persistDocument(
        "doc-1",
        "My Doc",
        "my-doc.txt",
        "one two three",
        ["one"],
        50,
      );
    });

    await waitFor(() => expect(saveSavedTextMock).toHaveBeenCalledTimes(1));

    const snapshot = saveSavedTextMock.mock.calls[0][0];
    expect(snapshot).toMatchObject({
      id: "doc-1",
      name: "My Doc",
      sourceFileName: "my-doc.txt",
      inputText: "one two three",
      wordCount: 3,
      knownWords: ["one"],
      textSize: 30,
      translationOpacity: 40,
      language: "en",
      languageFrom: "es",
      readingProgress: 50,
    });
    expect(typeof snapshot.createdAt).toBe("number");
    expect(result.current.storageError).toBeNull();
  });

  it("preserves the createdAt of an existing record instead of using the current time", async () => {
    getSavedTextMock.mockResolvedValue(
      makeSavedText({ id: "doc-2", createdAt: 500 }),
    );
    saveSavedTextMock.mockResolvedValue(undefined);

    const { result } = setup();

    act(() => {
      result.current.persistDocument("doc-2", "Existing", null, "new text", [], 10);
    });

    await waitFor(() => expect(saveSavedTextMock).toHaveBeenCalledTimes(1));
    expect(saveSavedTextMock.mock.calls[0][0].createdAt).toBe(500);
  });

  it("keeps writes ordered even when an earlier save resolves slowly", async () => {
    const events: string[] = [];
    let resolveFirst: (() => void) | undefined;

    getSavedTextMock.mockImplementationOnce(() => {
      events.push("start-1");
      return new Promise((resolve) => {
        resolveFirst = () => {
          events.push("resolve-1");
          resolve(null);
        };
      });
    });
    getSavedTextMock.mockImplementationOnce(async () => {
      events.push("start-2");
      return null;
    });
    saveSavedTextMock.mockImplementation(async (snapshot: SavedText) => {
      events.push(`save-${snapshot.id}`);
    });

    const { result } = setup();

    act(() => {
      result.current.persistDocument("doc-1", "Doc1", null, "a", [], 0);
      result.current.persistDocument("doc-2", "Doc2", null, "b", [], 0);
    });

    await waitFor(() => expect(events).toContain("start-1"));
    expect(events).not.toContain("start-2");

    resolveFirst?.();

    await waitFor(() =>
      expect(events).toEqual([
        "start-1",
        "resolve-1",
        "save-doc-1",
        "start-2",
        "save-doc-2",
      ]),
    );
  });

  it("surfaces a storage error message when saving fails", async () => {
    getSavedTextMock.mockResolvedValue(null);
    saveSavedTextMock.mockRejectedValue(new Error("disk full"));

    const { result } = setup();

    act(() => {
      result.current.persistDocument("doc-3", "My Doc", null, "text", [], 0);
    });

    await waitFor(() =>
      expect(result.current.storageError).toBe(
        'Failed to save "My Doc". Your reading progress and known words may be lost when you close this tab.',
      ),
    );
  });

  it("surfaces a storage error message when loading the saved list fails", async () => {
    getSavedTextsMock.mockRejectedValue(new Error("offline"));
    const { result } = setup();

    act(() => {
      result.current.refreshSavedTextsList();
    });

    await waitFor(() =>
      expect(result.current.storageError).toBe(
        "Failed to load saved texts from storage.",
      ),
    );
  });

  it("clears the storage error on demand", async () => {
    getSavedTextsMock.mockRejectedValue(new Error("offline"));
    const { result } = setup();

    act(() => {
      result.current.refreshSavedTextsList();
    });
    await waitFor(() => expect(result.current.storageError).not.toBeNull());

    act(() => {
      result.current.clearStorageError();
    });

    expect(result.current.storageError).toBeNull();
  });

  it("refreshes the saved texts list on success", async () => {
    const list = [makeSavedText({ id: "a", name: "A" })];
    getSavedTextsMock.mockResolvedValue(list);
    const { result } = setup();

    act(() => {
      result.current.refreshSavedTextsList();
    });

    await waitFor(() => expect(result.current.savedTextsList).toEqual(list));
  });

  it("removes a saved record from the local list", async () => {
    const list = [
      makeSavedText({ id: "a", name: "A" }),
      makeSavedText({ id: "b", name: "B" }),
    ];
    getSavedTextsMock.mockResolvedValue(list);
    const { result } = setup();

    act(() => {
      result.current.refreshSavedTextsList();
    });
    await waitFor(() => expect(result.current.savedTextsList).toHaveLength(2));

    act(() => {
      result.current.removeSavedFromList("a");
    });

    expect(result.current.savedTextsList).toEqual([list[1]]);
  });
});
