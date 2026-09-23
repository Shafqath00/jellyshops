import { expect, test } from "@playwright/test";
import { signInAsE2eMerchant } from "./fixtures/merchant-auth";

for (const [label, storeName] of [
  ["Fresh Market", process.env.JELLY_E2E_FRESH_STORE_NAME],
  ["Artisan Boutique", process.env.JELLY_E2E_ARTISAN_STORE_NAME],
] as const) {
  test(`${label} editor and storefront previews remain usable at desktop, tablet, and mobile widths`, async ({ page }) => {
    test.setTimeout(180_000);
    if (!storeName) throw new Error(`Set JELLY_E2E_${label === "Fresh Market" ? "FRESH" : "ARTISAN"}_STORE_NAME to an installed dedicated test store.`);
    await signInAsE2eMerchant(page, "/admin");
    await page.getByLabel("Switch store").selectOption({ label: storeName });
    await page.getByRole("link", { name: "Online Store" }).click();
    const publicHref = await page.getByRole("link", { name: "View store", exact: true }).getAttribute("href");
    expect(publicHref).toBeTruthy();
    await page.getByRole("link", { name: "Open theme editor" }).click();
    await expect(page.getByRole("heading", { name: "Theme editor" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("section-hero")).toBeVisible();
    await expect(page.getByTestId("section-product-grid")).toBeVisible();
    await page.getByTestId("section-hero").click();
    await page.getByRole("button", { name: "Back to section settings" }).click();
    const uploaded = page.waitForResponse((response) => response.url().endsWith("/media") && response.request().method() === "POST");
    await page.getByLabel("Image", { exact: true }).setInputFiles({
      name: "e2e-market-hero.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
    const uploadedResponse = await uploaded;
    expect(uploadedResponse.status()).toBe(201);
    const media = await uploadedResponse.json() as { url: string };
    const imageUrl = new URL(media.url, uploadedResponse.url()).href;
    await expect(page.getByTestId("section-hero").locator("img")).toHaveAttribute("src", imageUrl);
    let productName = "";

    for (const [width, device] of [[1440, "desktop"], [820, "tablet"], [390, "mobile"], [320, "mobile"]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: `${device[0]!.toUpperCase()}${device.slice(1)} preview` }).click();
      const preview = page.getByTestId("preview-viewport");
      await expect(preview).toHaveAttribute("data-viewport", device);
      await expect(preview).toBeVisible();
      expect(await preview.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(Math.min(width, 320) - 48);
      expect(await preview.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await expect(page.getByRole("button", { name: "Preview", exact: true })).toBeVisible();
      for (const pageType of ["home", "product", "collection", "cart", "blog", "article"] as const) {
        await page.getByLabel("Page type").selectOption(pageType);
        await expect(preview.locator("main, section, article, form").first()).toBeVisible();
        if (pageType === "home") {
          await expect(preview.getByTestId("section-hero").locator("img")).toHaveAttribute("src", imageUrl);
          await expect(preview.getByTestId("section-product-grid")).toBeVisible();
          expect(await preview.getByTestId("section-hero").locator("img").evaluate((image) => image.getBoundingClientRect().width)).toBeLessThanOrEqual(await preview.evaluate((element) => element.clientWidth));
        }
        if (pageType === "product") {
          const resources = page.getByLabel("Preview resource", { exact: true });
          expect(await resources.locator("option").count()).toBeGreaterThan(0);
          productName = (await resources.locator("option").first().textContent())?.trim() ?? "";
          await resources.selectOption({ index: 0 });
          await expect(preview.getByTestId("section-product-purchase").getByRole("button", { name: "Add to cart" })).toBeVisible();
        }
        if (pageType === "blog" || pageType === "article") {
          await expect(page.getByLabel("Preview resource", { exact: true }).locator("option").first()).not.toHaveText("Select resource");
          await expect(preview.getByTestId(`section-${pageType}-header`)).toBeVisible();
        }
      }
    }

    await page.getByLabel("Page type").selectOption("home");
    const validation = page.waitForResponse((response) => response.url().endsWith("/storefront/validate") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Validate" }).click();
    expect((await validation).status()).toBe(200);
    const compilation = page.waitForResponse((response) => response.url().endsWith("/storefront/preview/compile") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    expect((await compilation).status()).toBe(200);
    await expect(page.getByText(/Compiled preview · generation/)).toBeVisible();
    const publication = page.waitForResponse((response) => response.url().endsWith("/storefront/publish") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Publish" }).click();
    expect([200, 201]).toContain((await publication).status());

    const publicPage = await page.context().newPage();
    await publicPage.goto(publicHref!);
    await expect(publicPage.locator(".jelly-hero img")).toHaveAttribute("src", imageUrl);
    await expect(publicPage.getByText(productName, { exact: true }).first()).toBeVisible();
  });
}
