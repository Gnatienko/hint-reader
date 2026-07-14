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

  const hintLineHeight = textSize * 0.55 * 1.1;

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
            lineHeight: 1.1,
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
          lineHeight: 1.2,
          cursor: isClickable ? "pointer" : "default",
        }}
        onClick={handleClick}
      >
        {item.word}
      </span>
    </div>
  );
}
