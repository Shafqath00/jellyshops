import { expect, test } from "@playwright/test";

test("merchant edits a template, compiles preview, and publishes v4 storefront", async ({ page, context }) => {
  const heading = `A new jelly season ${Date.now()}`;
  const workspace = page.waitForResponse((response) => response.url().includes("/storefront/workspace") && response.request().method() === "GET");
  const templates = page.waitForResponse((response) => response.url().includes("/storefront/templates") && response.request().method() === "GET");
  await page.goto("/admin/online-store/editor");
  expect((await workspace).ok()).toBeTruthy();
  expect((await templates).ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Theme editor" })).toBeVisible();

  const headingBlock = page.locator("[data-editor-block-id][data-editor-field-key='text']").first();
  await expect(headingBlock).toBeVisible();
  await headingBlock.click();

  const templateSave = page.waitForResponse((response) => response.url().includes("/storefront/templates/") && response.request().method() === "PATCH");
  await page.getByLabel("Heading").fill(heading);
  expect((await templateSave).ok()).toBeTruthy();

  const validation = page.waitForResponse((response) => response.url().endsWith("/storefront/validate") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Validate" }).click();
  expect([200, 422]).toContain((await validation).status());

  const preview = page.waitForResponse((response) => response.url().endsWith("/storefront/preview/compile") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Preview" }).click();
  expect([200, 422]).toContain((await preview).status());
  await expect(page.getByText(/Compiled preview · generation/)).toBeVisible();

  const publicPage = await context.newPage();
  await publicPage.goto("/sweet-bakes");
  await expect(publicPage.getByText(heading)).not.toBeVisible();

  const publication = page.waitForResponse((response) => response.url().endsWith("/storefront/publish") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Publish" }).click();
  expect([200, 201]).toContain((await publication).status());
  await expect(page.getByRole("status")).toContainText("Published");

  await publicPage.reload();
  await expect(publicPage.getByText(heading)).toBeVisible();
});

test("merchant can inspect the online store at mobile width", async ({ page }) => {
  await page.goto("/admin/online-store/editor");
  await page.getByRole("button", { name: "Mobile preview" }).click();
  await expect(page.getByTestId("preview-viewport")).toHaveAttribute("data-viewport", "mobile");
});
