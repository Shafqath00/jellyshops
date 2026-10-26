import { expect, test, type Page } from "@playwright/test";

/**
 * Jelly Avenue theme pages, rendered by the theme preview with sample data.
 * Needs no store, sign-in or backend: it guards the theme's markup and CSS.
 */
const pages = [
  { tab: "Home", text: "Dressed for the city" },
  { tab: "Collection", text: "Outerwear" },
  { tab: "Product", text: "Belted wool coat" },
  { tab: "Cart", text: "Your bag" },
  { tab: "Search", text: "2 results for" },
  { tab: "Page", text: "How we make things" },
  { tab: "404", text: "This page has moved on." },
] as const;
const devices = [["Desktop", 1280], ["Tablet", 768], ["Mobile", 390]] as const;
const frameTitle = "Jelly Avenue style guide";

async function open(page: Page, tab: string, device: string) {
  await page.getByRole("group", { name: "Page" }).getByRole("button", { name: tab, exact: true }).click();
  await page.getByRole("group", { name: "Preview width" }).getByRole("button", { name: new RegExp(`^${device}`) }).click();
  return page.frameLocator(`iframe[title='${frameTitle}']`);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/theme-preview/jelly-avenue");
  await expect(page.frameLocator("iframe").getByRole("heading", { name: "Jelly Avenue", level: 1 })).toBeVisible();
});

for (const { tab, text } of pages) {
  test(`${tab} page renders without overflow and with named controls at every width`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [device, width] of devices) {
      const frame = await open(page, tab, device);
      await expect(frame.getByText(text).first()).toBeVisible();
      const scrollWidth = await frame.locator("html").evaluate((html) => html.scrollWidth - html.clientWidth);
      expect(scrollWidth, `${tab} overflows horizontally at ${width}px`).toBeLessThanOrEqual(0);
      const unnamed = await frame.locator("body").evaluate((body) => [...body.querySelectorAll("a, button")].filter((el) => !(el.getAttribute("aria-label") || el.textContent?.trim())).length);
      expect(unnamed, `${tab} has unnamed links or buttons at ${width}px`).toBe(0);
    }
    expect(errors).toEqual([]);
  });
}

test("the home slideshow shows one slide and moves on with its arrows", async ({ page }) => {
  const frame = await open(page, "Home", "Desktop");
  const next = frame.getByRole("button", { name: "Next slide" });
  await expect(next).toBeVisible();
  await expect(frame.getByRole("heading", { name: "Dressed for the city" })).toBeVisible();
  await next.click();
  await expect(frame.getByRole("heading", { name: "Quiet confidence" })).toBeVisible();
});

test("cart quantities update the order total", async ({ page }) => {
  const frame = await open(page, "Cart", "Tablet");
  await expect(frame.getByRole("complementary", { name: "Order summary" })).toContainText("£460.00");
  await frame.getByRole("button", { name: /Increase quantity of Heavyweight crewneck/ }).click();
  await expect(frame.getByRole("complementary", { name: "Order summary" })).toContainText("£545.00");
});

test("choosing a size makes the product available", async ({ page }) => {
  const frame = await open(page, "Product", "Mobile");
  await expect(frame.getByText("Choose a size")).toBeVisible();
  await frame.getByRole("button", { name: "Medium" }).click();
  await expect(frame.getByText("10 items in stock")).toBeVisible();
  await expect(frame.getByRole("button", { name: "Large" })).toBeDisabled();
});

test("the product information tabs open one at a time", async ({ page }) => {
  const frame = await open(page, "Product", "Desktop");
  const care = frame.getByText("Materials & care", { exact: true });
  await care.click();
  await expect(frame.getByText("Describe what the piece is made from", { exact: false })).toBeVisible();
});
