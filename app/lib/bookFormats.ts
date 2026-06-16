export const SUPPORTED_BOOK_EXTENSIONS = [
  "txt",
  "epub",
  "pdf",
  "docx",
  "fb2",
  "rtf",
] as const;

export type SupportedBookExtension = (typeof SUPPORTED_BOOK_EXTENSIONS)[number];

export const BOOK_FILE_ACCEPT = [
  ".txt",
  ".epub",
  ".pdf",
  ".docx",
  ".fb2",
  ".rtf",
  "text/plain",
  "application/epub+zip",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-fictionbook+xml",
  "application/rtf",
  "text/rtf",
].join(",");

export function getFileExtension(fileName: string): string {
  const match = fileName.match(/\.([^.]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

export function isSupportedBookExtension(
  extension: string,
): extension is SupportedBookExtension {
  return SUPPORTED_BOOK_EXTENSIONS.includes(extension as SupportedBookExtension);
}

export function getDisplayNameFromFileName(fileName: string): string {
  const extension = getFileExtension(fileName);
  if (!extension) return fileName;
  return fileName.slice(0, -(extension.length + 1)) || fileName;
}
