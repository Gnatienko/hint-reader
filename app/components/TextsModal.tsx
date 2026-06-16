"use client";

import { useRef } from "react";
import {
  Button,
  Divider,
  Flex,
  Input,
  Modal,
  Space,
  Typography,
} from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import type { SavedText } from "../types";

const { Paragraph, Text } = Typography;

type Props = {
  open: boolean;
  onClose: () => void;
  pasteInput: string;
  onPasteInputChange: (value: string) => void;
  savedTexts: SavedText[];
  onLoadPastedText: () => void;
  onOpenTextFile: (file: File) => Promise<void>;
  onOpenSaved: (saved: SavedText) => void;
  onDeleteSaved: (id: string) => void;
};

export function TextsModal({
  open,
  onClose,
  pasteInput,
  onPasteInputChange,
  savedTexts,
  onLoadPastedText,
  onOpenTextFile,
  onOpenSaved,
  onDeleteSaved,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await onOpenTextFile(file);
    onClose();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        hidden
        onChange={onFileSelected}
      />

      <Modal
        title="Texts"
        open={open}
        onCancel={onClose}
        footer={null}
        width={640}
        destroyOnHidden
      >
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Text strong>Paste text</Text>
            <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 8 }}>
              Paste a text to read. It will be saved automatically. Translations
              load page by page as you read.
            </Paragraph>
            <Input.TextArea
              value={pasteInput}
              onChange={(e) => onPasteInputChange(e.target.value)}
              rows={6}
              placeholder="Paste your text here..."
            />
          </div>

          <Flex gap={12} wrap>
            <Button
              type="primary"
              onClick={onLoadPastedText}
              disabled={!pasteInput.trim()}
            >
              Load text
            </Button>
            <Button icon={<FileTextOutlined />} onClick={openFilePicker}>
              Open .txt file
            </Button>
          </Flex>

          <Divider style={{ margin: 0 }} />

          <div>
            <Text strong>Saved texts</Text>
            <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 12 }}>
              Open a previously saved text. Current reading progress will be
              replaced.
            </Paragraph>
            {savedTexts.length === 0 ? (
              <Paragraph type="secondary">No saved texts yet.</Paragraph>
            ) : (
              <Space orientation="vertical" size="small" style={{ width: "100%" }}>
                {savedTexts.map((saved) => (
                  <Flex
                    key={saved.id}
                    align="center"
                    justify="space-between"
                    className="saved-text-row"
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong>{saved.name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(saved.createdAt).toLocaleString()} ·{" "}
                        {saved.wordObjects.length} words
                      </Text>
                    </div>
                    <Space>
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => onOpenSaved(saved)}
                      >
                        Open
                      </Button>
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={() => onDeleteSaved(saved.id)}
                      >
                        Delete
                      </Button>
                    </Space>
                  </Flex>
                ))}
              </Space>
            )}
          </div>
        </Space>
      </Modal>
    </>
  );
}
