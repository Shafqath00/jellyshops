import { expect, type Page } from "@playwright/test";

/** Signs in through the supported merchant UI; no session or auth boundary is mocked. */
export async function signInAsE2eMerchant(page: Page, destination = "/admin/online-store/editor"): Promise<void> {
  const email = process.env.JELLY_E2E_EMAIL;
  const password = process.env.JELLY_E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Authenticated editor E2E requires JELLY_E2E_EMAIL and JELLY_E2E_PASSWORD for a dedicated test merchant.");
  }

  await page.goto(`/login?next=${encodeURIComponent(destination)}`);
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (destination === "/admin/online-store/editor") {
    await expect(page.getByRole("heading", { name: "Theme editor" })).toBeVisible();
  } else {
    await expect(page).toHaveURL(new RegExp(`${destination.replaceAll("/", "\\/")}$`));
  }
}
