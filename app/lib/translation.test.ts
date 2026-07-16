import { describe, expect, it } from "vitest";
import {
  getFormattingWhitespaceKind,
  isFormattingWhitespaceToken,
  isPunctuationToken,
  needsTranslation,
  tokenize,
} from "./translation";

describe("tokenize", () => {
  it("separates words and punctuation while discarding ordinary spaces", () => {
    expect(tokenize("Hello, world! How are you?")).toEqual([
      "Hello",
      ",",
      "world",
      "!",
      "How",
      "are",
      "you",
      "?",
    ]);
  });

  it("preserves newlines and tabs used for document formatting", () => {
    expect(tokenize("First\nSecond\tThird")).toEqual([
      "First",
      "\n",
      "Second",
      "\t",
      "Third",
    ]);
  });

  it("handles empty and whitespace-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("token classification", () => {
  it("identifies punctuation and formatting whitespace", () => {
    expect(isPunctuationToken("—")).toBe(true);
    expect(isPunctuationToken("word")).toBe(false);
    expect(isFormattingWhitespaceToken("\n")).toBe(true);
    expect(isFormattingWhitespaceToken(" ")).toBe(false);
  });

  it("classifies line, paragraph, and tab formatting", () => {
    expect(getFormattingWhitespaceKind("\n")).toBe("line");
    expect(getFormattingWhitespaceKind("\n \n")).toBe("paragraph");
    expect(getFormattingWhitespaceKind("\t\t")).toBe("tab");
    expect(getFormattingWhitespaceKind(" ")).toBeNull();
  });

  it("only requests translations for word tokens", () => {
    expect(needsTranslation("hola")).toBe(true);
    expect(needsTranslation(".")).toBe(false);
    expect(needsTranslation("\n")).toBe(false);
  });
});
