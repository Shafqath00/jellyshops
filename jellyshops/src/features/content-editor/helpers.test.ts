import { describe, expect, it } from "vitest";
import { filterCommands, slashQuery } from "./commands";
import { normaliseHref } from "./dialogs";
import { toHex } from "./extensions";
import { cleanPastedHtml } from "./paste";

describe("slash menu", () => {
  it("finds the word typed after / at the start of a line or after a space", () => {
    expect(slashQuery("/", 1)).toEqual({ query: "", from: 0 });
    expect(slashQuery("Hello /ima", 11)).toEqual({ query: "ima", from: 7 });
    expect(slashQuery("http://example", 15)).toBeNull();
    expect(slashQuery("a/b", 3)).toBeNull();
  });

  it("matches labels and keywords, best matches first", () => {
    expect(filterCommands("")).toHaveLength(15);
    expect(filterCommands("ima")[0]?.id).toBe("image");
    expect(filterCommands("youtube")[0]?.id).toBe("video");
    expect(filterCommands("h2")[0]?.id).toBe("h2");
    expect(filterCommands("sizes").map((command) => command.id)).toContain("table");
    expect(filterCommands("zzz")).toEqual([]);
  });
});

describe("links and colours", () => {
  it("adds https to bare addresses and refuses unsafe ones", () => {
    expect(normaliseHref("example.com")).toBe("https://example.com");
    expect(normaliseHref("/pages/about")).toBe("/pages/about");
    expect(normaliseHref("mailto:hi@example.com")).toBe("mailto:hi@example.com");
    expect(normaliseHref("javascript:alert(1)")).toBeNull();
    expect(normaliseHref("  ")).toBeNull();
  });

  it("reads colours as six-digit hex", () => {
    expect(toHex("#ABC")).toBe("#aabbcc");
    expect(toHex("rgb(255, 0, 16)")).toBe("#ff0010");
    expect(toHex("red")).toBeNull();
  });
});

describe("paste clean-up", () => {
  it("removes Office markup, comments, styles and handlers but keeps meaningful formatting", () => {
    const word = `<!--[if gte mso 9]><xml><o:x/></xml><![endif]--><style>p{color:red}</style>
      <p class="MsoNormal" style="mso-margin-top-alt:auto;font-family:Calibri;color:black;text-align:center" onclick="alert(1)"><b style="font-weight:700">Hi</b><o:p></o:p></p>
      <p class="MsoListParagraph"><span style="mso-list:Ignore">·<span>&nbsp;</span></span>Item</p>
      <span style="color:#cc0000;background-color:white;font-style:italic">red</span>`;
    const cleaned = cleanPastedHtml(word);
    expect(cleaned).not.toMatch(/mso|<style|<xml|o:p|onclick|class=|Calibri|color: black|background-color: white/i);
    expect(cleaned).toContain(`<p style="text-align: center"><b style="font-weight: 700">Hi</b></p>`);
    expect(cleaned).toContain("<p>Item</p>");
    expect(cleaned).toContain(`<span style="color: #cc0000; font-style: italic">red</span>`);
  });
});
