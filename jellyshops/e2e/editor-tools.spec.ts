import { expect, test, type Page } from "@playwright/test";
import { signInAsE2eMerchant } from "./fixtures/merchant-auth";

/**
 * The Shopify-style editor tools: groups of blocks, the floating toolbar and shortcuts,
 * "Show on", and restoring a session that ended before its changes were saved.
 * Needs the dedicated test merchant (JELLY_E2E_EMAIL / JELLY_E2E_PASSWORD); each test adds a
 * "Custom content" section to the home page and removes it again.
 */

const previewFrame = (page: Page) => page.frameLocator('iframe[title="Storefront preview"]');
/** The editor's save indicator in the top bar. */
const saveStatus = (page: Page, text: "Saved" | "Not saved") => page.getByRole("status").filter({ hasText: new RegExp(`^${text}$`) });

async function openHomeAndAddCustomContent(page: Page) {
  await signInAsE2eMerchant(page);
  await page.getByLabel("Page type", { exact: true }).selectOption("home");
  await page.getByRole("button", { name: "Add section to Template" }).click();
  await page.getByRole("button", { name: "Add Custom content" }).click();
  await expect(previewFrame(page).locator(".jelly-custom-content")).toBeVisible();
}

async function removeSelectedSection(page: Page) {
  await page.getByRole("button", { name: "Back to sections" }).click().catch(() => undefined);
  await page.getByRole("button", { name: "Custom content", exact: true }).last().click();
  await page.getByRole("button", { name: "Remove section" }).click();
  await expect(previewFrame(page).locator(".jelly-custom-content")).toHaveCount(0);
  await expect(saveStatus(page, "Saved")).toBeVisible();
}

test("merchant groups blocks, moves them with the toolbar and shortcuts, and limits where they show", async ({ page }) => {
  test.setTimeout(180_000);
  await openHomeAndAddCustomContent(page);
  const preview = previewFrame(page);
  try {
    // A group with a heading inside it.
    await page.getByRole("button", { name: "Add content block" }).click();
    await page.getByRole("button", { name: "Group", exact: true }).click();
    await page.getByRole("button", { name: "Add block to group" }).click();
    await page.getByRole("button", { name: "Heading", exact: true }).click();
    await expect(preview.locator(".jelly-block-group")).toBeVisible();
    await expect(preview.locator(".jelly-block-group h2")).toHaveCount(1);

    // The floating toolbar moves the selected block out of its group; Ctrl+Z puts it back.
    const toolbar = preview.getByRole("toolbar", { name: "Heading actions" });
    await toolbar.getByRole("button", { name: "Move out of group" }).click();
    await expect(preview.locator(".jelly-block-group h2")).toHaveCount(0);
    await expect(preview.locator(".jelly-custom-content-inner > h2")).toHaveCount(2);
    await page.keyboard.press("Control+Z");
    await expect(preview.locator(".jelly-block-group h2")).toHaveCount(1);

    // "Show on: Phones only" hides the group on desktop, where the toolbar says so, and shows it on Mobile.
    await preview.locator(".jelly-block-group").first().click({ position: { x: 2, y: 2 } });
    await page.getByLabel("Show on", { exact: true }).selectOption("mobile");
    await expect(preview.locator(".jelly-block-group")).toBeHidden();
    await expect(preview.getByRole("toolbar").getByText(/not shown at this width/)).toBeVisible();
    await page.getByRole("button", { name: "Mobile preview" }).click();
    await expect(page.getByTestId("preview-viewport")).toHaveAttribute("data-viewport", "mobile");
    await expect(preview.locator(".jelly-block-group")).toBeVisible();
    await page.getByRole("button", { name: "Desktop preview" }).click();
    await expect(saveStatus(page, "Saved")).toBeVisible();
  } finally {
    await removeSelectedSection(page);
  }
});

test("merchant can restore changes that were not saved before the page closed", async ({ page }) => {
  test.setTimeout(180_000);
  await openHomeAndAddCustomContent(page);
  const preview = previewFrame(page);
  try {
    await expect(saveStatus(page, "Saved")).toBeVisible();
    // The connection drops: the edit stays in the editor and in this browser, but never reaches the server.
    await page.route("**/storefront/templates/**", (route) => route.request().method() === "PATCH" ? route.abort() : route.continue());
    const text = `Unsaved ${Date.now()}`;
    await preview.locator(".jelly-custom-content h2").first().click();
    await page.getByRole("textbox", { name: "Heading", exact: true }).fill(text);
    await expect(saveStatus(page, "Not saved")).toBeVisible();

    await page.unroute("**/storefront/templates/**");
    await page.reload();
    const banner = page.getByRole("region", { name: "Restore your last session" });
    await expect(banner).toBeVisible();
    await expect(preview.getByText(text)).toHaveCount(0);
    await banner.getByRole("button", { name: "Restore changes" }).click();
    await expect(preview.getByText(text).first()).toBeVisible();
    await expect(saveStatus(page, "Saved")).toBeVisible();

    // Once saved there is nothing left to restore.
    await page.reload();
    await expect(page.getByTestId("theme-editor-shell")).toBeVisible();
    await expect(page.getByRole("region", { name: "Restore your last session" })).toHaveCount(0);
    await expect(preview.getByText(text).first()).toBeVisible();
  } finally {
    await removeSelectedSection(page);
  }
});
