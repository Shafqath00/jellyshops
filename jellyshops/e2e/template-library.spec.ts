import { expect, test } from "@playwright/test";
import { signInAsE2eMerchant } from "./fixtures/merchant-auth";

test("merchant previews templates, edits a draft, and uses the editor on mobile", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInAsE2eMerchant(page, "/admin/online-store");
  await expect(page.getByRole("link", { name: "Continue editing" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("template-gallery-desktop.png"), fullPage: true });
  const mutations: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/starters/")) mutations.push(request.url()); });
  await page.getByRole("button", { name: "Preview Fresh Market", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Fresh Market" })).toBeVisible();
  await dialog.getByRole("button", { name: "Mobile template preview" }).click();
  await expect(dialog.getByRole("button", { name: "Mobile template preview" })).toHaveAttribute("aria-pressed", "true");
  expect(mutations).toEqual([]);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("link", { name: "Continue editing" }).click();
  await expect(page.getByTestId("theme-editor-shell")).toBeVisible();
  await page.getByLabel("Page type", { exact: true }).selectOption("home");
  const headingBlock = page.frameLocator('iframe[title="Storefront preview"]').locator("[data-editor-block-id][data-editor-field-key='text']").first();
  await headingBlock.click();
  const input = page.getByRole("textbox", { name: "Heading", exact: true });
  const original = await input.inputValue();
  const edited = `A shop with a little soul ${Date.now()}`;
  try {
    await input.fill(edited);
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    await expect(input).toHaveValue(edited);
    await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(edited, { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("template-editor-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("navigation", { name: "Editor panels" }).getByRole("button", { name: "Preview", exact: true }).click();
    await page.getByRole("button", { name: "Mobile preview", exact: true }).click();
    await expect(page.getByTestId("preview-viewport")).toHaveAttribute("data-viewport", "mobile");
    await page.screenshot({ path: testInfo.outputPath("template-editor-mobile.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.frameLocator('iframe[title="Storefront preview"]').locator("[data-editor-block-id][data-editor-field-key='text']").first().click();
    await page.getByRole("textbox", { name: "Heading", exact: true }).fill(original);
    await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
  }
});
