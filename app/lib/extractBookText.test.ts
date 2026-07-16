import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractTextFromBookFile } from "./extractBookText";

function makeFile(name: string, content: string, type = "text/plain"): File {
  return new File([content], name, { type });
}

describe("TXT extraction and normalization", () => {
  it("normalizes CRLF line endings, non-breaking spaces, and repeated whitespace", async () => {
    const raw =
      "First\u00a0line\r\nSecond   line\t\t here\r\n\r\n\r\nThird line";
    const file = makeFile("story.txt", raw);

    const text = await extractTextFromBookFile(file);

    expect(text).toBe("First line\nSecond line here\n\nThird line");
  });

  it("trims leading and trailing whitespace after normalization", async () => {
    const file = makeFile("story.txt", "  \n\nHello world\n\n  ");
    expect(await extractTextFromBookFile(file)).toBe("Hello world");
  });
});

describe("empty and unsupported files", () => {
  it("rejects a TXT file with no readable text", async () => {
    const file = makeFile("empty.txt", "   \n\t  ");
    await expect(extractTextFromBookFile(file)).rejects.toThrow(
      "The selected file does not contain readable text",
    );
  });

  it("rejects unsupported file extensions", async () => {
    const file = makeFile("notes.xyz", "some content");
    await expect(extractTextFromBookFile(file)).rejects.toThrow(
      /Unsupported file format/,
    );
  });

  it("rejects files without an extension", async () => {
    const file = makeFile("README", "some content");
    await expect(extractTextFromBookFile(file)).rejects.toThrow(
      /Unsupported file format/,
    );
  });
});

describe("FB2 extraction", () => {
  it("extracts paragraphs from valid FB2 XML", async () => {
    const fb2 = `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <body>
    <section>
      <p>First paragraph.</p>
      <p>Second   paragraph.</p>
    </section>
  </body>
</FictionBook>`;
    const file = makeFile("book.fb2", fb2, "application/x-fictionbook+xml");

    const text = await extractTextFromBookFile(file);

    expect(text).toBe("First paragraph.\n\nSecond paragraph.");
  });

  it("rejects malformed FB2 XML", async () => {
    const fb2 = `<FictionBook><body><section><p>Unclosed</section></body></FictionBook>`;
    const file = makeFile("book.fb2", fb2);

    await expect(extractTextFromBookFile(file)).rejects.toThrow(
      "Invalid FB2 file",
    );
  });

  it("rejects FB2 documents with no extractable text", async () => {
    const fb2 = `<?xml version="1.0"?><FictionBook><body><section></section></body></FictionBook>`;
    const file = makeFile("book.fb2", fb2);

    await expect(extractTextFromBookFile(file)).rejects.toThrow(
      "Could not extract text from FB2",
    );
  });

  it("falls back to full document text when there are no <p> tags", async () => {
    const fb2 = `<?xml version="1.0"?><FictionBook><body>Just plain body text</body></FictionBook>`;
    const file = makeFile("book.fb2", fb2);

    expect(await extractTextFromBookFile(file)).toBe("Just plain body text");
  });
});

describe("RTF extraction", () => {
  it("converts control words into formatting characters", async () => {
    const rtf = `{\\rtf1\\ansi Hello\\par World\\tab End}`;
    const file = makeFile("doc.rtf", rtf, "application/rtf");

    const text = await extractTextFromBookFile(file);

    expect(text).toBe("Hello\nWorld End");
  });

  it("rejects RTF documents with no remaining text", async () => {
    const rtf = `{\\rtf1\\ansi\\deff0}`;
    const file = makeFile("doc.rtf", rtf);

    await expect(extractTextFromBookFile(file)).rejects.toThrow(
      "Could not extract text from RTF",
    );
  });

  it("rejects a completely empty RTF document", async () => {
    const file = makeFile("doc.rtf", "");
    await expect(extractTextFromBookFile(file)).rejects.toThrow(
      "Could not extract text from RTF",
    );
  });
});

describe("mocked EPUB extraction", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("jszip");
  });

  function mockZip(files: Record<string, string>) {
    vi.doMock("jszip", () => ({
      default: {
        loadAsync: vi.fn().mockResolvedValue({
          file: (path: string) => {
            const content = files[path];
            if (content === undefined) return null;
            return { async: () => Promise.resolve(content) };
          },
        }),
      },
    }));
  }

  const containerXml = `<?xml version="1.0"?>
<container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>`;

  const opfXml = `<?xml version="1.0"?>
<package>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;

  it("extracts and joins chapter text from a valid EPUB", async () => {
    mockZip({
      "META-INF/container.xml": containerXml,
      "content.opf": opfXml,
      "chapter1.xhtml": "<html><body><p>Chapter one text.</p></body></html>",
      "chapter2.xhtml": "<html><body><p>Chapter two text.</p></body></html>",
    });

    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile("book.epub", "irrelevant", "application/epub+zip");

    const text = await freshExtract(file);

    expect(text).toBe("Chapter one text.\n\nChapter two text.");
  });

  it("rejects an EPUB missing container.xml", async () => {
    mockZip({});
    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile("book.epub", "irrelevant");

    await expect(freshExtract(file)).rejects.toThrow(
      "Invalid EPUB: missing container.xml",
    );
  });

  it("rejects an EPUB whose container is missing a rootfile path", async () => {
    mockZip({
      "META-INF/container.xml": `<container><rootfiles><rootfile/></rootfiles></container>`,
    });
    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile("book.epub", "irrelevant");

    await expect(freshExtract(file)).rejects.toThrow(
      "Invalid EPUB: missing package file",
    );
  });

  it("rejects an EPUB missing its package (.opf) content", async () => {
    mockZip({
      "META-INF/container.xml": containerXml,
    });
    // No "content.opf" entry present.
    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile("book.epub", "irrelevant");

    await expect(freshExtract(file)).rejects.toThrow(
      "Invalid EPUB: missing package content",
    );
  });

  it("rejects an EPUB whose spine references no readable chapters", async () => {
    mockZip({
      "META-INF/container.xml": containerXml,
      "content.opf": opfXml,
      // Chapter files referenced by the manifest are absent from the archive.
    });
    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile("book.epub", "irrelevant");

    await expect(freshExtract(file)).rejects.toThrow(
      "Could not extract text from EPUB",
    );
  });

  it("propagates failures from the zip dependency", async () => {
    vi.doMock("jszip", () => ({
      default: {
        loadAsync: vi.fn().mockRejectedValue(new Error("corrupt archive")),
      },
    }));
    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile("book.epub", "irrelevant");

    await expect(freshExtract(file)).rejects.toThrow("corrupt archive");
  });
});

describe("mocked PDF extraction", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("pdfjs-dist");
  });

  it("joins non-empty page text and normalizes it", async () => {
    vi.doMock("pdfjs-dist", () => ({
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: (pageNumber: number) =>
            Promise.resolve({
              getTextContent: () =>
                Promise.resolve({
                  items:
                    pageNumber === 1
                      ? [{ str: "Page" }, { str: "one" }]
                      : [{ str: "Page" }, { str: "two" }],
                }),
            }),
        }),
      }),
      GlobalWorkerOptions: { workerSrc: "" },
    }));

    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile("book.pdf", "irrelevant", "application/pdf");

    expect(await freshExtract(file)).toBe("Page one\n\nPage two");
  });

  it("rejects a PDF with no extractable text on any page", async () => {
    vi.doMock("pdfjs-dist", () => ({
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: () =>
            Promise.resolve({
              getTextContent: () => Promise.resolve({ items: [] }),
            }),
        }),
      }),
      GlobalWorkerOptions: { workerSrc: "" },
    }));

    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile("book.pdf", "irrelevant");

    await expect(freshExtract(file)).rejects.toThrow(
      "Could not extract text from PDF",
    );
  });

  it("propagates failures from the PDF dependency", async () => {
    vi.doMock("pdfjs-dist", () => ({
      getDocument: () => {
        throw new Error("unreadable PDF");
      },
      GlobalWorkerOptions: { workerSrc: "" },
    }));

    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile("book.pdf", "irrelevant");

    await expect(freshExtract(file)).rejects.toThrow("unreadable PDF");
  });
});

describe("mocked DOCX extraction", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("mammoth");
  });

  it("normalizes text returned by the DOCX dependency", async () => {
    vi.doMock("mammoth", () => ({
      default: {
        extractRawText: vi
          .fn()
          .mockResolvedValue({ value: "Hello\r\nworld   there" }),
      },
    }));

    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile(
      "book.docx",
      "irrelevant",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    expect(await freshExtract(file)).toBe("Hello\nworld there");
  });

  it("rejects a DOCX with only whitespace content", async () => {
    vi.doMock("mammoth", () => ({
      default: {
        extractRawText: vi.fn().mockResolvedValue({ value: "   \n  " }),
      },
    }));

    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile("book.docx", "irrelevant");

    await expect(freshExtract(file)).rejects.toThrow(
      "Could not extract text from DOCX",
    );
  });

  it("propagates failures from the DOCX dependency", async () => {
    vi.doMock("mammoth", () => ({
      default: {
        extractRawText: vi.fn().mockRejectedValue(new Error("bad docx")),
      },
    }));

    const { extractTextFromBookFile: freshExtract } = await import(
      "./extractBookText"
    );
    const file = makeFile("book.docx", "irrelevant");

    await expect(freshExtract(file)).rejects.toThrow("bad docx");
  });
});
