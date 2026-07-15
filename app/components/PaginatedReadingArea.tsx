"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { buildMeasureHtml, WordPair } from "./WordPair";
import {
  calculateReadingProgress,
  formatProgressDisplay,
  pageFromProgress,
} from "../lib/readingProgress";
import type { WordObject } from "../types";

type Props = {
  wordObjects: WordObject[];
  documentId: string;
  textSize: number;
  opacity: number;
  knownWordsSet: { current: Set<string> };
  translating?: boolean;
  savedProgressPercent?: number;
  onToggleKnown: (word: string) => void;
  onPageChange?: (currentPage: number, pages: number[][]) => void;
};

export function PaginatedReadingArea({
  wordObjects,
  documentId,
  textSize,
  opacity,
  knownWordsSet,
  translating = false,
  savedProgressPercent = 0,
  onToggleKnown,
  onPageChange,
}: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<number[][]>([]);
  const [pagesDocumentKey, setPagesDocumentKey] = useState("");
  // Debounced copy used only for the measurement path — prevents re-rendering
  // thousands of hidden tokens (and running computePages) on every slider tick.
  const [measureTextSize, setMeasureTextSize] = useState(textSize);
  const measureRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);
  const savedProgressRef = useRef(savedProgressPercent);

  useEffect(() => {
    savedProgressRef.current = savedProgressPercent;
  }, [savedProgressPercent]);

  // Debounce text size so the expensive measurement pass (and MeasureArea
  // re-render over all words) only fires after the user stops dragging.
  useEffect(() => {
    const id = setTimeout(() => setMeasureTextSize(textSize), 150);
    return () => clearTimeout(id);
  }, [textSize]);

  const computePages = useCallback(() => {
    const measureEl = measureRef.current;
    const viewportEl = viewportRef.current;
    if (!measureEl || !viewportEl) return;

    const children = Array.from(measureEl.children) as HTMLElement[];
    if (children.length === 0) {
      setPages([]);
      setPagesDocumentKey(documentId);
      return;
    }

    const paginationEl = paginationRef.current;
    const paginatedEl = viewportEl.parentElement;
    const maxHeight =
      paginationEl && paginatedEl
        ? paginatedEl.clientHeight - paginationEl.offsetHeight
        : viewportEl.clientHeight;
    if (maxHeight <= 0) return;

    // Match the visible column width so line breaks in the measure pass
    // match what the viewport renders (absolute measure lives in-viewport).
    measureEl.style.width = `${viewportEl.clientWidth}px`;

    const measureStyle = getComputedStyle(measureEl);
    const fitSlack = (parseFloat(measureStyle.rowGap) || 3) + 4;
    const verticalPadding =
      (parseFloat(measureStyle.paddingTop) || 0) +
      (parseFloat(measureStyle.paddingBottom) || 0);

    // Formatting tokens (line / paragraph) render as two sibling elements
    // in the measure area: a flex-row-breaking span followed by an indent
    // span.  This means measureEl.children can have more entries than
    // wordObjects, so children[i] !== wordObjects[i] whenever a format
    // token appears.  Build a mapping so every child knows its word-object
    // index and whether it is the secondary indent span (which must not be
    // pushed as a separate page entry — the reading area already renders
    // both spans when given the format token's word-object index).
    const childWordObjIndex: number[] = [];
    const childIsSecondary: boolean[] = [];
    let woi = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const prevChild = i > 0 ? children[i - 1] : null;
      const isIndent = child.classList.contains("word-format--indent");
      const prevIsBreaker =
        prevChild !== null &&
        (prevChild.classList.contains("word-format--line") ||
          prevChild.classList.contains("word-format--paragraph"));
      if (isIndent && prevIsBreaker) {
        // Secondary span (indent following a line/paragraph break) —
        // belongs to the same word object as the preceding child.
        childWordObjIndex.push(woi - 1);
        childIsSecondary.push(true);
      } else {
        childWordObjIndex.push(woi++);
        childIsSecondary.push(false);
      }
    }

    // Single-layout pagination. Read every child's box once (no style writes
    // between reads, so the browser lays the document out exactly once),
    // group children into visual lines, then pack whole lines into pages.
    // Because pages always break at line boundaries, a page's words reflow
    // exactly as they did in the full-document layout, so no per-subset
    // re-measurement is needed. (The previous approach toggled display and
    // re-read offsetHeight per token — O(n²) forced reflows that froze the
    // tab for a long time on large books.)
    //
    // The reading area uses align-items: flex-end, so every child in a flex
    // line shares the same bottom edge; a change in bottom marks a new line.
    type Line = { start: number; end: number; top: number; bottom: number };
    const lines: Line[] = [];
    let currentLine: Line | null = null;
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (currentLine && Math.abs(rect.bottom - currentLine.bottom) < 1) {
        currentLine.end = i + 1;
        if (rect.top < currentLine.top) currentLine.top = rect.top;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = { start: i, end: i + 1, top: rect.top, bottom: rect.bottom };
      }
    }
    if (currentLine) lines.push(currentLine);

    const pageContentLimit = maxHeight - fitSlack - verticalPadding;

    const newPages: number[][] = [];
    let page: number[] = [];
    let pageTop = 0;

    for (const line of lines) {
      if (page.length > 0 && line.bottom - pageTop > pageContentLimit) {
        newPages.push(page);
        page = [];
      }
      if (page.length === 0) pageTop = line.top;
      for (let i = line.start; i < line.end; i++) {
        if (!childIsSecondary[i]) {
          page.push(childWordObjIndex[i]);
        }
      }
    }
    if (page.length > 0) newPages.push(page);

    setPages(newPages);
    setPagesDocumentKey(documentId);
  }, [documentId]);

  // Rebuild the hidden measure DOM and repaginate. Layout only depends on
  // token text and font size (translations are absolutely positioned and
  // known-word state never changes a token's box), so the key deliberately
  // ignores translation updates, known-word toggles and opacity changes.
  const measureKeyRef = useRef("");
  useLayoutEffect(() => {
    const measureEl = measureRef.current;
    if (!measureEl) return;
    const key = `${documentId}:${wordObjects.length}:${measureTextSize}`;
    if (measureKeyRef.current === key) return;
    measureKeyRef.current = key;
    measureEl.innerHTML = buildMeasureHtml(wordObjects, measureTextSize);
    // Measure layout before paint; setState here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement pagination
    computePages();
  }, [documentId, wordObjects, measureTextSize, computePages]);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    const paginationEl = paginationRef.current;
    if (!viewportEl) return;

    const observer = new ResizeObserver(() => computePages());
    observer.observe(viewportEl);
    if (paginationEl) observer.observe(paginationEl);
    return () => observer.disconnect();
  }, [computePages]);

  const pagesAreCurrent = pagesDocumentKey === documentId;
  const pageRestoreKey = `${documentId}:${pages.length}:${textSize}`;

  useEffect(() => {
    if (!pagesAreCurrent || pages.length === 0) return;
    const page = pageFromProgress(savedProgressRef.current, pages.length);
    setCurrentPage(page);
  }, [pageRestoreKey, pagesAreCurrent, pages.length]);

  useEffect(() => {
    if (pages.length > 0 && currentPage >= pages.length) {
      // Defer to avoid "setState synchronously within an effect" lint rule.
      queueMicrotask(() => setCurrentPage(pages.length - 1));
    }
  }, [pages, currentPage]);

  useEffect(() => {
    if (!pagesAreCurrent || pages.length === 0 || !onPageChange) return;
    onPageChange(currentPage, pages);
  }, [currentPage, pages, onPageChange, pagesAreCurrent]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (pages.length <= 1) return;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        setCurrentPage((page) => Math.min(page + 1, pages.length - 1));
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setCurrentPage((page) => Math.max(page - 1, 0));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pages.length]);

  const pageIndices = pagesAreCurrent ? (pages[currentPage] ?? []) : [];
  const totalPages = pagesAreCurrent ? Math.max(pages.length, 1) : 1;
  const progressLabel = formatProgressDisplay(
    pagesAreCurrent && pages.length > 0
      ? calculateReadingProgress(currentPage, pages.length)
      : savedProgressPercent,
  );

  return (
    <div className="reading-paginated">
      <div ref={viewportRef} className="reading-page-viewport">
        <div className="reading-area">
          {pageIndices.map((index) => {
            const item = wordObjects[index];
            if (!item) return null;
            return (
              <WordPair
                key={`${item.word}-${index}`}
                item={item}
                textSize={textSize}
                opacity={opacity}
                isKnown={knownWordsSet.current.has(item.word.toLowerCase())}
                onToggleKnown={onToggleKnown}
              />
            );
          })}
        </div>

        {/* Hidden measure pass; populated imperatively via buildMeasureHtml. */}
        <div
          ref={measureRef}
          className="reading-area reading-area-measure"
          aria-hidden
        />
      </div>

      <div ref={paginationRef} className="reading-pagination">
        <Button
          type="text"
          icon={<LeftOutlined />}
          className="reading-pagination-btn"
          disabled={currentPage === 0}
          aria-label="Previous page"
          onClick={() => setCurrentPage((page) => Math.max(page - 1, 0))}
        />
        <span className="reading-pagination-label">
          {currentPage + 1} / {totalPages} · {progressLabel}%
          {translating ? " · …" : ""}
        </span>
        <Button
          type="text"
          icon={<RightOutlined />}
          className="reading-pagination-btn"
          disabled={!pagesAreCurrent || currentPage >= pages.length - 1}
          aria-label="Next page"
          onClick={() =>
            setCurrentPage((page) => Math.min(page + 1, pages.length - 1))
          }
        />
      </div>
    </div>
  );
}
