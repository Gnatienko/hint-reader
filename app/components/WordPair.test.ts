import { describe, expect, it } from "vitest";
import { buildMeasureHtml } from "./WordPair";

describe("buildMeasureHtml", () => {
  it("escapes HTML-sensitive token text", () => {
    const html = buildMeasureHtml(
      [{ word: "<script>alert('xss')</script> & text" }],
      24,
    );

    expect(html).toContain(
      "&lt;script&gt;alert('xss')&lt;/script&gt; &amp; text",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
  });

  it("still emits trusted measurement markup around escaped text", () => {
    const html = buildMeasureHtml([{ word: "A > B" }], 20);

    expect(html).toContain('class="word-pair"');
    expect(html).toContain("A &gt; B");
  });
});
