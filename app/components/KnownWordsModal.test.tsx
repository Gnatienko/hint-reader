import { fireEvent, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithApp } from "../test/render";
import { KnownWordsModal } from "./KnownWordsModal";

function renderModal(
  overrides: Partial<ComponentProps<typeof KnownWordsModal>> = {},
) {
  const props = {
    open: true,
    onClose: vi.fn(),
    knownWords: [] as string[],
    onRemoveKnownWord: vi.fn(),
    onMarkAllByLevel: vi.fn(),
    onUnmarkAllByLevel: vi.fn(),
    areAllLevelWordsKnown: vi.fn(() => false),
    ...overrides,
  };
  const view = renderWithApp(<KnownWordsModal {...props} />);
  return { ...view, props };
}

describe("KnownWordsModal", () => {
  it("shows the empty known-words message", () => {
    renderModal();
    expect(
      screen.getByText(/You don't have any known words yet/i),
    ).toBeTruthy();
  });

  it("lists known words and removes one on click", () => {
    const { props } = renderModal({ knownWords: ["hello", "world"] });

    fireEvent.click(screen.getByRole("button", { name: "hello" }));
    expect(props.onRemoveKnownWord).toHaveBeenCalledWith("hello");
  });

  it("marks a CEFR level when not all words are known", () => {
    const { props } = renderModal({
      areAllLevelWordsKnown: vi.fn((level) => level === "A2"),
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark all A1" }));
    expect(props.onMarkAllByLevel).toHaveBeenCalledWith("A1");

    fireEvent.click(screen.getByRole("button", { name: "Unmark all A2" }));
    expect(props.onUnmarkAllByLevel).toHaveBeenCalledWith("A2");
  });

  it("calls onClose when cancelled", () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
