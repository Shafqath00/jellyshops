import { expect, test } from "@playwright/test";
import { signInAsE2eMerchant, signInAsOnboardingE2eMerchant } from "./fixtures/merchant-auth";

test("dedicated storeless merchant resumes setup and opens the dashboard with a draft store", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAsOnboardingE2eMerchant(page, "/onboarding");
  await expect(page).toHaveURL(/\/onboarding$/);
  const accept = page.getByRole("button", { name: "Accept and continue" });
  await expect(accept.or(page.getByLabel("Full name")).first()).toBeVisible();
  if (await accept.isVisible()) {
    await page.getByRole("checkbox", { name: "I agree to the JellyShop Terms of Service." }).check();
    await accept.click();
  }
  await page.getByLabel("Full name").fill("Onboarding Test Merchant");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const suffix = Date.now().toString();
  const storeName = `Onboarding E2E ${suffix}`;
  const slug = `onboarding-e2e-${suffix}`;
  await page.getByLabel("Store name").fill(storeName);
  await page.getByLabel("Store address").fill(slug);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Make it feel like your shop" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Make it feel like your shop" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Store address")).toHaveValue(slug);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByLabel("Store country and currency").selectOption("GB");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Review your store setup" })).toBeVisible();
  const completion = page.waitForResponse(response => response.url().endsWith("/api/onboarding/complete") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create my store" }).click();
  const created = await completion;
  expect(created.ok()).toBe(true);
  expect((await created.json()).store).toMatchObject({ name: storeName, slug, currency: "GBP" });
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("complementary")).toContainText(storeName);
});

test("merchant with an existing store still goes directly to admin", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAsE2eMerchant(page, "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("navigation", { name: "Merchant navigation" }).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("complementary")).toContainText(/Active store|Switch store/);
  await expect(page).not.toHaveURL(/\/onboarding/);
});
