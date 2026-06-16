import {
  getFileExtension,
  isSupportedBookExtension,
  SUPPORTED_BOOK_EXTENSIONS,
} from "./bookFormats";

let pdfWorkerConfigured = false;

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blockSelector = "p, h1, h2, h3, h4, h5, h6, li, blockquote, pre";
  const blocks = Array.from(doc.querySelectorAll(blockSelector));

  if (blocks.length > 0) {
    return blocks
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n");
  }

  return doc.body?.textContent?.trim() ?? "";
}

function resolveArchivePath(basePath: string, relativePath: string): string {
  if (!basePath) return relativePath;
  if (relativePath.startsWith("/")) {
    return relativePath.slice(1);
  }

  const baseParts = basePath.split("/").slice(0, -1);
  const relativeParts = relativePath.split("/");

  for (const part of relativeParts) {
    if (part === "..") {
      baseParts.pop();
    } else if (part !== ".") {
      baseParts.push(part);
    }
  }

  return baseParts.join("/");
}

async function extractFromEpub(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerXml) {
    throw new Error("Invalid EPUB: missing container.xml");
  }

  const containerDoc = new DOMParser().parseFromString(
    containerXml,
    "application/xml",
  );
  const rootFilePath =
    containerDoc
      .querySelector("rootfile")
      ?.getAttribute("full-path")
      ?.trim() ?? "";
  if (!rootFilePath) {
    throw new Error("Invalid EPUB: missing package file");
  }

  const opfXml = await zip.file(rootFilePath)?.async("text");
  if (!opfXml) {
    throw new Error("Invalid EPUB: missing package content");
  }

  const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");
  const manifestItems = new Map<string, { href: string; mediaType: string }>();

  for (const item of Array.from(opfDoc.querySelectorAll("manifest > item"))) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type") ?? "";
    if (id && href) {
      manifestItems.set(id, { href, mediaType });
    }
  }

  const spineIds = Array.from(opfDoc.querySelectorAll("spine > itemref"))
    .map((item) => item.getAttribute("idref"))
    .filter((id): id is string => Boolean(id));

  const opfBasePath = rootFilePath.includes("/")
    ? rootFilePath.slice(0, rootFilePath.lastIndexOf("/"))
    : "";

  const chapters: string[] = [];
  for (const id of spineIds) {
    const manifestItem = manifestItems.get(id);
    if (!manifestItem) continue;

    const chapterPath = resolveArchivePath(opfBasePath, manifestItem.href);
    const chapterFile = zip.file(chapterPath);
    if (!chapterFile) continue;

    const chapterContent = await chapterFile.async("text");
    const chapterText = manifestItem.mediaType.includes("html")
      ? htmlToText(chapterContent)
      : chapterContent.trim();

    if (chapterText) {
      chapters.push(chapterText);
    }
  }

  if (chapters.length === 0) {
    throw new Error("Could not extract text from EPUB");
  }

  return normalizeExtractedText(chapters.join("\n\n"));
}

async function extractFromPdf(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");

  if (!pdfWorkerConfigured) {
    GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    pdfWorkerConfigured = true;
  }

  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  if (pages.length === 0) {
    throw new Error("Could not extract text from PDF");
  }

  return normalizeExtractedText(pages.join("\n\n"));
}

async function extractFromDocx(file: File): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });

  if (!result.value.trim()) {
    throw new Error("Could not extract text from DOCX");
  }

  return normalizeExtractedText(result.value);
}

async function extractFromFb2(file: File): Promise<string> {
  const xml = await file.text();
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid FB2 file");
  }

  const paragraphs = Array.from(doc.querySelectorAll("p"))
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean);

  const text =
    paragraphs.length > 0
      ? paragraphs.join("\n\n")
      : (doc.documentElement?.textContent?.trim() ?? "");

  if (!text) {
    throw new Error("Could not extract text from FB2");
  }

  return normalizeExtractedText(text);
}

async function extractFromRtf(file: File): Promise<string> {
  const raw = await file.text();
  const text = raw
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\line\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\[a-z]+\d*(?:\s)?/gi, "")
    .replace(/[{}]/g, "")
    .trim();

  if (!text) {
    throw new Error("Could not extract text from RTF");
  }

  return normalizeExtractedText(text);
}

export async function extractTextFromBookFile(file: File): Promise<string> {
  const extension = getFileExtension(file.name);

  if (!isSupportedBookExtension(extension)) {
    throw new Error(
      `Unsupported file format. Supported formats: ${SUPPORTED_BOOK_EXTENSIONS.join(", ")}`,
    );
  }

  let text: string;
  switch (extension) {
    case "txt":
      text = await file.text();
      break;
    case "epub":
      text = await extractFromEpub(file);
      break;
    case "pdf":
      text = await extractFromPdf(file);
      break;
    case "docx":
      text = await extractFromDocx(file);
      break;
    case "fb2":
      text = await extractFromFb2(file);
      break;
    case "rtf":
      text = await extractFromRtf(file);
      break;
  }

  if (!text.trim()) {
    throw new Error("The selected file does not contain readable text");
  }

  return normalizeExtractedText(text);
}
