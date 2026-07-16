import { fireEvent, render, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WordObject } from "../types";
import { PaginatedReadingArea } from "./PaginatedReadingArea";

function words(...tokens: string[]): WordObject[] {
  return tokens.map((word) => ({ word, translation: word === "," ? "" : "t" }));
}

function stubPaginationGeometry(lineHeight = 100) {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      if (this.classList.contains("reading-paginated")) return 440;
      if (this.classList.contains("reading-page-viewport")) return 400;
      return 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      if (
        this.classList.contains("reading-page-viewport") ||
        this.classList.contains("reading-area-measure")
      ) {
        return 320;
      }
      return 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      if (this.classList.contains("reading-pagination")) return 40;
      return 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const measure = this.closest(".reading-area-measure");
      if (!measure) {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        };
      }
      const index = Array.from(measure.children).indexOf(this);
      const top = Math.max(0, index) * lineHeight;
      return {
        x: 0,
        y: top,
        top,
        left: 0,
        bottom: top + lineHeight,
        right: 100,
        width: 100,
        height: lineHeight,
        toJSON: () => ({}),
      };
    },
  );
}

function renderArea(
  wordObjects: WordObject[],
  overrides: Partial<ComponentProps<typeof PaginatedReadingArea>> = {},
) {
  const knownWordsSet = { current: new Set<string>() };
  const onToggleKnown = vi.fn();
  const onPageChange = vi.fn();

  const view = render(
    <PaginatedReadingArea
      wordObjects={wordObjects}
      documentId="doc-1"
      textSize={24}
      opacity={0.4}
      knownWordsSet={knownWordsSet}
      onToggleKnown={onToggleKnown}
      onPageChange={onPageChange}
      {...overrides}
    />,
  );

  const page = () =>
    view.container.querySelector(
      ".reading-area:not(.reading-area-measure)",
    ) as HTMLElement;
  const chrome = () =>
    view.container.querySelector(".reading-pagination") as HTMLElement;

  return { ...view, knownWordsSet, onToggleKnown, onPageChange, page, chrome };
}

describe("PaginatedReadingArea", () => {
  beforeEach(() => {
    stubPaginationGeometry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("paginates tokens across pages and navigates with the next/prev controls", async () => {
    // 6 lines × 100px with ~393px page budget → 3 tokens/page, 2 pages.
    const { page, chrome } = renderArea(
      words("one", "two", "three", "four", "five", "six"),
    );

    await waitFor(() => {
      expect(within(chrome()).getByText(/1 \/ 2/)).toBeTruthy();
    });

    expect(within(page()).getByText("one")).toBeTruthy();
    expect(within(page()).queryByText("four")).toBeNull();

    fireEvent.click(within(chrome()).getByLabelText("Next page"));

    await waitFor(() => {
      expect(within(chrome()).getByText(/2 \/ 2/)).toBeTruthy();
    });
    expect(within(page()).getByText("four")).toBeTruthy();
    expect(within(page()).queryByText("one")).toBeNull();

    fireEvent.click(within(chrome()).getByLabelText("Previous page"));

    await waitFor(() => {
      expect(within(chrome()).getByText(/1 \/ 2/)).toBeTruthy();
    });
    expect(within(page()).getByText("one")).toBeTruthy();
  });

  it("navigates pages with arrow keys", async () => {
    const { chrome } = renderArea(
      words("one", "two", "three", "four", "five", "six"),
    );

    await waitFor(() => {
      expect(within(chrome()).getByText(/1 \/ 2/)).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => {
      expect(within(chrome()).getByText(/2 \/ 2/)).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(within(chrome()).getByText(/1 \/ 2/)).toBeTruthy();
    });
  });

  it("restores the page from saved progress and reports page changes", async () => {
    const { chrome, onPageChange } = renderArea(
      words("one", "two", "three", "four", "five", "six"),
      { savedProgressPercent: 100 },
    );

    await waitFor(() => {
      expect(within(chrome()).getByText(/2 \/ 2/)).toBeTruthy();
    });
    expect(onPageChange).toHaveBeenCalled();
    const [, pages] = onPageChange.mock.calls.at(-1)!;
    expect(pages).toHaveLength(2);
  });

  it("shows the translating indicator in the pagination label", async () => {
    const { chrome } = renderArea(
      words("one", "two", "three", "four", "five", "six"),
      { translating: true },
    );

    await waitFor(() => {
      expect(within(chrome()).getByText(/· …/)).toBeTruthy();
    });
  });

  it("maps formatting break tokens without duplicating indent children as page entries", async () => {
    const { page, chrome } = renderArea([
      { word: "Hello", translation: "Hola" },
      { word: "\n", translation: "" },
      { word: "world", translation: "mundo" },
      { word: "again", translation: "otra" },
      { word: "more", translation: "mas" },
      { word: "text", translation: "texto" },
      { word: "here", translation: "aqui" },
    ]);

    await waitFor(() => {
      expect(within(chrome()).getByText(/\/ \d+/)).toBeTruthy();
    });

    expect(within(page()).getByText("Hello")).toBeTruthy();
  });
});
