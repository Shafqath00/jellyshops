import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { measureStorefrontPage } from "../src/lib/design-lint/measure";
import { lintPage, type DesignFinding } from "../src/lib/design-lint/rules";
import { themePreviewEntries } from "../src/features/theme-preview/configs";
import { BASELINE_GROUPS } from "../src/features/theme-preview/section-baseline";

/**
 * Settings fuzz in the browser (phase 6 of docs/reports/2026-11-09-shopify-template-parity.md): every section with
 * random but valid settings (theme-preview/section-baseline.tsx, ?seed=), drawn with no theme and inside every theme
 * (?theme=), at desktop and phone width. Whatever a merchant picks, a section must draw, the page must not scroll
 * sideways, text must stay inside its box and no text may reach the side of the screen. Looks are the merchant's
 * choice; these breakages are not. JELLY_FUZZ_SEEDS=1,2,3 picks the seeds (default 1,2).
 */
const seeds = (process.env.JELLY_FUZZ_SEEDS ?? "1,2").split(",").map(Number).filter((seed) => Number.isInteger(seed) && seed > 0);
const themes = [undefined, ...themePreviewEntries().map(({ path }) => path)];
const devices = [["Desktop", "desktop"], ["Mobile", "mobile"]] as const;
const reportPath = join(dirname(fileURLToPath(import.meta.url)), "..", "test-results", "settings-fuzz-report.json");

/** Text closer than this to the side of the screen has run off it (the page margin is at least 16px). */
const SCREEN_EDGE = 8;

/**
 * Breakages no setting may cause: sideways scrolling, text spilling out of its box, and text reaching the side of the
 * screen. Alignment, widths and sizes are the merchant's choice, so the page-edge alignment rule is not used here
 * (random Narrow/Page/Full widths move the edges it measures against).
 */
function breakages(measurement: Awaited<ReturnType<typeof measureStorefrontPage>>, context: { theme: string; page: string; device: string }): DesignFinding[] {
  const findings = lintPage(measurement, context).filter((finding) => finding.rule === "overflow" || finding.rule === "text-spill");
  for (const part of measurement.parts) {
    if (part.scrolling || part.textLeft === null || part.textRight === null) continue;
    // Edge-to-edge tiles and bands (a full-width section whose content spans the whole screen by design, such as
    // Avenue's collection tiles, or a product-column section drawn here outside its column). Overflowing text shows
    // on one side only.
    if (part.fullBleed && part.textLeft < SCREEN_EDGE && part.textRight > measurement.frameWidth - SCREEN_EDGE) continue;
    if (part.textLeft < SCREEN_EDGE || part.textRight > measurement.frameWidth - SCREEN_EDGE) {
      findings.push({ id: `screen-edge|${context.theme}|${context.page}|${context.device}|${part.key}`, rule: "edge", ...context, message: `${part.key} has text at the side of the screen (text ${part.textLeft}–${part.textRight}px of ${measurement.frameWidth}px)` });
    }
  }
  return findings;
}

async function show(page: Page, tab: string, device: string) {
  await page.getByRole("group", { name: "Page" }).getByRole("button", { name: tab, exact: true }).click();
  await page.getByRole("group", { name: "Preview width" }).getByRole("button", { name: new RegExp(`^${device}`) }).click();
  const frame = page.frameLocator("iframe[title='Section baseline']");
  await expect(frame.locator("[data-baseline-section]").first()).toBeVisible();
  await page.waitForTimeout(400);
  return frame;
}

test.describe.configure({ mode: "serial" });
const found: Array<DesignFinding & { seed: number }> = [];

for (const theme of themes) {
  test(`settings fuzz: ${theme ?? "no theme"}`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: 1400, height: 900 });
    for (const seed of seeds) {
      await page.goto(`/theme-preview/platform-baseline?seed=${seed}${theme ? `&theme=${theme}` : ""}`);
      await expect(page.getByText(`random settings, seed ${seed}`)).toBeVisible();
      for (const [, tab] of BASELINE_GROUPS.map(([key, label]) => [key, label] as const)) {
        for (const [button, device] of devices) {
          const frame = await show(page, tab, button);
          const failed = await frame.locator("[data-render-error]").allTextContents();
          for (const message of failed) found.push({ id: `render|${theme ?? "platform"}|${tab}|${device}|${seed}`, rule: "overflow", theme: theme ?? "platform", page: tab, device, message, seed });
          const measurement = await frame.locator("html").evaluate(measureStorefrontPage);
          for (const finding of breakages(measurement, { theme: theme ?? "platform", page: tab, device })) found.push({ ...finding, seed });
        }
      }
    }
  });
}

test("settings fuzz: no combination breaks a page", () => {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(found, null, 2)}\n`);
  expect(found.map((item) => `seed ${item.seed} ${item.id}: ${item.message}`)).toEqual([]);
});
