"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { WordPair } from "./WordPair";
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
  knownWords: string[];
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
  knownWords,
  knownWordsSet,
  translating = false,
  savedProgressPercent = 0,
  onToggleKnown,
  onPageChange,
}: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<number[][]>([]);
  const [pagesDocumentKey, setPagesDocumentKey] = useState("");
  const measureRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);
  const savedProgressRef = useRef(savedProgressPercent);

  useEffect(() => {
    savedProgressRef.current = savedProgressPercent;
  }, [savedProgressPercent]);

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

    const fitSlack =
      (parseFloat(getComputedStyle(measureEl).rowGap) || 3) + 4;

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

    // Each page renders only a word subset that reflows from the top, so
    // pagination must measure those subsets — not global positions in the
    // full-document layout (line breaks differ after a page split).
    const hideAll = () => {
      for (const child of children) {
        child.style.display = "none";
      }
    };

    hideAll();

    const newPages: number[][] = [];
    let index = 0;

    while (index < children.length) {
      const page: number[] = [];
      hideAll();

      while (index < children.length) {
        children[index].style.display = "";
        const contentHeight = measureEl.offsetHeight;

        if (contentHeight > maxHeight - fitSlack && page.length > 0) {
          children[index].style.display = "none";
          break;
        }

        if (!childIsSecondary[index]) {
          page.push(childWordObjIndex[index]);
        }
        index++;
      }

      if (page.length === 0 && index < children.length) {
        children[index].style.display = "";
        if (!childIsSecondary[index]) {
          page.push(childWordObjIndex[index]);
        }
        index++;
      }

      newPages.push(page);
    }

    hideAll();
    for (const child of children) {
      child.style.display = "";
    }

    setPages(newPages);
    setPagesDocumentKey(documentId);
  }, [documentId]);

  useLayoutEffect(() => {
    // Measure layout before paint; setState here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement pagination
    computePages();
  }, [documentId, textSize, opacity, knownWords, computePages]);

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

        <div
          ref={measureRef}
          className="reading-area reading-area-measure"
          aria-hidden
        >
          {wordObjects.map((item, index) => {
            if (!item) return null;
            return (
              <WordPair
                key={`measure-${item.word}-${index}`}
                item={item}
                textSize={textSize}
                opacity={opacity}
                isKnown={knownWordsSet.current.has(item.word.toLowerCase())}
                onToggleKnown={onToggleKnown}
              />
            );
          })}
        </div>
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
