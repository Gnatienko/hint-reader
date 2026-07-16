import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WordPair, buildMeasureHtml } from "./WordPair";

describe("buildMeasureHtml", () => {
  it("escapes HTML-sensitive token text", () => {
    const html = buildMeasureHtml(
      [{ word: "<script>alert('xss')</script> & text" }],
      24,
    );

    expect(html).toContain(
      "&lt;script&gt;alert('xss')&lt;/script&gt; &amp; text",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
  });

  it("still emits trusted measurement markup around escaped text", () => {
    const html = buildMeasureHtml([{ word: "A > B" }], 20);

    expect(html).toContain('class="word-pair"');
    expect(html).toContain("A &gt; B");
  });
});

describe("WordPair", () => {
  it("renders formatting tokens as aria-hidden structure spans", () => {
    const { container } = render(
      <WordPair
        item={{ word: "\n", translation: "" }}
        textSize={24}
        opacity={0.5}
        isKnown={false}
        onToggleKnown={vi.fn()}
      />,
    );

    expect(container.querySelector(".word-format--line")).toBeTruthy();
    expect(container.querySelector(".word-format--indent")).toBeTruthy();
    expect(
      container.querySelectorAll("[aria-hidden]").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("shows a translation hint and toggles known on click", () => {
    const onToggleKnown = vi.fn();
    const { container } = render(
      <WordPair
        item={{ word: "hello", translation: "hola" }}
        textSize={24}
        opacity={0.4}
        isKnown={false}
        onToggleKnown={onToggleKnown}
      />,
    );

    const view = within(container);
    expect(view.getByText("hola")).toBeTruthy();
    fireEvent.click(view.getByText("hello"));
    expect(onToggleKnown).toHaveBeenCalledWith("hello");
  });

  it("reserves translation space without showing text when still translating", () => {
    const onToggleKnown = vi.fn();
    const { container } = render(
      <WordPair
        item={{ word: "hello", translation: "" }}
        textSize={24}
        opacity={0.4}
        isKnown={false}
        onToggleKnown={onToggleKnown}
      />,
    );

    const hint = container.querySelector(".translation-with-mask") as HTMLElement;
    expect(hint).toBeTruthy();
    expect(hint.textContent).toBe("");
    expect(hint.style.opacity).toBe("0");

    fireEvent.click(within(container).getByText("hello"));
    expect(onToggleKnown).not.toHaveBeenCalled();
  });

  it("hides the translation for known words but stays clickable", () => {
    const onToggleKnown = vi.fn();
    const { container } = render(
      <WordPair
        item={{ word: "hello", translation: "hola" }}
        textSize={24}
        opacity={0.4}
        isKnown
        onToggleKnown={onToggleKnown}
      />,
    );

    expect(container.querySelector(".translation-with-mask")).toBeNull();
    fireEvent.click(within(container).getByText("hello"));
    expect(onToggleKnown).toHaveBeenCalledWith("hello");
  });

  it("marks punctuation and does not toggle known on click", () => {
    const onToggleKnown = vi.fn();
    const { container } = render(
      <WordPair
        item={{ word: ",", translation: "" }}
        textSize={24}
        opacity={0.4}
        isKnown={false}
        onToggleKnown={onToggleKnown}
      />,
    );

    expect(container.querySelector(".word-pair--punctuation")).toBeTruthy();
    fireEvent.click(within(container).getByText(","));
    expect(onToggleKnown).not.toHaveBeenCalled();
  });
});
