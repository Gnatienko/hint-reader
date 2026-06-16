"use client";

import { Button } from "antd";
import { FileTextOutlined } from "@ant-design/icons";

type Props = {
  onOpenTexts: () => void;
};

export function ReaderEmptyState({ onOpenTexts }: Props) {
  return (
    <div className="reader-empty">
      <p className="reader-empty-title">No text to read</p>
      <p className="reader-empty-hint">
        Open a .txt file or paste text to start reading.
      </p>
      <Button
        type="primary"
        size="large"
        icon={<FileTextOutlined />}
        onClick={onOpenTexts}
      >
        Open text
      </Button>
    </div>
  );
}
