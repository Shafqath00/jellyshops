import { expect, test } from "@playwright/test";

test("merchant edits a private home draft and publishes it", async ({ page, context }) => {
  const heading = "A new jelly season";
  const loadedDraft = page.waitForResponse((response) => response.url().includes("/storefront/draft") && response.request().method() === "GET");
  await page.goto("/admin/store-design");
  expect((await loadedDraft).ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Home page" })).toBeVisible();

  await page.getByRole("button", { name: "Hero section" }).click();
  await page.getByLabel("Background").fill("#4f46e5");
  await page.getByLabel("Top spacing").fill("80");
  await page.getByRole("button", { name: "Heading block" }).click();
  await page.getByLabel("Heading").fill(heading);
  await page.getByRole("button", { name: "Back to page hierarchy" }).click();
  await page.getByRole("button", { name: "Hero section" }).hover();
  await page.getByRole("button", { name: "Move Hero down" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  const draftSave = page.waitForResponse((response) => response.url().includes("/storefront/draft") && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Save" }).click();
  expect((await draftSave).ok()).toBeTruthy();

  const publicPage = await context.newPage();
  await publicPage.goto("/sweet-bakes");
  await expect(publicPage.getByText(heading)).not.toBeVisible();

  const publishDraft = page.waitForResponse((response) => response.url().includes("/storefront/draft") && response.request().method() === "PUT");
  const publication = page.waitForResponse((response) => response.url().includes("/storefront/publish") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Publish" }).click();
  expect((await publishDraft).ok()).toBeTruthy();
  expect((await publication).ok()).toBeTruthy();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  await publicPage.reload();
  await expect(publicPage.getByText(heading)).toBeVisible();
});

test("merchant can inspect the home page at mobile width", async ({ page }) => {
  await page.goto("/admin/store-design");
  await page.getByRole("button", { name: "Mobile preview" }).click();
  await expect(page.getByTestId("preview-viewport")).toHaveAttribute("data-viewport", "mobile");
});
