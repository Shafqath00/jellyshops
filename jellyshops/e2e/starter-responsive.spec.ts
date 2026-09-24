import { expect, test, type Page } from "@playwright/test";
import { signInAsE2eMerchant } from "./fixtures/merchant-auth";

type TestMenu = {
  id: string;
  revision: number;
  handle: string;
  items: Array<{ label?: string }>;
};

const primaryNavigationItems = [
  { id: "e2e-responsive-home", label: "Home", target: { kind: "home" }, children: [] },
  { id: "e2e-responsive-search", label: "Search", target: { kind: "search" }, children: [] },
];

/**
 * The two responsive test stores are deliberately mutable. Keep their required
 * starter navigation real by using the same authenticated workspace API the
 * editor uses; this is not an authentication or rendering test double.
 */
async function ensurePrimaryNavigation(page: Page): Promise<void> {
  const storeId = await page.getByLabel("Switch store").inputValue();
  expect(storeId).toBeTruthy();
  const token = await page.evaluate(() => {
    const findAccessToken = (value: unknown): string | null => {
      if (!value || typeof value !== "object") return null;
      if ("access_token" in value && typeof value.access_token === "string") return value.access_token;
      for (const nested of Object.values(value)) {
        const token = findAccessToken(nested);
        if (token) return token;
      }
      return null;
    };
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      const raw = key ? localStorage.getItem(key) : null;
      if (!raw) continue;
      try {
        const token = findAccessToken(JSON.parse(raw));
        if (token) return token;
      } catch {
        // Ignore unrelated local-storage values.
      }
    }
    return null;
  });
  expect(token).toBeTruthy();
  const apiOrigin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL
    ?? `http://127.0.0.1:${process.env.JELLY_E2E_BACKEND_PORT ?? "3001"}`;
  const menusUrl = `${apiOrigin}/api/stores/${encodeURIComponent(storeId)}/storefront/menus`;
  const headers = { Authorization: `Bearer ${token}` };
  const list = await page.request.get(menusUrl, { headers });
  expect(list.ok()).toBe(true);
  const menus = await list.json() as TestMenu[];
  const main = menus.find((menu) => menu.handle === "main");
  const hasRequiredItems = main && primaryNavigationItems.every((required) =>
    main.items.some((item) => item.label === required.label),
  );
  if (hasRequiredItems) return;

  const mutation = main
    ? await page.request.patch(`${menusUrl}/${encodeURIComponent(main.id)}`, {
      headers,
      data: { expectedRevision: main.revision, items: primaryNavigationItems },
    })
    : await page.request.post(menusUrl, {
      headers,
      data: { name: "Main menu", handle: "main", items: primaryNavigationItems },
    });
  expect(mutation.ok()).toBe(true);
}

for (const [label, storeName] of [
  ["Fresh Market", process.env.JELLY_E2E_FRESH_STORE_NAME],
  ["Artisan Boutique", process.env.JELLY_E2E_ARTISAN_STORE_NAME],
] as const) {
  test(`${label} editor and storefront previews remain usable at desktop, tablet, and mobile widths`, async ({ page }) => {
    test.setTimeout(180_000);
    if (!storeName) throw new Error(`Set JELLY_E2E_${label === "Fresh Market" ? "FRESH" : "ARTISAN"}_STORE_NAME to an installed dedicated test store.`);
    await signInAsE2eMerchant(page, "/admin");
    await page.getByLabel("Switch store").selectOption({ label: storeName });
    await ensurePrimaryNavigation(page);
    await page.getByRole("link", { name: "Online Store" }).click();
    const publicHref = await page.getByRole("link", { name: "View store", exact: true }).getAttribute("href");
    expect(publicHref).toBeTruthy();
    await page.getByRole("link", { name: "Open theme editor" }).click();
    await expect(page.getByRole("heading", { name: "Theme editor" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("section-hero")).toBeVisible();
    await expect(page.getByTestId("section-product-grid")).toBeVisible();
    const publicPage = await page.context().newPage();
    await publicPage.goto(publicHref!);
    await expect(publicPage.locator("body")).toBeVisible();
    const publicStateBeforeDraftPreview = (await publicPage.locator("body").innerText()).trim();
    expect(publicStateBeforeDraftPreview.length).toBeGreaterThan(0);
    const draftHeadline = `Draft ${label} update ${Date.now()}`;
    await page.getByTestId("section-hero").click();
    await page.getByRole("button", { name: "Heading block" }).click();
    await page.getByLabel("Heading", { exact: true }).fill(draftHeadline);
    await expect(page.getByTestId("section-hero")).toContainText(draftHeadline);
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
      if (width < 1024) {
        await page.getByRole("navigation", { name: "Editor panels" }).getByRole("button", { name: "Preview" }).click();
      }
      const preview = page.getByTestId("preview-viewport");
      await expect(preview).toHaveAttribute("data-viewport", device);
        await expect(preview).toBeVisible();
        expect(await preview.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(Math.min(width, 320) - 48);
        expect(await preview.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        await expect(page.locator("header").getByRole("button", { name: "Preview", exact: true })).toBeVisible();
        await expect(preview.locator(".jelly-header")).toBeVisible();
        await expect(preview.locator(".jelly-header-brand")).toBeVisible();
        const storefrontNavigation = preview.getByRole("navigation", { name: "Primary navigation" });
        await expect(storefrontNavigation).toBeVisible();
        await expect(storefrontNavigation.getByRole("link", { name: "Home", exact: true })).toBeVisible();
        await expect(storefrontNavigation.getByRole("link", { name: "Search", exact: true })).toBeVisible();
        if (label === "Fresh Market") {
          const headingFontSize = await preview.getByTestId("section-hero").getByRole("heading").evaluate((heading) => Number.parseFloat(getComputedStyle(heading).fontSize));
          expect(headingFontSize).toBeLessThanOrEqual(width <= 390 ? 40 : 72);
        }
        expect(await storefrontNavigation.evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(
          await preview.locator(".jelly-header").evaluate((element) => element.getBoundingClientRect().right) + 1,
        );
      for (const pageType of ["home", "product", "collection", "cart", "search", "page", "blog", "article", "not-found"] as const) {
        await page.getByLabel("Page type").selectOption(pageType);
        if (width < 1024) {
          await page.getByRole("navigation", { name: "Editor panels" }).getByRole("button", { name: "Preview" }).click();
        }
        await expect(preview.locator('[data-testid^="section-"]').first()).toBeAttached();
        if (pageType === "home") {
          await expect(preview.getByTestId("section-hero").locator("img")).toHaveAttribute("src", imageUrl);
          await expect(preview.getByRole("heading", { name: draftHeadline })).toBeVisible();
          await expect(preview.getByTestId("section-product-grid")).toBeVisible();
          expect(await preview.getByTestId("section-hero").locator("img").evaluate((image) => image.getBoundingClientRect().width)).toBeLessThanOrEqual(await preview.evaluate((element) => element.clientWidth));
          const heroMediaRatio = await preview.getByTestId("section-hero").locator(".jelly-hero-media").evaluate((media) => {
            const { width: mediaWidth, height: mediaHeight } = media.getBoundingClientRect();
            return mediaWidth / mediaHeight;
          });
          if (label === "Fresh Market") expect(heroMediaRatio).toBeGreaterThanOrEqual(width <= 700 ? 1.3 : 1.5);
        }
        if (pageType === "product") {
          const resources = page.getByLabel("Preview resource", { exact: true });
          expect(await resources.locator("option").count()).toBeGreaterThan(0);
          productName = (await resources.locator("option").first().textContent())?.trim() ?? "";
          await resources.selectOption({ index: 0 });
          await expect(preview.getByTestId("section-product-purchase").getByRole("button", { name: "Add to cart" })).toBeVisible();
          await expect(preview.getByRole("spinbutton", { name: "Quantity" })).toBeVisible();
          await expect(preview.getByTestId("section-product-information")).toContainText(/available|stock/i);
          if (label === "Fresh Market") {
            const gallery = await preview.getByTestId("section-product-gallery").boundingBox();
            const information = await preview.getByTestId("section-product-information").boundingBox();
            expect(gallery).not.toBeNull();
            expect(information).not.toBeNull();
            if (!gallery || !information) throw new Error("Product gallery and information must render in the preview");
            if (width >= 700) {
              expect(information.x).toBeGreaterThan(gallery.x);
              expect(Math.abs(information.y - gallery.y)).toBeLessThanOrEqual(8);
            } else {
              expect(information.y).toBeGreaterThanOrEqual(gallery.y + gallery.height - 1);
            }
          }
        }
        if (pageType === "collection" || pageType === "page" || pageType === "blog" || pageType === "article") {
          const resourceSelector = page.getByLabel("Preview resource", { exact: true });
          const optionLabels = await resourceSelector.locator("option").allTextContents();
          const availableResource = optionLabels.find((label) => label.trim() !== "Select resource");
          if (availableResource) {
            await resourceSelector.selectOption({ label: availableResource.trim() });
          } else {
            await expect(resourceSelector).toBeDisabled();
          }
        }
        if (pageType === "collection") {
          const labels = await page.getByLabel("Preview resource", { exact: true }).locator("option").allTextContents();
          expect(labels.some((label) => label.trim() !== "Select resource")).toBe(true);
          await expect(preview.getByTestId("section-collection-product-grid")).toBeVisible();
        }
        if (pageType === "cart") {
          await expect(preview.getByTestId("section-cart-summary")).toBeVisible();
          await expect(preview.getByText(/Your selected pieces|Subtotal/).first()).toBeVisible();
          await expect(preview.getByRole("link", { name: "Continue shopping" })).toBeVisible();
        }
        if (pageType === "search") {
          await expect(preview.getByTestId("section-search-results")).toBeVisible();
          await expect(preview.getByLabel("Search catalog")).toBeVisible();
        }
        if (pageType === "page") await expect(preview.getByTestId("section-page-content")).toBeAttached();
        if (pageType === "blog") await expect(preview.getByTestId("section-article-list")).toBeAttached();
        if (pageType === "article") await expect(preview.getByTestId("section-article-content")).toBeAttached();
        if (pageType === "not-found") {
          await expect(preview.getByTestId("section-not-found-message")).toBeVisible();
          await expect(preview.getByRole("link", { name: "Back to the shop" })).toBeVisible();
        }
      }
    }

    await page.getByLabel("Page type").selectOption("home");
    if (await page.getByRole("navigation", { name: "Editor panels" }).isVisible()) {
      await page.getByRole("navigation", { name: "Editor panels" }).getByRole("button", { name: "Preview" }).click();
    }
    const validation = page.waitForResponse((response) => response.url().endsWith("/storefront/validate") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Validate" }).click();
    expect((await validation).status()).toBe(200);
    const compilation = page.waitForResponse((response) => response.url().endsWith("/storefront/preview/compile") && response.request().method() === "POST");
    await page.locator("header").getByRole("button", { name: "Preview", exact: true }).click();
    expect((await compilation).status()).toBe(200);
    await expect(page.getByText(/Compiled preview · generation/)).toBeVisible();
    await publicPage.reload();
    await expect.poll(() => publicPage.locator("body").innerText()).toBe(publicStateBeforeDraftPreview);
    const publication = page.waitForResponse((response) => response.url().endsWith("/storefront/publish") && response.request().method() === "POST");
    await page.locator("header").getByRole("button", { name: "Publish" }).click();
    expect([200, 201]).toContain((await publication).status());

    await publicPage.reload();
    await expect(publicPage.locator(".jelly-hero img")).toHaveAttribute("src", imageUrl);
    await expect(publicPage.getByRole("heading", { name: draftHeadline })).toBeVisible();
    await expect(publicPage.getByText(productName, { exact: true }).first()).toBeVisible();
  });
}
