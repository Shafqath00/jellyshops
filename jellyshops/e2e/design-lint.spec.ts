import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { axeOnStyledCopy } from "./fixtures/styled-copy";
import { measureStorefrontPage } from "../src/lib/design-lint/measure";
import { compareWithBaseline, contrastFinding, findingsReport, lintPage, type DesignFinding } from "../src/lib/design-lint/rules";
import { themePreviewEntries } from "../src/features/theme-preview/configs";
import { BASELINE_GROUPS } from "../src/features/theme-preview/section-baseline";

/**
 * Design lint (docs/design-contract.md): measures every theme preview page at three widths against the
 * Jelly Design Contract. Needs no store, sign-in or backend. Fails only on problems that are not in
 * design-lint.baseline.json; JELLY_DESIGN_LINT_UPDATE=1 rewrites the baseline.
 */
// Every theme preview: the built-in themes and every generated theme (built on a base design with `extends`).
const themes = themePreviewEntries().map(({ path, config, base }) => ({ path, frame: `${config.name} style guide`, ready: config.name, base }));
const pages = ["Home", "Collection", "Product", "Cart", "Search", "Page", "404"] as const;
const devices = [["Desktop", "desktop"], ["Tablet", "tablet"], ["Mobile", "mobile"]] as const;

const here = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(here, "design-lint.baseline.json");
const reportDirectory = join(here, "..", "test-results");
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
          const contrast = contrastFinding({ theme: theme.path, page: tab, device }, (await axeOnStyledCopy(page, theme.frame, { type: "rule", values: ["color-contrast"] })).flatMap((violation) => violation.nodes.map((node) => node.target.join(" "))));
          if (contrast) findings.push(contrast);
        }
      }
    }
  });
}

// The same themes filled in the way merchants really fill them in (theme-preview/messy-data.ts): photos of every
// shape, long names, missing photos, sold-out products. Desktop and phones; page names end in "(messy)".
const messyPages = ["Home", "Collection", "Product", "Cart", "Search", "Page"] as const;
for (const theme of themes) {
  test(`design lint, messy data: ${theme.path}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`/theme-preview/${theme.path}`);
    await expect(page.frameLocator("iframe").getByRole("heading", { name: theme.ready, level: 1 })).toBeVisible();
    await page.getByRole("group", { name: "Sample data" }).getByRole("button", { name: "Messy data" }).click();
    for (const tab of messyPages) {
      for (const [button, device] of [["Desktop", "desktop"], ["Mobile", "mobile"]] as const) {
        const frame = await show(page, theme.frame, tab, button);
        const measurement = await frame.locator("html").evaluate(measureStorefrontPage);
        findings.push(...lintPage(measurement, { theme: theme.path, page: `${tab} (messy)`, device }));
      }
    }
  });
}

// Section baseline (theme-preview/section-baseline.tsx): every section with the platform's own CSS only, no theme.
// Only layout rules apply (a page of every section has no single rhythm, heading scale or title by design).
// JELLY_BASELINE_SHOTS=<folder> also saves a picture of each section there (outside test-results, which Playwright empties).
const layoutRules = new Set(["edge", "overflow", "tap-target", "stacked-row", "gallery", "text-spill", "card-ratio", "title-lines"]);
for (const data of ["tidy", "messy"] as const) {
  test(`design lint: section baseline (${data} data)`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/theme-preview/platform-baseline");
    await expect(page.frameLocator("iframe[title='Section baseline']").locator("[data-baseline-section]").first()).toBeVisible();
    if (data === "messy") await page.getByRole("group", { name: "Sample data" }).getByRole("button", { name: "Messy data" }).click();
    for (const [tab] of BASELINE_GROUPS.map(([key, label]) => [label, key] as const)) {
      for (const [button, device] of devices) {
        const frame = await show(page, "Section baseline", tab, button);
        const measurement = await frame.locator("html").evaluate(measureStorefrontPage);
        const pageName = data === "messy" ? `${tab} (messy)` : tab;
        findings.push(...lintPage(measurement, { theme: "platform-baseline", page: pageName, device }).filter((item) => layoutRules.has(item.rule)));
        if (process.env.JELLY_BASELINE_SHOTS) {
          const directory = join(process.env.JELLY_BASELINE_SHOTS, `${data}-${device}`);
          mkdirSync(directory, { recursive: true });
          // The frame covers the window while pictures are taken, so nothing of the preview page overlaps a section.
          const iframe = page.locator("iframe[title='Section baseline']");
          await iframe.evaluate((element) => Object.assign((element as HTMLElement).style, { position: "fixed", inset: "0", height: "100vh", zIndex: "10", width: `${element.getBoundingClientRect().width}px` }));
          const sections = frame.locator("[data-baseline-section]");
          for (let index = 0; index < await sections.count(); index++) {
            const item = sections.nth(index);
            const label = (await item.getAttribute("data-baseline-section")) ?? String(index);
            if (!(await item.isVisible())) continue;
            await item.screenshot({ path: join(directory, `${tab}-${String(index).padStart(2, "0")}-${label.replace(/[^a-z0-9]+/gi, "_")}.png`), animations: "disabled" }).catch(() => {});
          }
          await iframe.evaluate((element) => { (element as HTMLElement).removeAttribute("style"); });
        }
      }
    }
  });
}

test("design lint: compare with the baseline", () => {
  const saved: string[] = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")).findings : [];
  // A messy-data finding the theme already has with its own data is not caused by the data: it counts as known.
  const tidyIds = new Set([...saved, ...findings.filter((item) => !item.page.endsWith("(messy)")).map((item) => item.id)]);
  const baseline = [...saved, ...findings.filter((item) => item.page.endsWith("(messy)") && tidyIds.has(item.id.replace(" (messy)", ""))).map((item) => item.id)];
  // A generated theme passes when it adds nothing to its base design's known problems (it shares the base's CSS).
  const inherited = themes.flatMap(({ path, base }) => base ? baseline.filter((id) => id.split("|")[1] === base).map((id) => id.replace(`|${base}|`, `|${path}|`)) : []);
  const { added } = compareWithBaseline(findings, [...baseline, ...inherited]);
  const { fixed } = compareWithBaseline(findings, baseline);
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(join(reportDirectory, "design-lint-report.json"), `${JSON.stringify({ findings, added: added.map((item) => item.id), fixed }, null, 2)}\n`);
  writeFileSync(join(reportDirectory, "design-lint-report.md"), findingsReport(findings, fixed));
  if (updating) {
    const ids = [...new Set(findings.map((item) => item.id))].filter((id) => !inherited.includes(id) && !(id.includes(" (messy)|") && tidyIds.has(id.replace(" (messy)", "")))).sort();
    writeFileSync(baselinePath, `${JSON.stringify({ note: "Known design-lint problems when the lint was introduced or last refreshed. Fix them; never add new ones. See docs/design-contract.md.", findings: ids }, null, 2)}\n`);
    return;
  }
  if (fixed.length) test.info().annotations.push({ type: "fixed", description: `${fixed.length} baseline problems are fixed; refresh the baseline (JELLY_DESIGN_LINT_UPDATE=1).` });
  expect(added.map((item) => `${item.id}: ${item.message}`), "New design problems (see test-results/design-lint-report.md)").toEqual([]);
});
