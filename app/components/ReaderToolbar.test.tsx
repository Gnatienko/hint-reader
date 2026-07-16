import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReaderToolbar } from "./ReaderToolbar";

describe("ReaderToolbar", () => {
  it("invokes the settings, texts, and known-words handlers", () => {
    const onOpenSettings = vi.fn();
    const onOpenTexts = vi.fn();
    const onOpenKnownWords = vi.fn();

    render(
      <ReaderToolbar
        onOpenSettings={onOpenSettings}
        onOpenTexts={onOpenTexts}
        onOpenKnownWords={onOpenKnownWords}
      />,
    );

    fireEvent.click(screen.getByLabelText("Settings"));
    fireEvent.click(screen.getByLabelText("Texts"));
    fireEvent.click(screen.getByLabelText("Known words"));

    expect(onOpenSettings).toHaveBeenCalled();
    expect(onOpenTexts).toHaveBeenCalled();
    expect(onOpenKnownWords).toHaveBeenCalled();
  });

  it("highlights the Texts button when requested", () => {
    const { container } = render(
      <ReaderToolbar
        onOpenSettings={vi.fn()}
        onOpenTexts={vi.fn()}
        onOpenKnownWords={vi.fn()}
        highlightTexts
      />,
    );

    const textsButton = screen.getByLabelText("Texts");
    expect(
      textsButton.classList.contains("reader-toolbar-btn--highlight"),
    ).toBe(true);
    expect(
      container.querySelectorAll(".reader-toolbar-btn--highlight"),
    ).toHaveLength(1);
  });
});
