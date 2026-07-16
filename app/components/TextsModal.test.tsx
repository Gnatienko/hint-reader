import { createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SavedText } from "../types";
import { renderWithApp } from "../test/render";
import { TextsModal } from "./TextsModal";

function makeSavedText(overrides: Partial<SavedText> = {}): SavedText {
  return {
    id: "saved-1",
    name: "My book",
    createdAt: Date.parse("2026-07-16T12:00:00Z"),
    inputText: "hello world",
    wordCount: 2,
    knownWords: [],
    textSize: 24,
    translationOpacity: 18,
    language: "uk",
    languageFrom: "auto",
    readingProgress: 50,
    ...overrides,
  };
}

function renderModal(
  overrides: Partial<ComponentProps<typeof TextsModal>> = {},
) {
  const props = {
    open: true,
    onClose: vi.fn(),
    pasteInput: "",
    onPasteInputChange: vi.fn(),
    savedTexts: [] as SavedText[],
    onLoadPastedText: vi.fn(),
    onOpenTextFile: vi.fn().mockResolvedValue(undefined),
    onOpenSaved: vi.fn(),
    onDeleteSaved: vi.fn(),
    ...overrides,
  };
  const view = renderWithApp(<TextsModal {...props} />);
  return { ...view, props };
}

describe("TextsModal", () => {
  it("shows the empty saved-texts state and disables Load text when paste is empty", () => {
    renderModal();

    expect(screen.getByText("No saved texts yet.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Load text" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("updates paste input and loads pasted text", () => {
    const { props } = renderModal({ pasteInput: "  hello  " });

    fireEvent.change(screen.getByPlaceholderText("Paste your text here..."), {
      target: { value: "new paste" },
    });
    expect(props.onPasteInputChange).toHaveBeenCalledWith("new paste");

    fireEvent.click(screen.getByRole("button", { name: "Load text" }));
    expect(props.onLoadPastedText).toHaveBeenCalled();
  });

  it("lists saved texts and wires Open / Delete actions", () => {
    const saved = makeSavedText();
    const { props } = renderModal({ savedTexts: [saved] });

    expect(screen.getByText("My book")).toBeTruthy();
    expect(screen.getByText(/2 words/)).toBeTruthy();
    expect(screen.getByText(/50\.00%/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(props.onOpenSaved).toHaveBeenCalledWith(saved);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(props.onDeleteSaved).toHaveBeenCalledWith("saved-1");
  });

  it("rejects unsupported file types", async () => {
    const { props } = renderModal();
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["x"], "notes.csv", { type: "text/csv" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(/Unsupported file type/i),
      ).toBeTruthy();
    });
    expect(props.onOpenTextFile).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("opens a supported file and closes the modal on success", async () => {
    const { props } = renderModal();
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["hello"], "book.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(props.onOpenTextFile).toHaveBeenCalledWith(file);
      expect(props.onClose).toHaveBeenCalled();
    });
  });

  it("surfaces open-file errors from the handler", async () => {
    const { props } = renderModal({
      onOpenTextFile: vi.fn().mockRejectedValue(new Error("Corrupt epub")),
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["x"], "book.epub", {
      type: "application/epub+zip",
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Corrupt epub")).toBeTruthy();
    });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("surfaces a generic error when open-file rejects with a non-Error", async () => {
    renderModal({
      onOpenTextFile: vi.fn().mockRejectedValue("nope"),
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["x"], "book.txt", { type: "text/plain" })] },
    });

    await waitFor(() => {
      expect(screen.getByText("Failed to open file")).toBeTruthy();
    });
  });

  it("opens the file picker from the Open book button", () => {
    renderModal();
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.click(screen.getByRole("button", { name: /Open book/i }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("highlights the drop zone on drag and opens a dropped file", async () => {
    const { props } = renderModal();
    const dropZone = document.querySelector(".texts-drop-zone") as HTMLElement;
    const file = new File(["hello"], "dropped.txt", { type: "text/plain" });

    fireEvent.dragOver(dropZone);
    expect(dropZone.classList.contains("texts-drop-zone--active")).toBe(true);

    fireEvent.dragLeave(dropZone);
    expect(dropZone.classList.contains("texts-drop-zone--active")).toBe(false);

    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => {
      expect(props.onOpenTextFile).toHaveBeenCalledWith(file);
      expect(props.onClose).toHaveBeenCalled();
    });
  });

  it("ignores dragLeave when the pointer moves into a child", () => {
    renderModal();
    const dropZone = document.querySelector(".texts-drop-zone") as HTMLElement;
    const child = dropZone.querySelector("button") as HTMLElement;

    fireEvent.dragOver(dropZone);
    expect(dropZone.classList.contains("texts-drop-zone--active")).toBe(true);

    const leave = createEvent.dragLeave(dropZone);
    Object.defineProperty(leave, "relatedTarget", {
      configurable: true,
      value: child,
    });
    fireEvent(dropZone, leave);
    expect(dropZone.classList.contains("texts-drop-zone--active")).toBe(true);
  });

  it("calls onClose when the modal is cancelled", () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
