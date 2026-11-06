import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, type Page } from "@playwright/test";

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

export interface AxeNode { target: string[]; /** For colour contrast: "#777 on #fff, 4.2:1 (needs 4.5:1)". */ detail?: string }
export interface AxeViolation { id: string; nodes: AxeNode[] }

/**
 * Opens a copy of the page shown in a theme preview frame in a tab of its own, at `width`. The preview frame runs no
 * scripts of its own (and axe can't check a document from another window), so checks and screenshots use the copy.
 *
 * The stylesheets are inlined into the copy: copied `<link>` tags point at the dev server's CSS, which it refuses as a
 * cross-origin request from the copy, and an unstyled copy passes every contrast check. The copy is checked to keep
 * the theme's background and font. The caller closes the returned page.
 */
export async function openStyledCopy(page: Page, frameTitle: string, width = 1280): Promise<Page> {
  const { html, background, font } = await page.frameLocator(`iframe[title='${frameTitle}']`).locator("html").evaluate((root) => {
    const css = [...document.styleSheets].map((sheet) => {
      try { return [...sheet.cssRules].map((rule) => rule.cssText).join("\n"); } catch { return ""; }
    }).join("\n");
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("link[rel='stylesheet'], style, script").forEach((node) => node.remove());
    const style = document.createElement("style");
    style.textContent = css;
    clone.querySelector("head")?.append(style);
    const themeRoot = document.querySelector("[data-jelly-theme]") ?? document.body;
    const computed = getComputedStyle(themeRoot);
    return { html: clone.outerHTML, background: computed.backgroundColor, font: computed.fontFamily };
  });
  const copy = await page.context().newPage();
  try {
    await copy.setViewportSize({ width, height: 900 });
    await copy.setContent(html.replace("<head>", `<head><base href="${new URL(page.url()).origin}/">`), { waitUntil: "load" });
    const copied = await copy.evaluate(() => {
      const computed = getComputedStyle(document.querySelector("[data-jelly-theme]") ?? document.body);
      return { background: computed.backgroundColor, font: computed.fontFamily };
    });
    expect(copied, "the copied page must keep the theme's styles").toEqual({ background, font });
    return copy;
  } catch (error) {
    await copy.close();
    throw error;
  }
}

/** Runs axe (the given tags or rules) on a styled copy of the page in a theme preview frame. */
export async function axeOnStyledCopy(page: Page, frameTitle: string, runOnly: { type: "tag" | "rule"; values: string[] }, width = 1280): Promise<AxeViolation[]> {
  const copy = await openStyledCopy(page, frameTitle, width);
  try {
    await copy.addScriptTag({ content: axeSource });
    return await copy.evaluate(async (options) => {
      const axe = (window as unknown as { axe: { run(context: Element, options: object): Promise<{ violations: Array<{ id: string; nodes: Array<{ target: string[]; any?: Array<{ data?: unknown }> }> }> }> } }).axe;
      const result = await axe.run(document.body, { runOnly: options });
      return result.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => {
          const data = node.any?.[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string } | undefined;
          return { target: node.target, ...(data?.fgColor ? { detail: `${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1 (needs ${data.expectedContrastRatio})` } : {}) };
        }),
      }));
    }, runOnly);
  } finally {
    await copy.close();
  }
}

/** Short readable list of axe problems for test messages. */
export function describeViolations(violations: AxeViolation[]): string[] {
  return violations.map((violation) => `${violation.id}: ${violation.nodes.slice(0, 3).map((node) => `${node.target.join(" ")}${node.detail ? ` [${node.detail}]` : ""}`).join(", ")}`);
}
