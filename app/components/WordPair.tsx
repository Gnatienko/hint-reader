import { useLayoutEffect, useRef, useState } from "react";
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

  useLayoutEffect(() => {
    if (!item.translation || !pairRef.current || !originalRef.current) return;
    const pairWidth = pairRef.current.offsetWidth;
    const originalWidth = originalRef.current.offsetWidth;
    if (pairWidth <= 0 || originalWidth <= 0) return;
    const right = Math.min(100, (originalWidth / pairWidth) * 100);
    setMaskStyle({
      maskImage: `linear-gradient(to right, rgba(0,0,0,0.99) 0%, rgba(0,0,0,0.99) ${right}%, transparent ${right}%, transparent 100%)`,
      WebkitMaskImage: `linear-gradient(to right, rgba(0,0,0,0.99) 0%, rgba(0,0,0,0.99) ${right}%, transparent ${right}%, transparent 100%)`,
    });
  }, [item.word, item.translation, textSize]);

  const handleClick = () => {
    if (!item.translation) return;
    onToggleKnown(item.word);
  };

  return (
    <div ref={pairRef} className="word-pair" style={{ fontSize: textSize }}>
      {item.translation && !isKnown && (
        <span
          className="translation-with-mask"
          style={{
            fontSize: textSize * 0.55,
            opacity,
            lineHeight: 1.1,
            ...maskStyle,
          }}
        >
          {item.translation}
        </span>
      )}
      <span
        ref={originalRef}
        style={{
          lineHeight: 1.2,
          cursor: item.translation ? "pointer" : "default",
        }}
        onClick={handleClick}
      >
        {item.word}
      </span>
    </div>
  );
}

