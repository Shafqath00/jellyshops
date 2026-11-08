import { expect, test } from "@playwright/test";
import { signInAsE2eMerchant, signInAsOnboardingE2eMerchant } from "./fixtures/merchant-auth";

test("dedicated storeless merchant creates a store, installs Fresh Market, and enters the editor", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAsOnboardingE2eMerchant(page, "/onboarding");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "What should customers call your shop?" })).toBeVisible();

  const suffix = Date.now().toString();
  const storeName = `Onboarding E2E ${suffix}`;
  const slug = `onboarding-e2e-${suffix}`;
  await page.getByLabel("Store name").fill(storeName);
  await page.getByLabel("Store address").fill(slug);
  const created = page.waitForResponse((response) => response.url().endsWith("/api/stores") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create my shop" }).click();
  expect((await created).status()).toBe(201);

  await expect(page).toHaveURL(/\/admin\/online-store$/);
  await expect(page.getByRole("heading", { name: "Choose a ready-to-edit storefront." })).toBeVisible();
  await expect(page.getByRole("complementary")).toContainText(storeName);
  await expect(page.getByText("Active store", { exact: true })).toBeVisible();
  const installation = page.waitForResponse((response) => response.url().includes("/storefront/starters/fresh-market/install") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Start with Fresh Market" }).click();
  expect([200, 201]).toContain((await installation).status());
  await expect(page).toHaveURL(/\/admin\/online-store\/editor$/);
  await expect(page.getByRole("heading", { name: "Theme editor" })).toBeVisible();
  await expect(page.getByLabel("Page type")).toHaveValue("home");
  await expect(page.getByTestId("section-hero")).toBeVisible();
});

test("merchant with an existing store still goes directly to admin", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAsE2eMerchant(page, "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("navigation", { name: "Merchant navigation" }).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("complementary")).toContainText(/Active store|Switch store/);
  await expect(page).not.toHaveURL(/\/onboarding/);
});
