import { expect, test } from "@playwright/test";
import { signInAsE2eMerchant } from "./fixtures/merchant-auth";

test("merchant edits a template, compiles preview, and publishes v4 storefront", async ({ page, context }) => {
  await signInAsE2eMerchant(page);
  const heading = `A new jelly season ${Date.now()}`;
  const workspace = page.waitForResponse((response) => response.url().includes("/storefront/workspace") && response.request().method() === "GET");
  const templates = page.waitForResponse((response) => response.url().includes("/storefront/templates") && response.request().method() === "GET");
  await page.goto("/admin/online-store/editor");
  expect((await workspace).ok()).toBeTruthy();
  expect((await templates).ok()).toBeTruthy();
  await expect(page.getByTestId("theme-editor-shell")).toBeVisible();

  const headingBlock = page.frameLocator('iframe[title="Storefront preview"]').locator("[data-editor-block-id][data-editor-field-key='text']").first();
  await expect(headingBlock).toBeVisible();
  await headingBlock.click();

  const templateSave = page.waitForResponse((response) => response.url().includes("/storefront/templates/") && response.request().method() === "PATCH");
  await page.getByLabel("Heading", { exact: true }).fill(heading);
  expect((await templateSave).ok()).toBeTruthy();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.reload();
  await expect(page.frameLocator('iframe[title="Storefront preview"]').getByText(heading).first()).toBeVisible();

  await page.getByLabel("More actions").click();
  const validation = page.waitForResponse((response) => response.url().endsWith("/storefront/validate") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Check changes" }).click();
  expect([200, 422]).toContain((await validation).status());

  const preview = page.waitForResponse((response) => response.url().endsWith("/storefront/preview/compile") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Compiled preview" }).click();
  expect([200, 422]).toContain((await preview).status());
  await expect(page.getByText(/how your store will look when you publish/)).toBeVisible();

  const publicPage = await context.newPage();
  await publicPage.goto("/sweet-bakes");
  await expect(publicPage.getByText(heading)).not.toBeVisible();

  const publication = page.waitForResponse((response) => response.url().endsWith("/storefront/publish") && response.request().method() === "POST");
  await page.getByLabel("Publishing options").click();
  await page.getByRole("button", { name: "Publish" }).click();
  expect([200, 201]).toContain((await publication).status());
  await expect(page.getByRole("status").filter({ hasText: "Published" })).toBeVisible();

  await publicPage.reload();
  await expect(publicPage.getByText(heading)).toBeVisible();
});

test("merchant can inspect the online store at mobile width", async ({ page }) => {
  await signInAsE2eMerchant(page);
  await page.getByRole("button", { name: "Mobile preview" }).click();
  await expect(page.getByTestId("preview-viewport")).toHaveAttribute("data-viewport", "mobile");
});
