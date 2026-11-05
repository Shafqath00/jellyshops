import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

/**
 * Resthaven (bed showroom) theme pages, rendered by the theme preview with sample data.
 * Needs no store, sign-in or backend: it guards the theme's markup, CSS and accessibility,
 * including colour contrast (which the jsdom tests cannot check).
 */
const pages = [
  { tab: "Home", text: "Your best sleep starts here" },
  { tab: "Collection", text: "Upholstered beds" },
  { tab: "Product", text: "Harbour upholstered bed" },
  { tab: "Cart", text: "Your bag" },
  { tab: "Search", text: "2 results for" },
  { tab: "Page", text: "How we help" },
  { tab: "404", text: "We can't find that page" },
] as const;
const devices = [["Desktop", 1280], ["Tablet", 768], ["Mobile", 390]] as const;
const frameTitle = "Resthaven style guide";
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

async function open(page: Page, tab: string, device: string) {
  await page.getByRole("group", { name: "Page" }).getByRole("button", { name: tab, exact: true }).click();
  await page.getByRole("group", { name: "Preview width" }).getByRole("button", { name: new RegExp(`^${device}`) }).click();
  return page.frameLocator(`iframe[title='${frameTitle}']`);
}

// The preview frame does not run scripts of its own (and axe can't check a document from another window), so the
// rendered page, styles included, is copied into a tab of its own at the same width and checked there.
async function axeViolations(page: Page) {
  const html = await page.frameLocator(`iframe[title='${frameTitle}']`).locator("html").evaluate((root) => root.outerHTML);
  const copy = await page.context().newPage();
  try {
    await copy.setViewportSize({ width: 1280, height: 900 });
    await copy.setContent(html.replace("<head>", `<head><base href="${new URL(page.url()).origin}/">`), { waitUntil: "load" });
    await copy.addScriptTag({ content: axeSource });
    return await copy.evaluate(async () => {
      const axe = (window as unknown as { axe: { run(context: Element, options: object): Promise<{ violations: Array<{ id: string; nodes: Array<{ target: string[] }> }> }> } }).axe;
      const result = await axe.run(document.body, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
      return result.violations.map((violation) => `${violation.id}: ${violation.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(", ")}`);
    });
  } finally {
    await copy.close();
  }
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/theme-preview/jelly-resthaven");
  await expect(page.frameLocator("iframe").getByRole("heading", { name: "Resthaven", level: 1 })).toBeVisible();
});

for (const { tab, text } of pages) {
  test(`${tab} page renders without overflow and with named controls at every width`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [device, width] of devices) {
      const frame = await open(page, tab, device);
      await expect(frame.locator("main").getByText(text).first()).toBeVisible();
      const scrollWidth = await frame.locator("html").evaluate((html) => html.scrollWidth - html.clientWidth);
      expect(scrollWidth, `${tab} overflows horizontally at ${width}px`).toBeLessThanOrEqual(0);
      const unnamed = await frame.locator("body").evaluate((body) => [...body.querySelectorAll("a, button")].filter((el) => !(el.getAttribute("aria-label") || el.textContent?.trim() || el.querySelector("img[alt]:not([alt=''])"))).length);
      expect(unnamed, `${tab} has unnamed links or buttons at ${width}px`).toBe(0);
    }
    expect(errors).toEqual([]);
  });

  test(`${tab} page has no WCAG A/AA problems, contrast included`, async ({ page }) => {
    const frame = await open(page, tab, "Desktop");
    await expect(frame.locator("main").getByText(text).first()).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
}

test("the header menu opens the Beds dropdown and links stay inside the store", async ({ page }) => {
  const frame = await open(page, "Home", "Desktop");
  const nav = frame.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: /Beds/ }).click();
  await expect(nav.getByRole("link", { name: "Divan beds" })).toHaveAttribute("href", "/preview/search?q=Divan%20beds");
  await expect(frame.getByRole("search", { name: "Search the store" })).toBeVisible();
});

test("the footer is readable and links to the store's help pages", async ({ page }) => {
  const frame = await open(page, "Page", "Desktop");
  const footer = frame.locator("footer");
  await expect(footer.getByRole("link", { name: "Delivery" })).toHaveAttribute("href", "/preview/pages/shipping");
  const colours = await footer.evaluate((element) => [getComputedStyle(element).color, getComputedStyle(element).backgroundColor]);
  expect(colours[0]).not.toBe(colours[1]);
});

test("the product shows the sale label, and the add to basket bar appears after scrolling", async ({ page }) => {
  const frame = await open(page, "Product", "Desktop");
  await expect(frame.getByText("29% off")).toBeVisible();
  await frame.getByRole("button", { name: "Medium" }).click();
  await expect(frame.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
  const bar = frame.getByRole("region", { name: "Quick add to basket" });
  await expect(bar).toBeHidden();
  // The theme scrolls smoothly; jump straight to the end of the page.
  await frame.locator("html").evaluate((html) => html.ownerDocument.defaultView?.scrollTo({ top: html.scrollHeight, behavior: "instant" }));
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("Harbour upholstered bed");
});

test("cart quantities update the order total", async ({ page }) => {
  const frame = await open(page, "Cart", "Tablet");
  const summary = frame.getByRole("complementary", { name: "Order summary" });
  await expect(summary).toContainText("£858.00");
  await frame.getByRole("button", { name: /Increase quantity of Hollis pocket sprung mattress/ }).click();
  await expect(summary).toContainText("£1217.00");
});
