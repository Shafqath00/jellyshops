import { expect, test, type Page } from "@playwright/test";
import { axeOnStyledCopy, describeViolations } from "./fixtures/styled-copy";
import { measureStorefrontPage } from "../src/lib/design-lint/measure";
import { themePreviewEntries } from "../src/features/theme-preview/configs";

/**
 * Merchant-edit fuzz (Phase 6 quality gate): every theme's home, collection and product pages after the edits a
 * merchant makes in the editor: sections moved, colour schemes swapped, other fonts, optional blocks removed
 * (src/lib/settings-fuzz/merchant-edits.ts, shown by the theme preview with ?edits=<seed>). After any such edit a
 * page must still draw without errors, never scroll sideways, keep its text inside its boxes and pass WCAG A/AA
 * (contrast included). Seeds: JELLY_EDIT_SEEDS (default 1,2); a failure is reproduced by its theme and seed.
 */
const seeds = (process.env.JELLY_EDIT_SEEDS ?? "1,2").split(",").map((value) => Number(value.trim())).filter((value) => value > 0);
const themes = themePreviewEntries().map(({ path, config }) => ({ path, frame: `${config.name} style guide`, ready: config.name }));
const pages = ["Home", "Collection", "Product"] as const;
const devices = [["Desktop", 1280], ["Mobile", 390]] as const;

async function show(page: Page, frameTitle: string, tab: string, device: string) {
  await page.getByRole("group", { name: "Page" }).getByRole("button", { name: tab, exact: true }).click();
  await page.getByRole("group", { name: "Preview width" }).getByRole("button", { name: new RegExp(`^${device}`) }).click();
  const frame = page.frameLocator(`iframe[title='${frameTitle}']`);
  await expect(frame.locator("[data-jelly-theme] main").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  return frame;
}

test.describe.configure({ mode: "serial" });

for (const theme of themes) {
  for (const seed of seeds) {
    test(`merchant edits: ${theme.path}, seed ${seed}`, async ({ page }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width: 1400, height: 900 });
      await page.goto(`/theme-preview/${theme.path}?edits=${seed}`);
      await expect(page.frameLocator("iframe").getByRole("heading", { name: theme.ready, level: 1 })).toBeVisible();
      const problems: string[] = [];
      for (const tab of pages) {
        for (const [device, width] of devices) {
          const frame = await show(page, theme.frame, tab, device);
          const where = `${tab}/${device.toLowerCase()}`;
          const measurement = await frame.locator("html").evaluate(measureStorefrontPage);
          if (measurement.overflow > 1) problems.push(`${where}: scrolls sideways by ${measurement.overflow}px`);
          for (const text of measurement.spilledText) problems.push(`${where}: text outside its box: ${text}`);
          if (await frame.locator("[data-render-error]").count()) problems.push(`${where}: a section failed to draw`);
          for (const violation of describeViolations(await axeOnStyledCopy(page, theme.frame, { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] }, width))) problems.push(`${where}: ${violation}`);
        }
      }
      for (const error of errors) problems.push(`page error: ${error}`);
      expect(problems, `reproduce with /theme-preview/${theme.path}?edits=${seed}`).toEqual([]);
    });
  }
}
