import { expect, test } from "@playwright/test";

test("merchant can fulfil a customer mock order", async ({ page }) => {
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
  await page.getByRole("button", { name: "Place mock order" }).click();
  await expect(page.getByRole("heading", { name: "Order confirmed" })).toBeVisible();

  await page.goto("/admin/orders");
  await page.getByText("JS-1044").click();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start processing" }).click();
  await expect(page.getByText("Processing", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark shipped" }).click();
  await expect(page.getByText("Shipped", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(page.getByText("Delivered", { exact: true })).toBeVisible();
});
