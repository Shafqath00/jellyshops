import { expect, test, type Page } from "@playwright/test";
import { signInAsE2eMerchant, signInAsOnboardingE2eMerchant } from "./fixtures/merchant-auth";

const apiUrl = (process.env.JELLY_ONBOARDING_E2E_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

/** The signed-in merchant's access token, read from the Supabase session the page keeps in localStorage. */
async function accessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => /^sb-.*-auth-token$/.test(name));
    return key ? (JSON.parse(localStorage.getItem(key) ?? "{}") as { access_token?: string }).access_token : undefined;
  });
  if (!token) throw new Error("No merchant session in the browser.");
  return token;
}

test("storeless merchant goes through the five setup steps and lands on the dashboard", async ({ page }) => {
  test.setTimeout(180_000);
  await signInAsOnboardingE2eMerchant(page, "/onboarding");
  await expect(page).toHaveURL(/\/onboarding$/);

  // Terms (only shown until the merchant has accepted the current version).
  const accept = page.getByRole("button", { name: "Accept and continue" });
  await expect(accept.or(page.getByText(/^Step \d of 5$/i)).first()).toBeVisible({ timeout: 30_000 });
  if (await accept.isVisible()) {
    await page.getByRole("checkbox", { name: /I agree to the Jelly ?Shop Terms of Service/ }).check();
    await accept.click();
  }
  // A merchant who stopped part-way resumes on their saved step; go back to the first one.
  for (let i = 0; i < 5 && !(await page.getByRole("heading", { name: "Name your store" }).isVisible()); i++) {
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.waitForTimeout(700);
  }

  // 1 Name your store: the address check runs against the backend.
  await expect(page.getByRole("heading", { name: "Name your store" })).toBeVisible();
  const suffix = Date.now().toString();
  const storeName = `Onboarding E2E ${suffix}`;
  const slug = `onboarding-e2e-${suffix}`;
  await page.getByLabel("Store name").fill(storeName);
  await page.getByLabel("Store web address").fill(slug);
  await expect(page.getByText("This address is free.")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Your name").fill("Onboarding Test Merchant");
  await page.getByLabel("Where you’re based").selectOption("GB");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // 2 What do you sell? Progress survives a reload.
  await expect(page.getByRole("heading", { name: "What do you sell?" })).toBeVisible();
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/onboarding") && response.request().method() === "PATCH"
    && (response.request().postData() ?? "").includes("Mugs") && response.ok());
  await page.getByRole("radio", { name: "Home & living" }).check({ force: true });
  await page.getByLabel(/Your first collections/).fill("Vases, Mugs");
  await saved;
  await page.reload();
  await expect(page.getByRole("heading", { name: "What do you sell?" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Home & living" })).toBeChecked();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // 3 How do you sell today?
  await expect(page.getByRole("heading", { name: "How do you sell today?" })).toBeVisible();
  await page.getByRole("checkbox", { name: /Social media/ }).check({ force: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // 4 Pick a design: the category suggests Forma; choose Halo instead.
  await expect(page.getByRole("heading", { name: "Pick a design" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Forma/ })).toBeChecked();
  await page.getByRole("radio", { name: /^Halo/ }).check({ force: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // 5 Add your first product, then create the store.
  await expect(page.getByRole("heading", { name: "Add your first product" })).toBeVisible();
  await page.getByLabel("Product name").fill("Ceramic vase");
  await page.getByLabel("Price (GBP)").fill("42");
  await page.getByLabel(/How many you have/).fill("6");
  const completion = page.waitForResponse((response) => response.url().endsWith("/api/onboarding/complete") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create my store" }).click();
  const created = await completion;
  expect(created.ok()).toBe(true);
  const { store } = await created.json() as { store: { id: string; name: string; slug: string; currency: string } };
  expect(store).toMatchObject({ name: storeName, slug, currency: "GBP" });

  // Dashboard: welcome banner and setup checklist.
  await expect(page).toHaveURL(/\/admin\?welcome=1$/, { timeout: 30_000 });
  await expect(page.getByText(new RegExp(`Welcome to Jelly ?Shop`))).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Set up your store", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Publish your store design")).toBeVisible();

  // The chosen design is installed and the product is a draft.
  const headers = { Authorization: `Bearer ${await accessToken(page)}` };
  const products = await page.request.get(`${apiUrl}/api/stores/${store.id}/catalog/products`, { headers });
  expect(products.ok()).toBe(true);
  const list = await products.json() as { nodes: Array<{ title: string; status: string }> };
  expect(list.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Ceramic vase", status: "DRAFT" })]));
  const theme = await page.request.get(`${apiUrl}/api/stores/${store.id}/storefront/theme-settings`, { headers });
  expect(theme.ok()).toBe(true);
  expect(await theme.json()).toMatchObject({ themeId: "jelly-halo" });
});

test("merchant with an existing store still goes directly to admin", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAsE2eMerchant(page, "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("navigation", { name: "Merchant navigation" }).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("complementary")).toContainText(/Active store|Switch store/);
  await expect(page).not.toHaveURL(/\/onboarding/);
});
