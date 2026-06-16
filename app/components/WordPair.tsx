import { useLayoutEffect, useRef, useState } from "react";
import { needsTranslation } from "../lib/translation";
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

  useLayoutEffect(() => {
    if (!showTranslation || !pairRef.current || !originalRef.current) return;
    const pairWidth = pairRef.current.offsetWidth;
    const originalWidth = originalRef.current.offsetWidth;
    if (pairWidth <= 0 || originalWidth <= 0) return;
    const right = Math.min(100, (originalWidth / pairWidth) * 100);
    setMaskStyle({
      maskImage: `linear-gradient(to right, rgba(0,0,0,0.99) 0%, rgba(0,0,0,0.99) ${right}%, transparent ${right}%, transparent 100%)`,
      WebkitMaskImage: `linear-gradient(to right, rgba(0,0,0,0.99) 0%, rgba(0,0,0,0.99) ${right}%, transparent ${right}%, transparent 100%)`,
    });
  }, [item.word, item.translation, textSize, showTranslation]);

  const handleClick = () => {
    if (!showTranslation) return;
    onToggleKnown(item.word);
  };

  const hintLineHeight = textSize * 0.55 * 1.1;

  return (
    <div
      ref={pairRef}
      className="word-pair"
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
          cursor: showTranslation ? "pointer" : "default",
        }}
        onClick={handleClick}
      >
        {item.word}
      </span>
    </div>
  );
}
