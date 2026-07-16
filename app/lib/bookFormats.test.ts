import { describe, expect, it } from "vitest";
import {
  getDisplayNameFromFileName,
  getFileExtension,
  isSupportedBookExtension,
} from "./bookFormats";

describe("book file extensions", () => {
  it("extracts and normalizes the final extension", () => {
    expect(getFileExtension("Novel.EPUB")).toBe("epub");
    expect(getFileExtension("archive.book.PDF")).toBe("pdf");
  });

  it("returns an empty extension for names without one", () => {
    expect(getFileExtension("README")).toBe("");
    expect(getFileExtension("book.")).toBe("");
  });

  it("recognizes every supported extension case-sensitively after parsing", () => {
    for (const extension of ["txt", "epub", "pdf", "docx", "fb2", "rtf"]) {
      expect(isSupportedBookExtension(extension)).toBe(true);
    }
    expect(isSupportedBookExtension("mobi")).toBe(false);
    expect(isSupportedBookExtension("PDF")).toBe(false);
  });

  it("removes only the final extension from display names", () => {
    expect(getDisplayNameFromFileName("archive.book.epub")).toBe("archive.book");
    expect(getDisplayNameFromFileName("README")).toBe("README");
  });
});
