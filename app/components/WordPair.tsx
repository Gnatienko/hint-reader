import { useLayoutEffect, useRef, useState } from "react";
import {
  getFormattingWhitespaceKind,
  needsTranslation,
} from "../lib/translation";
import type { WordObject } from "../types";

type Props = {
  item: WordObject;
  textSize: number;
  opacity: number;
  isKnown: boolean;
  onToggleKnown: (word: string) => void;
};

const STICKS_TO_PREVIOUS_RE = /^[.,!?;:»)\]]$/u;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Builds the hidden pagination measure pass as a raw HTML string — a
 * layout-only twin of WordPair with the same classes, font size and padding.
 * Translation hints and known-word state are intentionally omitted: the hint
 * is absolutely positioned and known-state only changes cursor/opacity, so
 * neither affects a token's box. Raw HTML (assigned via innerHTML) instead of
 * React elements keeps opening a book with hundreds of thousands of tokens
 * from spending seconds in React reconciliation.
 */
export function buildMeasureHtml(
  words: readonly { word: string }[],
  textSize: number,
): string {
  const wordStyle = `font-size:${textSize}px;padding-top:${textSize * 0.55 * 0.5}px`;
  const parts: string[] = [];
  for (const item of words) {
    const word = item.word;
    const formattingKind = getFormattingWhitespaceKind(word);
    if (formattingKind === "line" || formattingKind === "paragraph") {
      parts.push(
        `<span class="word-format word-format--${formattingKind}" aria-hidden="true"></span>` +
          `<span class="word-format word-format--indent" aria-hidden="true"></span>`,
      );
    } else if (formattingKind) {
      parts.push(
        `<span class="word-format word-format--${formattingKind}" aria-hidden="true"></span>`,
      );
    } else {
      const punctClass = STICKS_TO_PREVIOUS_RE.test(word)
        ? " word-pair--punctuation"
        : "";
      parts.push(
        `<div class="word-pair${punctClass}" style="${wordStyle}">` +
          `<span style="line-height:1.1">${escapeHtml(word)}</span></div>`,
      );
    }
  }
  return parts.join("");
}

export function WordPair({
  item,
  textSize,
  opacity,
  isKnown,
  onToggleKnown,
}: Props) {
  const pairRef = useRef<HTMLDivElement>(null);
  const originalRef = useRef<HTMLSpanElement>(null);
  const [maskStyle, setMaskStyle] = useState<React.CSSProperties>({});

  const shouldReserveTranslationSpace =
    !isKnown && needsTranslation(item.word);
  const showTranslation =
    shouldReserveTranslationSpace && Boolean(item.translation);
  const sticksToPreviousWord = /^[.,!?;:»)\]]$/u.test(item.word);
  const formattingKind = getFormattingWhitespaceKind(item.word);

  useLayoutEffect(() => {
    if (formattingKind || !showTranslation || !pairRef.current || !originalRef.current) {
      return;
    }
    const pairWidth = pairRef.current.offsetWidth;
    const originalWidth = originalRef.current.offsetWidth;
    if (pairWidth <= 0 || originalWidth <= 0) return;
    const right = Math.min(100, (originalWidth / pairWidth) * 100);
    setMaskStyle({
      maskImage: `linear-gradient(to right, rgba(0,0,0,0.99) 0%, rgba(0,0,0,0.99) ${right}%, transparent ${right}%, transparent 100%)`,
      WebkitMaskImage: `linear-gradient(to right, rgba(0,0,0,0.99) 0%, rgba(0,0,0,0.99) ${right}%, transparent ${right}%, transparent 100%)`,
    });
  }, [formattingKind, item.word, item.translation, textSize, showTranslation]);

  if (formattingKind) {
    if (formattingKind === "line") {
      return (
        <>
          <span className="word-format word-format--line" aria-hidden />
          <span className="word-format word-format--indent" aria-hidden />
        </>
      );
    }
    if (formattingKind === "paragraph") {
      return (
        <>
          <span className="word-format word-format--paragraph" aria-hidden />
          <span className="word-format word-format--indent" aria-hidden />
        </>
      );
    }
    return (
      <span
        className={`word-format word-format--${formattingKind}`}
        aria-hidden
      />
    );
  }

  const isClickable = showTranslation || isKnown;

  const handleClick = () => {
    if (!isClickable) return;
    onToggleKnown(item.word);
  };

  const hintLineHeight = textSize * 0.55 * 0.5;

  return (
    <div
      ref={pairRef}
      className={`word-pair${sticksToPreviousWord ? " word-pair--punctuation" : ""}`}
      style={{
        fontSize: textSize,
        paddingTop: hintLineHeight,
      }}
    >
      {shouldReserveTranslationSpace && (
        <span
          className="translation-with-mask"
          style={{
            fontSize: textSize * 0.55,
            opacity: showTranslation ? opacity : 0,
            lineHeight: 1,
            ...(showTranslation ? maskStyle : {}),
          }}
          aria-hidden={!showTranslation}
        >
          {showTranslation ? item.translation : ""}
        </span>
      )}
      <span
        ref={originalRef}
        style={{
          lineHeight: 1.1,
          cursor: isClickable ? "pointer" : "default",
        }}
        onClick={handleClick}
      >
        {item.word}
      </span>
    </div>
  );
}
