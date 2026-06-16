"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { WordPair } from "./WordPair";
import type { WordObject } from "../types";

type Props = {
  wordObjects: WordObject[];
  textSize: number;
  opacity: number;
  knownWords: string[];
  translating?: boolean;
  onToggleKnown: (word: string) => void;
  onPageChange?: (currentPage: number, pages: number[][]) => void;
};

export function PaginatedReadingArea({
  wordObjects,
  textSize,
  opacity,
  knownWords,
  translating = false,
  onToggleKnown,
  onPageChange,
}: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<number[][]>([]);
  const measureRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const documentKey = useMemo(
    () => wordObjects.map((item) => item.word).join("\u0000"),
    [wordObjects],
  );

  const computePages = useCallback(() => {
    const measureEl = measureRef.current;
    const viewportEl = viewportRef.current;
    if (!measureEl || !viewportEl) return;

    const children = measureEl.children;
    if (children.length === 0) {
      setPages([]);
      return;
    }

    const pageHeight = viewportEl.clientHeight;
    if (pageHeight <= 0) return;

    const newPages: number[][] = [[]];
    let pageStartTop = (children[0] as HTMLElement).offsetTop;

    for (let i = 0; i < children.length; i++) {
      const el = children[i] as HTMLElement;
      const top = el.offsetTop;

      if (
        top >= pageStartTop + pageHeight &&
        newPages[newPages.length - 1].length > 0
      ) {
        newPages.push([]);
        pageStartTop = top;
      }

      newPages[newPages.length - 1].push(i);
    }

    setPages(newPages);
  }, []);

  useLayoutEffect(() => {
    computePages();
  }, [documentKey, textSize, opacity, knownWords, computePages]);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const observer = new ResizeObserver(() => computePages());
    observer.observe(viewportEl);
    return () => observer.disconnect();
  }, [computePages]);

  useEffect(() => {
    setCurrentPage(0);
  }, [documentKey, textSize]);

  useEffect(() => {
    if (pages.length > 0 && currentPage >= pages.length) {
      setCurrentPage(pages.length - 1);
    }
  }, [pages, currentPage]);

  useEffect(() => {
    if (pages.length === 0 || !onPageChange) return;
    onPageChange(currentPage, pages);
  }, [currentPage, pages, onPageChange]);

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

  const pageIndices = pages[currentPage] ?? [];
  const totalPages = Math.max(pages.length, 1);

  return (
    <div className="reading-paginated">
      <div ref={viewportRef} className="reading-page-viewport">
        <div className="reading-area">
          {pageIndices.map((index) => {
            const item = wordObjects[index];
            return (
              <WordPair
                key={`${item.word}-${index}`}
                item={item}
                textSize={textSize}
                opacity={opacity}
                isKnown={knownWords.includes(item.word.toLowerCase())}
                onToggleKnown={onToggleKnown}
              />
            );
          })}
        </div>
      </div>

      <div
        ref={measureRef}
        className="reading-area reading-area-measure"
        aria-hidden
      >
        {wordObjects.map((item, index) => (
          <WordPair
            key={`measure-${item.word}-${index}`}
            item={item}
            textSize={textSize}
            opacity={opacity}
            isKnown={knownWords.includes(item.word.toLowerCase())}
            onToggleKnown={onToggleKnown}
          />
        ))}
      </div>

      <div className="reading-pagination">
        <Button
          type="text"
          icon={<LeftOutlined />}
          className="reading-pagination-btn"
          disabled={currentPage === 0}
          aria-label="Previous page"
          onClick={() => setCurrentPage((page) => Math.max(page - 1, 0))}
        />
        <span className="reading-pagination-label">
          {currentPage + 1} / {totalPages}
          {translating ? " · …" : ""}
        </span>
        <Button
          type="text"
          icon={<RightOutlined />}
          className="reading-pagination-btn"
          disabled={currentPage >= pages.length - 1}
          aria-label="Next page"
          onClick={() =>
            setCurrentPage((page) => Math.min(page + 1, pages.length - 1))
          }
        />
      </div>
    </div>
  );
}
