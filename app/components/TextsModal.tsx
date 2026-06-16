"use client";

import { useRef, useState } from "react";
import {
  App,
  Button,
  Divider,
  Flex,
  Input,
  Modal,
  Space,
  Typography,
} from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import {
  BOOK_FILE_ACCEPT,
  getFileExtension,
  isSupportedBookExtension,
} from "../lib/bookFormats";
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
  const { message } = App.useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const openFile = async (file: File) => {
    const extension = getFileExtension(file.name);
    if (!isSupportedBookExtension(extension)) {
      message.error("Unsupported file type. Use txt, epub, pdf, docx, fb2, or rtf.");
      return;
    }

    setIsOpeningFile(true);
    try {
      await onOpenTextFile(file);
      onClose();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "Failed to open file",
      );
    } finally {
      setIsOpeningFile(false);
    }
  };

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await openFile(file);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await openFile(file);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={BOOK_FILE_ACCEPT}
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
            <div
              className={`texts-drop-zone${isDragOver ? " texts-drop-zone--active" : ""}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={openFilePicker}
                loading={isOpeningFile}
              >
                Open book
              </Button>
              <Text type="secondary" className="texts-drop-zone-hint">
                Drop a book file here
              </Text>
            </div>

            <Text type="secondary" className="texts-paste-label">
              or Paste text
            </Text>

            <Input.TextArea
              value={pasteInput}
              onChange={(e) => onPasteInputChange(e.target.value)}
              rows={6}
              placeholder="Paste your text here..."
            />
            <Button
              type="primary"
              onClick={onLoadPastedText}
              disabled={!pasteInput.trim()}
              style={{ marginTop: 12 }}
            >
              Load text
            </Button>
          </div>

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
