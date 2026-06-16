export type LanguageFrom = "auto" | "es" | "en" | "bg";

export type Language = "en" | "uk";

export type WordObject = {
  word: string;
  translation: string;
};

export type SavedText = {
  id: string;
  name: string;
  sourceFileName?: string;
  createdAt: number;
  inputText: string;
  wordObjects: WordObject[];
  knownWords: string[];
  textSize: number;
  translationOpacity: number;
  language: Language;
  languageFrom: LanguageFrom;
};

export const SAVED_TEXTS_KEY = "hint-reader-saved-texts";

