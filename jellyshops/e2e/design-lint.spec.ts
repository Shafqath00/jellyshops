import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { measureStorefrontPage } from "../src/lib/design-lint/measure";
import { compareWithBaseline, contrastFinding, findingsReport, lintPage, type DesignFinding } from "../src/lib/design-lint/rules";

/**
 * Design lint (docs/design-contract.md): measures every theme preview page at three widths against the
 * Jelly Design Contract. Needs no store, sign-in or backend. Fails only on problems that are not in
 * design-lint.baseline.json; JELLY_DESIGN_LINT_UPDATE=1 rewrites the baseline.
 */
const themes = [
  { path: "jelly-minimal", frame: "Jelly Minimal style guide", ready: "Jelly Minimal" },
  { path: "jelly-avenue", frame: "Jelly Avenue style guide", ready: "Jelly Avenue" },
  { path: "jelly-resthaven", frame: "Resthaven style guide", ready: "Resthaven" },
] as const;
const pages = ["Home", "Collection", "Product", "Cart", "Search", "Page", "404"] as const;
const devices = [["Desktop", "desktop"], ["Tablet", "tablet"], ["Mobile", "mobile"]] as const;

const here = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(here, "design-lint.baseline.json");
const reportDirectory = join(here, "..", "test-results");
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const updating = process.env.JELLY_DESIGN_LINT_UPDATE === "1";

async function show(page: Page, frameTitle: string, tab: string, device: string) {
  await page.getByRole("group", { name: "Page" }).getByRole("button", { name: tab, exact: true }).click();
  await page.getByRole("group", { name: "Preview width" }).getByRole("button", { name: new RegExp(`^${device}`) }).click();
  const frame = page.frameLocator(`iframe[title='${frameTitle}']`);
  await expect(frame.locator("[data-jelly-theme] main").first()).toBeVisible();
  // Let layout, fonts and images settle after the switch (the preview frame runs no timers of its own, so wait here).
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  return frame;
}

// Contrast needs axe in a real window; the preview frame runs no scripts, so the rendered page is copied
// into its own tab (same approach as the theme specs).
async function lowContrastTargets(page: Page, frameTitle: string) {
  // Stylesheets are inlined: a copied <link> to the dev server's CSS can be refused as a cross-origin request,
  // and an unstyled copy would pass every contrast check.
  const { html, background } = await page.frameLocator(`iframe[title='${frameTitle}']`).locator("html").evaluate((root) => {
    const css = [...document.styleSheets].map((sheet) => { try { return [...sheet.cssRules].map((rule) => rule.cssText).join("\n"); } catch { return ""; } }).join("\n");
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("link[rel='stylesheet'], style, script").forEach((node) => node.remove());
    const style = document.createElement("style");
    style.textContent = css;
    clone.querySelector("head")?.append(style);
    const themeRoot = document.querySelector("[data-jelly-theme]");
    return { html: clone.outerHTML, background: themeRoot ? getComputedStyle(themeRoot).backgroundColor : "" };
  });
  const copy = await page.context().newPage();
  try {
    await copy.setViewportSize({ width: 1280, height: 900 });
    await copy.setContent(html.replace("<head>", `<head><base href="${new URL(page.url()).origin}/">`), { waitUntil: "load" });
    const copied = await copy.evaluate(() => { const themeRoot = document.querySelector("[data-jelly-theme]"); return themeRoot ? getComputedStyle(themeRoot).backgroundColor : ""; });
    expect(copied, "the copied page must keep the theme's styles").toBe(background);
    await copy.addScriptTag({ content: axeSource });
    return await copy.evaluate(async () => {
      const axe = (window as unknown as { axe: { run(context: Element, options: object): Promise<{ violations: Array<{ nodes: Array<{ target: string[] }> }> }> } }).axe;
      const result = await axe.run(document.body, { runOnly: { type: "rule", values: ["color-contrast"] } });
      return result.violations.flatMap((violation) => violation.nodes.map((node) => node.target.join(" ")));
    });
  } finally {
    await copy.close();
  }
}

test.describe.configure({ mode: "serial" });
const findings: DesignFinding[] = [];

for (const theme of themes) {
  test(`design lint: ${theme.path}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`/theme-preview/${theme.path}`);
    await expect(page.frameLocator("iframe").getByRole("heading", { name: theme.ready, level: 1 })).toBeVisible();
    for (const tab of pages) {
      for (const [button, device] of devices) {
        const frame = await show(page, theme.frame, tab, button);
        const measurement = await frame.locator("html").evaluate(measureStorefrontPage);
        findings.push(...lintPage(measurement, { theme: theme.path, page: tab, device }));
        if (device === "desktop") {
          const contrast = contrastFinding({ theme: theme.path, page: tab, device }, await lowContrastTargets(page, theme.frame));
          if (contrast) findings.push(contrast);
        }
      }
    }
  });
}

test("design lint: compare with the baseline", () => {
  const baseline: string[] = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")).findings : [];
  const { added, fixed } = compareWithBaseline(findings, baseline);
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(join(reportDirectory, "design-lint-report.json"), `${JSON.stringify({ findings, added: added.map((item) => item.id), fixed }, null, 2)}\n`);
  writeFileSync(join(reportDirectory, "design-lint-report.md"), findingsReport(findings, fixed));
  if (updating) {
    const ids = [...new Set(findings.map((item) => item.id))].sort();
    writeFileSync(baselinePath, `${JSON.stringify({ note: "Known design-lint problems when the lint was introduced or last refreshed. Fix them; never add new ones. See docs/design-contract.md.", findings: ids }, null, 2)}\n`);
    return;
  }
  if (fixed.length) test.info().annotations.push({ type: "fixed", description: `${fixed.length} baseline problems are fixed; refresh the baseline (JELLY_DESIGN_LINT_UPDATE=1).` });
  expect(added.map((item) => `${item.id}: ${item.message}`), "New design problems (see test-results/design-lint-report.md)").toEqual([]);
});
