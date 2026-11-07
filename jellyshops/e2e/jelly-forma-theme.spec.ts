import { expect, test } from "@playwright/test";
import { axeOnStyledCopy, describeViolations } from "./fixtures/styled-copy";
import { resolveStorefrontThemeTokens, resolveTheme } from "@jelly/storefront-themes";

const frameTitle = "Jelly Forma style guide";

test("reference composition: compact home and continuous purchase column", async ({ page }) => {
  const views = page.getByRole("group", { name: "Page" });
  const frame = page.frameLocator(`iframe[title='${frameTitle}']`);
  await views.getByRole("button", { name: "Home", exact: true }).click();
  const hero = await frame.locator(".jelly-hero > .jelly-container").boundingBox();
  const origin = await page.locator("iframe").boundingBox();
  expect(hero!.y - origin!.y, "desktop hero top").toBeLessThanOrEqual(360);
  expect(hero!.height, "desktop landscape hero").toBeLessThanOrEqual(520);
  await page.getByRole("group", { name: "Preview width" }).getByRole("button", { name: /^Mobile/ }).click();
  await page.locator("iframe").evaluate(el => { el.style.height = "844px"; });
  const phoneOrigin = await page.locator("iframe").boundingBox();
  const phoneHero = await frame.locator(".jelly-hero > .jelly-container").boundingBox();
  const action = await frame.locator(".jelly-hero .jelly-button").boundingBox();
  expect(phoneHero!.y - phoneOrigin!.y, "phone hero top").toBeLessThanOrEqual(300);
  expect(action!.y + action!.height - phoneOrigin!.y, "phone action stays in first screen").toBeLessThanOrEqual(820);
  await page.getByRole("group", { name: "Preview width" }).getByRole("button", { name: /^Desktop/ }).click();
  await views.getByRole("button", { name: "Product", exact: true }).click();
  await expect(frame.getByRole("group", { name: "Product photos" })).toBeVisible();
  const options = await frame.locator(".jelly-product-options").boundingBox();
  const information = await frame.locator(".jelly-product-information").boundingBox();
  const purchase = await frame.locator(".jelly-product-purchase").boundingBox();
  expect(options!.y - information!.y - information!.height, "details to options gap").toBeLessThanOrEqual(24);
  expect(purchase!.y - options!.y - options!.height, "options to purchase gap").toBeLessThanOrEqual(24);
  await test.info().attach("composition.json", { contentType: "application/json", body: JSON.stringify({ desktopHeroTop: hero!.y - origin!.y, desktopHeroHeight: hero!.height, phoneHeroTop: phoneHero!.y - phoneOrigin!.y, phoneActionBottom: action!.y + action!.height - phoneOrigin!.y, detailsToOptionsGap: options!.y - information!.y - information!.height, optionsToPurchaseGap: purchase!.y - options!.y - options!.height }, null, 2) });
});

test("tablet and phone: compact header and continuous purchase column", async ({ page }) => {
  const views = page.getByRole("group", { name: "Page" });
  const widths = page.getByRole("group", { name: "Preview width" });
  const frame = page.frameLocator(`iframe[title='${frameTitle}']`);
  await views.getByRole("button", { name: "Product", exact: true }).click();
  for (const device of ["Tablet", "Mobile"]) {
    await widths.getByRole("button", { name: new RegExp(`^${device}`) }).click();
    // Header: menu button, logo and icons on one row, search below; the desktop menu never wraps.
    const header = await frame.locator(".jelly-header").boundingBox();
    expect(header!.height, `${device} header height`).toBeLessThan(160);
    await expect(frame.locator(".jelly-mobile-navigation > summary")).toBeVisible();
    await expect(frame.locator(".jelly-header > nav:not(.jelly-header-tools)")).toBeHidden();
    const brand = await frame.locator(".jelly-header-brand").boundingBox();
    expect(brand!.height, `${device} logo on one line`).toBeLessThan(56);
    const search = await frame.locator(".jelly-header-search").boundingBox();
    expect(search!.width, `${device} search width`).toBeGreaterThan(header!.width * 0.8);
    // Product parts stay together instead of each taking a full section's spacing.
    const information = await frame.locator(".jelly-product-information").boundingBox();
    const options = await frame.locator(".jelly-product-options").boundingBox();
    const purchase = await frame.locator(".jelly-product-purchase").boundingBox();
    expect(options!.y - information!.y - information!.height, `${device} details to options gap`).toBeLessThanOrEqual(24);
    expect(purchase!.y - options!.y - options!.height, `${device} options to purchase gap`).toBeLessThanOrEqual(24);
    const gallery = await frame.locator(".jelly-product-gallery").boundingBox();
    if (device === "Tablet") expect(information!.x, "tablet details beside the gallery").toBeGreaterThan(gallery!.x + gallery!.width - 1);
    else expect(information!.y - gallery!.y - gallery!.height, "phone gallery to details gap").toBeLessThanOrEqual(40);
  }
  await frame.locator(".jelly-mobile-navigation > summary").click();
  await expect(frame.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
});
test("polish: page titles, footer, cards, cart, newsletter and FAQ", async ({ page }) => {
  const views = page.getByRole("group", { name: "Page" });
  const widths = page.getByRole("group", { name: "Preview width" });
  const frame = page.frameLocator(`iframe[title='${frameTitle}']`);
  const fontSize = (locator: ReturnType<typeof frame.locator>) => locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  // Page titles use one calm size, not the hero size.
  for (const view of ["Collection", "Cart", "Search", "Page", "404"]) {
    await views.getByRole("button", { name: view, exact: true }).click();
    expect(await fontSize(frame.locator("main h1").first()), `${view} title size`).toBeLessThanOrEqual(44);
  }
  // Footer: small column headings, several columns, divider across the whole footer.
  const headings = frame.locator(".jelly-footer-column h2");
  expect(await headings.count(), "footer link columns").toBeGreaterThanOrEqual(2);
  for (const size of await headings.evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)))) expect(size, "footer heading size").toBeLessThanOrEqual(20);
  const footer = await frame.locator(".jelly-footer-inner").boundingBox();
  const credit = await frame.locator(".jelly-footer-credit").boundingBox();
  expect(credit!.width, "footer divider width").toBeGreaterThan(footer!.width * 0.95);
  // Product card buttons in one row line up, even when one card shows colour swatches.
  await views.getByRole("button", { name: "Collection", exact: true }).click();
  const buttonTops = await frame.locator(".jelly-product-card-button").evaluateAll((els) => els.slice(0, 3).map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(buttonTops).size, `card buttons share one row: ${buttonTops}`).toBe(1);
  // Cart: one pill stepper, Remove and Continue shopping are quiet links.
  await views.getByRole("button", { name: "Cart", exact: true }).click();
  const stepper = frame.locator(".jelly-cart-line .jelly-quantity-stepper").first();
  expect((await stepper.boundingBox())!.height, "cart stepper height").toBeLessThanOrEqual(48);
  expect(await stepper.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius)), "cart stepper is a pill").toBeGreaterThan(20);
  for (const name of ["Remove", "Continue shopping"]) {
    const background = await frame.getByRole(name === "Remove" ? "button" : "link", { name, exact: true }).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background, `${name} has no filled background`).toBe("rgba(0, 0, 0, 0)");
  }
  await expect(frame.locator(".jelly-cart-totals dd")).toHaveText(/£1,197\.00/);
  // Home: email and Subscribe on one row, a drawn checkbox, FAQ with a theme icon.
  await views.getByRole("button", { name: "Home", exact: true }).click();
  const email = await frame.locator(".jelly-newsletter input[type=email]").boundingBox();
  const subscribe = await frame.locator(".jelly-newsletter button[type=submit]").boundingBox();
  expect(Math.abs(email!.y + email!.height - (subscribe!.y + subscribe!.height)), "email and Subscribe share a row").toBeLessThanOrEqual(8);
  expect((await frame.locator(".jelly-newsletter input[type=checkbox]").boundingBox())!.width, "checkbox size").toBeLessThanOrEqual(24);
  const summary = frame.locator(".jelly-faq summary").first();
  expect(await summary.evaluate((el) => getComputedStyle(el, "::after").content)).toBe('"+"');
  expect(await summary.evaluate((el) => getComputedStyle(el).display)).toBe("flex");
  // Tablet: three feature columns side by side (no 2 + 1).
  await widths.getByRole("button", { name: /^Tablet/ }).click();
  const columnTops = await frame.locator(".jelly-multicolumn-grid > *").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(columnTops).size, `tablet feature columns: ${columnTops}`).toBe(1);
});

const pages = [
  ["Home", "Soft living"],
  ["Collection", "Furniture for everyday living"],
  ["Product", "Everyday timber stool"],
  ["Cart", "Your bag"],
  ["Search", "2 results for"],
  ["Page", "Made for your everyday"],
  ["404", "We can't find that page"],
] as const;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/theme-preview/jelly-forma");
  await expect(page.frameLocator("iframe").getByRole("heading", { name: "Jelly Forma", exact: true, level: 1 })).toBeVisible();
});

for (const [tab, text] of pages) {
  test(`${tab}: responsive layout and accessibility`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.getByRole("group", { name: "Page" }).getByRole("button", { name: tab, exact: true }).click();
    const frame = page.frameLocator(`iframe[title='${frameTitle}']`);
    for (const device of ["Desktop", "Tablet", "Mobile"]) {
      await page.getByRole("group", { name: "Preview width" }).getByRole("button", { name: new RegExp(`^${device}`) }).click();
      // The platform's tablet preset is 768px; also cover the brief's 820px reference.
      if (device === "Tablet") await page.locator("iframe").evaluate(element => { element.parentElement!.style.width = "820px"; });
      await expect(frame.locator("main").getByText(text).first()).toBeVisible();
      expect(await frame.locator("html").evaluate(html => html.scrollWidth - html.clientWidth)).toBeLessThanOrEqual(0);
      const brokenImages = await frame.locator("main img").evaluateAll(images => images.filter(image => (image as HTMLImageElement).complete && !(image as HTMLImageElement).naturalWidth).map(image => image.getAttribute("src")));
      expect(brokenImages).toEqual([]);
      if (tab === "Home" && device === "Mobile") {
        const header = await frame.locator(".jelly-header").boundingBox();
        expect(header!.height).toBeLessThan(160);
        await frame.locator(".jelly-mobile-navigation > summary").click();
        await expect(frame.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
        await frame.locator(".jelly-mobile-navigation > summary").click();
      }
      if ((tab === "Home" || tab === "Product") && device !== "Tablet") {
        await page.locator("iframe").screenshot({ path: test.info().outputPath(`${tab}-${device}.png`) });
      }
    }
    expect(describeViolations(await axeOnStyledCopy(page, frameTitle, { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] }))).toEqual([]);
  });
}

test("navigation, product options and cart quantities work", async ({ page }) => {
  const views = page.getByRole("group", { name: "Page" });
  await views.getByRole("button", { name: "Home", exact: true }).click();
  const frame = page.frameLocator(`iframe[title='${frameTitle}']`);
  await frame.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name: /Shop by room/ }).click();
  await expect(frame.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Living room" })).toHaveAttribute("href", "/preview/search?q=sofa");
  await views.getByRole("button", { name: "Product", exact: true }).click();
  await frame.getByRole("button", { name: "Natural oak", exact: true }).click();
  await expect(frame.getByRole("button", { name: "Natural oak", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Preview mode deliberately prevents purchases; live commerce is exercised by conformance.
  await expect(frame.getByRole("button", { name: "Add to cart", exact: true }).first()).toBeDisabled();
  await frame.getByRole("button", { name: "Increase quantity", exact: true }).click();
  await expect(frame.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2");
  await views.getByRole("button", { name: "Cart", exact: true }).click();
  const summary = frame.getByRole("complementary", { name: "Order summary" });
  await expect(summary).toContainText("£1,197.00");
  await frame.getByRole("button", { name: "Increase quantity of Everyday timber stool" }).click();
  await expect(summary).toContainText("£1,346.00");
});

test("merchant typography, button, field and card tokens reach the rendered components", async ({ page }) => {
  await page.getByRole("group", { name: "Page" }).getByRole("button", { name: "Home", exact: true }).click();
  const settings = structuredClone(resolveTheme("jelly-forma").settings) as Record<string, unknown>;
  const changed = { ...settings, typography: { ...settings.typography as object, bodyFont: "Arial", bodyWeight: 700 }, textStyles: { ...settings.textStyles as object, h1: { font: "body", lineHeight: "loose", letterSpacing: "wide", textCase: "uppercase" } }, buttons: { ...settings.buttons as object, size: "large", textCase: "uppercase", borderWidth: "thick" }, fields: { radius: "square", height: "large", borderWidth: "thick" }, productCard: { ...settings.productCard as object, alignment: "center", style: "bordered", order: "title-price-photo", hover: "lift" } };
  const frame = page.frameLocator(`iframe[title='${frameTitle}']`);
  await frame.locator("[data-jelly-theme]").evaluate((root, tokens) => { for (const [key, value] of Object.entries(tokens)) (root as HTMLElement).style.setProperty(key, value); }, resolveStorefrontThemeTokens("jelly-forma", changed));
  await expect(frame.locator(".jelly-hero h1")).toHaveCSS("text-transform", "uppercase");
  await expect(frame.locator(".jelly-hero h1")).toHaveCSS("font-family", /Arial/);
  await expect(frame.locator(".jelly-hero .jelly-button")).toHaveCSS("border-top-width", "2px");
  await expect(frame.locator(".jelly-hero .jelly-button")).toHaveCSS("text-transform", "uppercase");
  await expect(frame.locator("input[type='email']")).toHaveCSS("border-radius", "0px");
  await expect(frame.locator("input[type='email']")).toHaveCSS("min-height", "56px");
  await expect(frame.locator(".jelly-product-card > a").first()).toHaveCSS("text-align", "center");
  await expect(frame.locator(".jelly-product-card > a").first()).toHaveCSS("border-top-width", "1px");
  await expect(frame.locator(".jelly-product-card > a").first()).toHaveCSS("display", "flex");
  await expect(frame.locator(".jelly-product-card-media").first()).toHaveCSS("order", "1");
  await expect(frame.locator(".jelly-product-card-price").first()).toHaveCSS("justify-content", "center");
  await expect(frame.locator("[data-jelly-theme]")).toHaveCSS("font-weight", "700");
  const button = frame.locator(".jelly-hero .jelly-button");
  await button.evaluate(element => { element.classList.add("jelly-button--secondary"); element.closest("[data-scheme]")!.setAttribute("data-scheme", "scheme1"); });
  await button.hover();
  const colours = await button.evaluate(element => { const style = getComputedStyle(element); return [style.color, style.backgroundColor]; });
  expect(colours[0]).not.toBe(colours[1]);
});

test("section layout attributes support alternate hero and image-with-text settings", async ({ page }) => {
  await page.getByRole("group", { name: "Page" }).getByRole("button", { name: "Home", exact: true }).click();
  const frame = page.frameLocator(`iframe[title='${frameTitle}']`);
  const hero = frame.locator(".jelly-hero");
  await hero.evaluate(element => { element.setAttribute("data-layout", "split"); element.setAttribute("data-height", "medium"); });
  await expect(hero.locator(".jelly-hero-media")).toHaveCSS("position", "relative");
  const medium = await hero.locator(".jelly-container").evaluate(element => parseFloat(getComputedStyle(element).minHeight));
  await hero.evaluate(element => element.setAttribute("data-height", "large"));
  const large = await hero.locator(".jelly-container").evaluate(element => parseFloat(getComputedStyle(element).minHeight));
  expect(large).toBeGreaterThan(medium);
  const story = frame.locator(".jelly-image-text");
  await story.evaluate(element => element.setAttribute("data-image-position", "right"));
  await expect(story.locator(".jelly-image-text-media")).toHaveCSS("order", "1");
  await story.evaluate(element => { element.classList.remove("has-image"); element.querySelector(".jelly-image-text-media")?.remove(); });
  const columns = await story.locator(".jelly-image-text-layout").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(1);
  await page.getByRole("group", { name: "Preview width" }).getByRole("button", { name: /^Mobile/ }).click();
  await hero.evaluate(element => element.setAttribute("data-height", "medium"));
  const phoneMedium = await hero.locator(".jelly-container").evaluate(element => parseFloat(getComputedStyle(element).minHeight));
  await hero.evaluate(element => element.setAttribute("data-height", "large"));
  expect(await hero.locator(".jelly-container").evaluate(element => parseFloat(getComputedStyle(element).minHeight))).toBeGreaterThan(phoneMedium);
});
