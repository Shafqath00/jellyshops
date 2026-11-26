import { richTextToHtml } from "@jelly/storefront-schema";
import { describe, expect, it } from "vitest";
import { cleanHtml, htmlToRichTextDocument } from "./html-import.js";

const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });

describe("HTML import", () => {
  it("keeps the structure of ordinary HTML", () => {
    const document = htmlToRichTextDocument(`
      <h2 style="text-align:center">Delivery</h2>
      <p>We deliver <strong>free</strong> over <em>£50</em>, <u>Monday</u> to <s>Sunday</s>. See <a href="/pages/returns" target="_blank">returns</a>.</p>
      <ul><li>Fast</li><li>Tracked</li></ul>
      <ol><li><p>Order</p></li></ol>
      <blockquote><p>Lovely bed</p></blockquote>
      <hr>
      <pre>let a = 1;</pre>
      <table><tr><th>Size</th><th>Price</th></tr><tr><td>King</td><td>£499</td></tr></table>
    `);
    expect(document.content).toEqual([
      { type: "heading", attrs: { level: 2, textAlign: "center" }, content: [text("Delivery")] },
      { type: "paragraph", content: [
        text("We deliver "), text("free", [{ type: "bold" }]), text(" over "), text("£50", [{ type: "italic" }]), text(", "),
        text("Monday", [{ type: "underline" }]), text(" to "), text("Sunday", [{ type: "strike" }]), text(". See "),
        text("returns", [{ type: "link", attrs: { href: "/pages/returns", target: "_blank" } }]), text("."),
      ] },
      { type: "bulletList", content: [
        { type: "listItem", content: [{ type: "paragraph", content: [text("Fast")] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [text("Tracked")] }] },
      ] },
      { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("Order")] }] }] },
      { type: "blockquote", content: [{ type: "paragraph", content: [text("Lovely bed")] }] },
      { type: "horizontalRule" },
      { type: "codeBlock", content: [text("let a = 1;")] },
      { type: "table", content: [
        { type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [text("Size")] }] }, { type: "tableHeader", content: [{ type: "paragraph", content: [text("Price")] }] }] },
        { type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [text("King")] }] }, { type: "tableCell", content: [{ type: "paragraph", content: [text("£499")] }] }] },
      ] },
    ]);
  });

  it("cleans Word HTML: Office tags, list bullets, black text and mso styles", () => {
    const word = `<!--[if gte mso 9]><xml><o:OfficeDocumentSettings></o:OfficeDocumentSettings></xml><![endif]-->
      <p class="MsoNormal" style="mso-margin-top-alt:auto;color:black"><span style="font-family:Calibri;color:#000000">Our story<o:p></o:p></span></p>
      <p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span>&nbsp;&nbsp;</span></span>Handmade</p>
      <style>p { color: red }</style>`;
    expect(htmlToRichTextDocument(word).content).toEqual([
      { type: "paragraph", content: [text("Our story")] },
      { type: "paragraph", content: [text("Handmade")] },
    ]);
  });

  it("reads Google Docs formatting written as styles", () => {
    const docs = `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span style="font-weight:700;">Bold</span><span style="font-style:italic;"> italic</span><span style="text-decoration:underline;"> under</span><span style="color:#cc0000;"> red</span><span style="background-color:#ffff00;"> marked</span></p><h3><span style="font-weight:700">Heading</span></h3></b>`;
    expect(htmlToRichTextDocument(docs).content).toEqual([
      { type: "paragraph", content: [
        text("Bold", [{ type: "bold" }]), text(" italic", [{ type: "italic" }]), text(" under", [{ type: "underline" }]),
        text(" red", [{ type: "textStyle", attrs: { color: "#cc0000" } }]), text(" marked", [{ type: "highlight", attrs: { color: "#ffff00" } }]),
      ] },
      { type: "heading", attrs: { level: 3 }, content: [text("Heading")] },
    ]);
  });

  it("turns photos, figures, videos, buttons and checklists into their blocks", () => {
    const document = htmlToRichTextDocument(`
      <p>Before <img src="https://cdn.example.com/a.jpg" alt="Bed"> after</p>
      <figure data-type="image" data-align="right" style="width: 50%"><a href="/products/oak"><img src="/media/b.jpg" alt="Oak"></a><figcaption>Oak bed</figcaption></figure>
      <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Tour"></iframe>
      <p data-type="button" data-style="secondary"><a href="/collections/beds">Shop beds</a></p>
      <ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Measure</p></li><li><input type="checkbox"> Order</li></ul>
    `);
    expect(document.content).toEqual([
      { type: "paragraph", content: [text("Before")] },
      { type: "image", attrs: { src: "https://cdn.example.com/a.jpg", alt: "Bed" } },
      { type: "paragraph", content: [text("after")] },
      { type: "image", attrs: { src: "/media/b.jpg", alt: "Oak", caption: "Oak bed", width: 50, align: "right", href: "/products/oak" } },
      { type: "video", attrs: { provider: "youtube", id: "dQw4w9WgXcQ", title: "Tour" } },
      { type: "button", attrs: { href: "/collections/beds", label: "Shop beds", style: "secondary" } },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [text("Measure")] }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [text("Order")] }] },
      ] },
    ]);
  });

  it("round-trips its own HTML output", () => {
    const original = htmlToRichTextDocument(`<h2>Title</h2><p><strong>Bold</strong> and <a href="https://example.com">link</a></p><ul><li><p>One</p></li></ul><hr><p data-type="button"><a href="/x">Go</a></p>`);
    expect(htmlToRichTextDocument(richTextToHtml(original))).toEqual(original);
  });

  it("never lets attack strings through", () => {
    const attacks = [
      `<script>alert(1)</script><p>ok</p>`,
      `<img src=x onerror=alert(1)>`,
      `<img src="javascript:alert(1)">`,
      `<a href="javascript:alert(1)">x</a>`,
      `<a href=" jav&#x09;ascript:alert(1)">x</a>`,
      `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>`,
      `<svg onload=alert(1)><circle/></svg>`,
      `<iframe src="https://evil.example/x"></iframe>`,
      `<iframe src="javascript:alert(1)"></iframe>`,
      `<p style="background:url(javascript:alert(1))" onclick="alert(1)">x</p>`,
      `<span style="color: expression(alert(1))">x</span>`,
      `<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>`,
      `<form action="https://evil.example"><input name="password"></form>`,
      `<object data="x.swf"></object><embed src="x.swf">`,
      `<base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=https://evil.example">`,
      `<a href="https://example.com" onmouseover="alert(1)">hover</a>`,
      `"><script>alert(1)</script>`,
    ];
    for (const attack of attacks) {
      const cleaned = cleanHtml(attack);
      expect(cleaned).not.toMatch(/<script|<svg|<style|<form|<object|<embed|<base|<meta/i);
      expect(cleaned).not.toMatch(/<[^>]*\son\w+=/i);
      expect(cleaned).not.toMatch(/<[^>]*(javascript:|data:text|expression\()/i);
      const html = richTextToHtml(htmlToRichTextDocument(attack));
      expect(html).not.toMatch(/<script|<svg|<style|<form|<object|<embed|<base|<meta/i);
      expect(html).not.toMatch(/<[^>]*\son\w+=/i);
      expect(html).not.toMatch(/<[^>]*(javascript:|data:text|expression\()/i);
      expect(html).not.toContain("evil.example");
    }
  });

  it("refuses very large pastes", () => {
    expect(() => htmlToRichTextDocument(`<p>${"x".repeat(1024 * 1024 + 1)}</p>`)).toThrow(/smaller parts/);
  });
});
