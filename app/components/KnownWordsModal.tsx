"use client";

import { Button, Modal, Space, Typography } from "antd";
import type { CefrLevel } from "../cefrWordLists";

const { Paragraph, Text } = Typography;

const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1"];

type Props = {
  open: boolean;
  onClose: () => void;
  knownWords: string[];
  onRemoveKnownWord: (word: string) => void;
  onMarkAllByLevel: (level: CefrLevel) => void;
  onUnmarkAllByLevel: (level: CefrLevel) => void;
  areAllLevelWordsKnown: (level: CefrLevel) => boolean;
};

export function KnownWordsModal({
  open,
  onClose,
  knownWords,
  onRemoveKnownWord,
  onMarkAllByLevel,
  onUnmarkAllByLevel,
  areAllLevelWordsKnown,
}: Props) {
  return (
    <Modal
      title="Known words"
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Text strong>Bulk mark by CEFR level</Text>
          <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 8 }}>
            Quickly add the most common words for a CEFR level to your known
            words list.
          </Paragraph>
          <Space wrap>
            {CEFR_LEVELS.map((level) => {
              const allKnown = areAllLevelWordsKnown(level);
              return (
                <Button
                  key={level}
                  size="small"
                  onClick={() =>
                    allKnown
                      ? onUnmarkAllByLevel(level)
                      : onMarkAllByLevel(level)
                  }
                >
                  {allKnown ? `Unmark all ${level}` : `Mark all ${level}`}
                </Button>
              );
            })}
          </Space>
        </div>

        <div>
          <Text strong>Known words</Text>
          <div className="known-words-list">
            {knownWords.length === 0 ? (
              <Paragraph type="secondary">
                You don&apos;t have any known words yet. Click a word in the
                reading area or use the buttons above.
              </Paragraph>
            ) : (
              <Space size={[8, 8]} wrap>
                {knownWords.map((word) => (
                  <Button
                    key={word}
                    size="small"
                    onClick={() => onRemoveKnownWord(word)}
                  >
                    {word}
                  </Button>
                ))}
              </Space>
            )}
          </div>
        </div>
      </Space>
    </Modal>
  );
}
