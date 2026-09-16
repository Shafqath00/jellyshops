import { expect, test } from "@playwright/test";

test("card checkout prepares a durable attempt through the commerce API", async ({ page }) => {
  await page.route("**/api/public/stores/*/checkout/attempts", async (route) => {
    await route.fulfill({ json: { attemptId: "attempt-fixture", orderId: "order-fixture", publicToken: "token-fixture" } });
  });
  await page.route("**/api/public/stores/*/checkout/payment-intent", async (route) => {
    await route.fulfill({ json: { orderId: "order-fixture", publicToken: "token-fixture", clientSecret: "pi_fixture_secret", connectedAccountId: "acct_fixture" } });
  });

  await page.goto("/sweet-bakes");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("link", { name: "Vanilla Celebration Cake" }).first().click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("button", { name: /open cart with 1 item/i }).click();
  await page.getByRole("link", { name: "Checkout" }).click();

  await page.getByLabel("Name").fill("Riya Menon");
  await page.getByLabel("Email").fill("riya@example.com");
  await page.getByLabel("Phone").fill("+91 98888 11111");
  await page.getByLabel("Address line").fill("22 Palm Avenue");
  await page.getByLabel("City").fill("Bengaluru");
  await page.getByLabel("State").fill("Karnataka");
  await page.getByLabel("Postal code").fill("560001");
  await page.getByRole("button", { name: "Continue to card payment" }).click();

  await expect(page.getByRole("button", { name: "Pay securely" })).toBeVisible();
});

test("public order lookup is API-backed and does not use local order state", async ({ page }) => {
  await page.route("**/api/public/stores/*/orders/token-fixture", async (route) => {
    await route.fulfill({ json: { order: { number: "JS-FIXTURE", status: "PAID", totalMinor: 1000, currency: "USD" }, items: [], payment: null } });
  });
  await page.goto("/sweet-bakes/order/token-fixture");
  await expect(page.getByText("JS-FIXTURE")).toBeVisible();
  await expect(page.getByText("PAID")).toBeVisible();
});
