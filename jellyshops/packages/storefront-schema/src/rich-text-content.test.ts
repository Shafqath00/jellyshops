import { describe, expect, it } from "vitest";
import { isRichTextDocument, normalizeRichTextDocument, parseVideoUrl, richTextToPlainText, richTextWordCount, safeRichTextImageSrc, videoEmbedUrl } from "./rich-text.js";
import { richTextToHtml } from "./rich-text-html.js";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, marks?: unknown[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });

describe("page and post content", () => {
  it("keeps headings 1 to 6, strikethrough, code, highlight and new-tab links", () => {
    const input = doc(
      { type: "heading", attrs: { level: 6 }, content: [t("Small heading")] },
      p(t("gone", [{ type: "strike" }]), t("x = 1", [{ type: "code" }]), t("marked", [{ type: "highlight", attrs: { color: "#FFE066" } }]),
        t("site", [{ type: "link", attrs: { href: "https://example.com", target: "_blank", rel: "evil" } }])),
    );
    const normalized = normalizeRichTextDocument(input)!;
    expect(normalized.content[0]).toEqual({ type: "heading", attrs: { level: 6 }, content: [t("Small heading")] });
    expect(normalized.content[1]).toEqual(p(
      t("gone", [{ type: "strike" }]), t("x = 1", [{ type: "code" }]), t("marked", [{ type: "highlight", attrs: { color: "#ffe066" } }]),
      t("site", [{ type: "link", attrs: { href: "https://example.com", target: "_blank" } }]),
    ));
    expect(normalizeRichTextDocument(doc({ type: "heading", attrs: { level: 7 }, content: [t("x")] }))!.content).toEqual([]);
  });

  it("keeps photos with alt text, caption, width and alignment, and refuses unsafe photo addresses", () => {
    const normalized = normalizeRichTextDocument(doc(
      { type: "image", attrs: { src: "/api/public/media/store-a/m1", alt: "A bed", caption: "Our oak bed", width: 47, align: "right", onerror: "alert(1)" } },
      { type: "image", attrs: { src: "javascript:alert(1)", alt: "x" } },
      { type: "image", attrs: { src: "data:image/svg+xml;base64,PHN2Zz4=", alt: "x" } },
      { type: "image", attrs: { src: "https://cdn.example.com/a.jpg\" onerror=\"alert(1)", alt: "x" } },
      { type: "image", attrs: { src: "https://cdn.example.com/b.jpg", width: 100, align: "center" } },
    ))!;
    expect(normalized.content).toEqual([
      { type: "image", attrs: { src: "/api/public/media/store-a/m1", alt: "A bed", caption: "Our oak bed", width: 45, align: "right" } },
      { type: "image", attrs: { src: "https://cdn.example.com/b.jpg", alt: "" } },
    ]);
    expect(safeRichTextImageSrc("//evil.example/a.png")).toBeNull();
  });

  it("stores videos as a provider and id only", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://vimeo.com/123456789")).toEqual({ provider: "vimeo", id: "123456789" });
    expect(parseVideoUrl("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseVideoUrl("javascript:alert(1)")).toBeNull();
    const normalized = normalizeRichTextDocument(doc(
      { type: "video", attrs: { provider: "youtube", id: "dQw4w9WgXcQ", title: "Tour" } },
      { type: "youtube", attrs: { src: "https://www.youtube.com/embed/dQw4w9WgXcQ" } },
      { type: "video", attrs: { provider: "youtube", id: "\"><script>" } },
      { type: "video", attrs: { provider: "other", id: "1" } },
    ))!;
    expect(normalized.content).toEqual([
      { type: "video", attrs: { provider: "youtube", id: "dQw4w9WgXcQ", title: "Tour" } },
      { type: "video", attrs: { provider: "youtube", id: "dQw4w9WgXcQ" } },
    ]);
    expect(videoEmbedUrl({ provider: "youtube", id: "dQw4w9WgXcQ" })).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("keeps buttons, checklists, dividers and code blocks", () => {
    const input = doc(
      { type: "button", attrs: { href: "/collections/beds", label: "Shop beds", style: "secondary", target: "_blank", align: "center" } },
      { type: "button", attrs: { href: "javascript:alert(1)", label: "Bad" } },
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [p(t("Measure the room"))] }, { type: "taskItem", attrs: { checked: "yes" }, content: [p(t("Order"))] }] },
      { type: "horizontalRule" },
      { type: "codeBlock", attrs: { language: "js" }, content: [t("let a = 1;")] },
    );
    const normalized = normalizeRichTextDocument(input)!;
    expect(normalized.content).toEqual([
      { type: "button", attrs: { href: "/collections/beds", label: "Shop beds", style: "secondary", target: "_blank", align: "center" } },
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [p(t("Measure the room"))] }, { type: "taskItem", attrs: { checked: false }, content: [p(t("Order"))] }] },
      { type: "horizontalRule" },
      { type: "codeBlock", content: [t("let a = 1;")] },
    ]);
    expect(isRichTextDocument(normalized)).toBe(true);
    expect(richTextToPlainText(normalized)).toBe("Shop beds\n\n[x] Measure the room\n[ ] Order\n\nlet a = 1;");
    expect(richTextWordCount(normalized)).toBe(9);
  });

  it("keeps media out of table cells", () => {
    const normalized = normalizeRichTextDocument(doc({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "image", attrs: { src: "/a.png", alt: "" } }, p(t("Cell"))] }] }] }))!;
    expect(normalized.content[0]).toEqual({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [p(t("Cell"))] }] }] });
  });
});

describe("HTML output", () => {
  it("draws every kind of content as plain, escaped HTML", () => {
    const html = richTextToHtml(doc(
      { type: "heading", attrs: { level: 2, textAlign: "center" }, content: [t("Hello <world>")] },
      p(t("bold", [{ type: "bold" }]), t(" & "), t("link", [{ type: "link", attrs: { href: "https://example.com/?a=1&b=\"2\"", target: "_blank" } }])),
      { type: "image", attrs: { src: "/media/a.jpg", alt: "Bed \"oak\"", caption: "Oak", width: 50, align: "left" } },
      { type: "video", attrs: { provider: "vimeo", id: "42" } },
      { type: "button", attrs: { href: "/pages/about", label: "About us" } },
      { type: "horizontalRule" },
    ));
    expect(html).toContain('<h2 style="text-align: center">Hello &lt;world&gt;</h2>');
    expect(html).toContain('<strong>bold</strong> &amp; <a href="https://example.com/?a=1&amp;b=&quot;2&quot;" target="_blank" rel="noopener noreferrer">link</a>');
    expect(html).toContain('<figure data-type="image" data-align="left" style="width: 50%"><img src="/media/a.jpg" alt="Bed &quot;oak&quot;" data-width="50" loading="lazy"><figcaption>Oak</figcaption></figure>');
    expect(html).toContain('src="https://player.vimeo.com/video/42"');
    expect(html).toContain('<a href="/pages/about">About us</a>');
    expect(html).toContain("<hr>");
  });

  it("never lets attack strings through", () => {
    const attacks = [
      doc({ type: "paragraph", content: [t("<img src=x onerror=alert(1)>")] }),
      doc({ type: "html", content: "<script>alert(1)</script>" }),
      doc(p(t("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))),
      doc(p(t("x", [{ type: "link", attrs: { href: "  JaVaScRiPt:alert(1)" } }]))),
      doc(p(t("x", [{ type: "link", attrs: { href: "data:text/html,<script>alert(1)</script>" } }]))),
      doc(p(t("x", [{ type: "link", attrs: { href: "https://example.com\" onmouseover=\"alert(1)" } }]))),
      doc(p(t("x", [{ type: "highlight", attrs: { color: "red;background:url(javascript:alert(1))" } }]))),
      doc(p(t("x", [{ type: "textStyle", attrs: { color: "expression(alert(1))" } }]))),
      doc({ type: "image", attrs: { src: "x\" onerror=\"alert(1)", alt: "\" onload=\"alert(1)" } }),
      doc({ type: "button", attrs: { href: "vbscript:msgbox", label: "<b>x</b>" } }),
      doc({ type: "codeBlock", content: [t("</code><script>alert(1)</script>")] }),
      doc({ type: "paragraph", attrs: { style: "background:url(javascript:alert(1))", onclick: "alert(1)" }, content: [t("x")] }),
    ];
    for (const attack of attacks) {
      const html = richTextToHtml(attack);
      expect(html).not.toMatch(/<script/i);
      // Escaped text may mention these words; they must never appear inside a tag.
      expect(html).not.toMatch(/<[^>]*\son\w+=/i);
      expect(html).not.toMatch(/<[^>]*(javascript:|vbscript:|data:text|expression\()/i);
    }
    expect(richTextToHtml({ not: "a document" })).toBe("");
  });
});
