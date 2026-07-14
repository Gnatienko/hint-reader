"use client";

import { useState } from "react";
import { KnownWordsModal } from "./components/KnownWordsModal";
import { PaginatedReadingArea } from "./components/PaginatedReadingArea";
import { ReaderEmptyState } from "./components/ReaderEmptyState";
import { ReaderSettingsModal } from "./components/ReaderSettingsModal";
import { ReaderThemeProvider } from "./components/ReaderThemeProvider";
import { ReaderToolbar } from "./components/ReaderToolbar";
import { TextsModal } from "./components/TextsModal";
import { useHintReaderState } from "./hooks/useHintReaderState";
import { WELCOME_DOCUMENT_ID } from "./lib/defaultText";
import type { SavedText } from "./types";

export default function Home() {
  const [isReaderSettingsOpen, setIsReaderSettingsOpen] = useState(false);
  const [isTextsModalOpen, setIsTextsModalOpen] = useState(false);
  const [pasteInput, setPasteInput] = useState("");

  const {
    wordObjects,
    activeDocumentId,
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
    knownWordsSet,
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
    activeReadingProgress,
  } = useHintReaderState();

  const opacity = Math.max(1, Math.min(30, translationOpacity)) / 100;
  const hasText = wordObjects.length > 0;
  const isWelcomeDocument = activeDocumentId === WELCOME_DOCUMENT_ID;

  const openTextsModal = () => {
    refreshSavedTextsList();
    setIsTextsModalOpen(true);
  };

  const closeTextsModal = () => {
    setIsTextsModalOpen(false);
  };

  const onLoadPastedText = () => {
    handleOpenPastedText(pasteInput);
    setPasteInput("");
    closeTextsModal();
  };

  const onOpenSaved = (saved: SavedText) => {
    handleLoadSaved(saved);
    closeTextsModal();
  };

  const onOpenTextFile = async (file: File) => {
    await handleOpenTextFile(file);
    setPasteInput("");
  };

  return (
    <ReaderThemeProvider>
      <div className="reader-shell">
        <ReaderToolbar
          onOpenSettings={() => setIsReaderSettingsOpen(true)}
          onOpenTexts={openTextsModal}
          onOpenKnownWords={() => setIsSettingsOpen(true)}
          highlightTexts={isWelcomeDocument}
        />

        <main className="reader-main">
          <div className="reader-content">
            {hasText ? (
              <PaginatedReadingArea
                wordObjects={wordObjects}
                documentId={activeDocumentId ?? ""}
                textSize={textSize}
                opacity={opacity}
                knownWords={knownWords}
                knownWordsSet={knownWordsSet}
                translating={translating}
                savedProgressPercent={activeReadingProgress}
                onToggleKnown={toggleKnownWord}
                onPageChange={handlePageChange}
              />
            ) : (
              <ReaderEmptyState />
            )}
          </div>
        </main>

        <TextsModal
          open={isTextsModalOpen}
          onClose={closeTextsModal}
          pasteInput={pasteInput}
          onPasteInputChange={setPasteInput}
          savedTexts={savedTextsList}
          onLoadPastedText={onLoadPastedText}
          onOpenTextFile={onOpenTextFile}
          onOpenSaved={onOpenSaved}
          onDeleteSaved={handleDeleteSaved}
        />

        <ReaderSettingsModal
          open={isReaderSettingsOpen}
          onClose={() => setIsReaderSettingsOpen(false)}
          languageFrom={languageFrom}
          onLanguageFromChange={setLanguageFrom}
          language={language}
          onLanguageChange={setLanguage}
          textSize={textSize}
          onTextSizeChange={setTextSize}
          translationOpacity={translationOpacity}
          onTranslationOpacityChange={setTranslationOpacity}
        />

        <KnownWordsModal
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          knownWords={knownWords}
          onRemoveKnownWord={removeKnownWord}
          onMarkAllByLevel={markAllWordsByLevel}
          onUnmarkAllByLevel={unmarkAllWordsByLevel}
          areAllLevelWordsKnown={areAllLevelWordsKnown}
        />
      </div>
    </ReaderThemeProvider>
  );
}
