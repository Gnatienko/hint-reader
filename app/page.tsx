/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import {
  Typography,
  Input,
  Button,
  Slider,
  Radio,
  Space,
  ConfigProvider,
  theme,
  Flex,
  Modal,
  Tooltip,
  Divider,
} from "antd";
import {
  SettingOutlined,
  BookOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import { CefrLevel } from "./cefrWordLists";
import { PaginatedReadingArea } from "./components/PaginatedReadingArea";
import { useHintReaderState } from "./hooks/useHintReaderState";
import type { Language, LanguageFrom } from "./types";

const { Paragraph, Text } = Typography;

export default function Home() {
  const [isReaderSettingsOpen, setIsReaderSettingsOpen] = useState(false);
  const [isTextsModalOpen, setIsTextsModalOpen] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    wordObjects,
    textSize,
    setTextSize,
    translationOpacity,
    setTranslationOpacity,
    language,
    setLanguage,
    languageFrom,
    setLanguageFrom,
    translating,
    knownWords,
    toggleKnownWord,
    removeKnownWord,
    markAllWordsByLevel,
    unmarkAllWordsByLevel,
    areAllLevelWordsKnown,
    isSettingsOpen,
    setIsSettingsOpen,
    savedTextsList,
    refreshSavedTextsList,
    handleOpenTextFile,
    handleOpenPastedText,
    handleLoadSaved,
    handleDeleteSaved,
    handlePageChange,
  } = useHintReaderState();

  const opacity = Math.max(1, Math.min(30, translationOpacity)) / 100;

  const openTextsModal = () => {
    refreshSavedTextsList();
    setIsTextsModalOpen(true);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await handleOpenTextFile(file);
    setPasteInput("");
    setIsTextsModalOpen(false);
  };

  const onLoadPastedText = () => {
    handleOpenPastedText(pasteInput);
    setPasteInput("");
    setIsTextsModalOpen(false);
  };

  const onOpenSaved = (saved: Parameters<typeof handleLoadSaved>[0]) => {
    handleLoadSaved(saved);
    setIsTextsModalOpen(false);
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#8b6914",
          borderRadius: 10,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        },
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        hidden
        onChange={onFileSelected}
      />

      <div className="reader-shell">
        <div className="reader-toolbar">
          <Tooltip title="Settings">
            <Button
              type="text"
              shape="circle"
              icon={<SettingOutlined />}
              className="reader-toolbar-btn"
              aria-label="Settings"
              onClick={() => setIsReaderSettingsOpen(true)}
            />
          </Tooltip>
          <Tooltip title="Texts">
            <Button
              type="text"
              shape="circle"
              icon={<FolderOpenOutlined />}
              className="reader-toolbar-btn"
              aria-label="Texts"
              onClick={openTextsModal}
            />
          </Tooltip>
          <Tooltip title="Known words">
            <Button
              type="text"
              shape="circle"
              icon={<BookOutlined />}
              className="reader-toolbar-btn"
              aria-label="Known words"
              onClick={() => setIsSettingsOpen(true)}
            />
          </Tooltip>
        </div>

        <main className="reader-main">
          <div className="reader-content">
            {wordObjects.length === 0 ? (
              <div className="reader-empty">
                <p className="reader-empty-title">No text to read</p>
                <p className="reader-empty-hint">
                  Open a .txt file or paste text to start reading.
                </p>
                <Button
                  type="primary"
                  size="large"
                  icon={<FileTextOutlined />}
                  onClick={openTextsModal}
                >
                  Open text
                </Button>
              </div>
            ) : (
              <PaginatedReadingArea
                wordObjects={wordObjects}
                textSize={textSize}
                opacity={opacity}
                knownWords={knownWords}
                translating={translating}
                onToggleKnown={toggleKnownWord}
                onPageChange={handlePageChange}
              />
            )}
          </div>
        </main>

        <Modal
          title="Texts"
          open={isTextsModalOpen}
          onCancel={() => setIsTextsModalOpen(false)}
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
                onChange={(e) => setPasteInput(e.target.value)}
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
              {savedTextsList.length === 0 ? (
                <Paragraph type="secondary">No saved texts yet.</Paragraph>
              ) : (
                <Space orientation="vertical" size="small" style={{ width: "100%" }}>
                  {savedTextsList.map((saved) => (
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
                          onClick={() => handleDeleteSaved(saved.id)}
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

        <Modal
          title="Settings"
          open={isReaderSettingsOpen}
          onCancel={() => setIsReaderSettingsOpen(false)}
          footer={null}
          width={640}
          destroyOnHidden
        >
          <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <Flex gap={24} wrap>
              <div style={{ flex: 1, minWidth: 240 }}>
                <Text strong>Original language</Text>
                <Radio.Group
                  style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}
                  value={languageFrom}
                  onChange={(e) =>
                    setLanguageFrom(e.target.value as LanguageFrom)
                  }
                >
                  <Radio.Button value="auto">Auto-detect</Radio.Button>
                  <Radio.Button value="en">English</Radio.Button>
                  <Radio.Button value="es">Español</Radio.Button>
                  <Radio.Button value="bg">Bulgarian</Radio.Button>
                </Radio.Group>
              </div>

              <div style={{ flex: 1, minWidth: 240 }}>
                <Text strong>Translation language</Text>
                <Radio.Group
                  style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                >
                  <Radio.Button value="en">English</Radio.Button>
                  <Radio.Button value="uk">Українська</Radio.Button>
                </Radio.Group>
              </div>
            </Flex>

            <Flex gap={24} wrap>
              <div style={{ flex: 1, minWidth: 240 }}>
                <Text strong>Text size</Text>
                <Slider
                  style={{ marginTop: 8 }}
                  min={15}
                  max={50}
                  value={textSize}
                  onChange={(value) => setTextSize(value as number)}
                />
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <Text strong>Translation opacity</Text>
                <Slider
                  style={{ marginTop: 8 }}
                  min={1}
                  max={30}
                  value={translationOpacity}
                  onChange={(value) =>
                    setTranslationOpacity(value as number)
                  }
                />
              </div>
            </Flex>

            <Text type="secondary" style={{ fontSize: 12 }}>
              Translation is performed via an unofficial HTTP interface to Google
              Translate. Only nearby pages are translated while you read.
            </Text>
          </Space>
        </Modal>

        <Modal
          title="Known words"
          open={isSettingsOpen}
          onCancel={() => setIsSettingsOpen(false)}
          footer={null}
        >
          <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <div>
              <Text strong>Bulk mark by CEFR level</Text>
              <Paragraph
                type="secondary"
                style={{ marginTop: 4, marginBottom: 8 }}
              >
                Quickly add the most common words for a CEFR level to your
                known words list.
              </Paragraph>
              <Space wrap>
                {(["A1", "A2", "B1", "B2", "C1"] as CefrLevel[]).map(
                  (level) => {
                    const allKnown = areAllLevelWordsKnown(level);
                    return (
                      <Button
                        key={level}
                        size="small"
                        onClick={() =>
                          allKnown
                            ? unmarkAllWordsByLevel(level)
                            : markAllWordsByLevel(level)
                        }
                      >
                        {allKnown
                          ? `Unmark all ${level}`
                          : `Mark all ${level}`}
                      </Button>
                    );
                  },
                )}
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
                        onClick={() => removeKnownWord(word)}
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
      </div>
    </ConfigProvider>
  );
}
