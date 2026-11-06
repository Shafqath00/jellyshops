import { expect, it } from "vitest";
import { resolveStorefrontThemeTokens } from "./storefront-theme-tokens";
import { resolveTheme, validateThemeSettings } from "./theme-resolver";
import { contrastRatio, legacySchemeMap, readableTextColour, resolveThemeStyleTokens, themeCustomCss, themeSocialLinks } from "./theme-style-settings";

const tokensFor = (themeId: string, settings: Record<string, unknown> = {}) => resolveStorefrontThemeTokens(themeId, resolveTheme(themeId, settings).settings);

it("keeps the theme's own sizes and buttons until the merchant changes them", () => {
  for (const id of ["jelly-signature", "jelly-avenue"]) {
    const tokens = tokensFor(id);
    expect(Object.keys(tokens).filter((key) => key.startsWith("--jelly-type-") || key.startsWith("--jelly-button-"))).toEqual([]);
    // Every scheme resolves to the theme's default colours.
    expect(tokens["--jelly-scheme-1-bg"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(tokens["--jelly-scheme-4-button-text"]).toMatch(/^#[0-9a-f]{6}$/);
  }
});

it("turns changed text styles into responsive size and style tokens", () => {
  const tokens = tokensFor("jelly-signature", { textStyles: { h2: { size: 61, lineHeight: "loose", letterSpacing: "wide", textCase: "uppercase" }, h4: { size: 24, font: "body" }, small: { size: 12 } } });
  expect(tokens["--jelly-type-h2-size"]).toBe("clamp(39px, 5.00vw, 61px)");
  expect(tokens["--jelly-type-h2-line"]).toBe("1.6");
  expect(tokens["--jelly-type-h2-tracking"]).toBe("0.04em");
  expect(tokens["--jelly-type-h2-case"]).toBe("uppercase");
  expect(tokens["--jelly-type-h4-size"]).toBe("24px");
  expect(tokens["--jelly-type-h4-font"]).toBe("var(--theme-font-body)");
  expect(tokens["--jelly-type-small-size"]).toBe("12px");
  expect(tokens["--jelly-type-h3-size"]).toBeUndefined();
});

it("uses saved colour schemes and button settings, ignoring unsafe colours", () => {
  const tokens = tokensFor("jelly-avenue", { colorSchemes: { scheme2: { background: "#123456", text: "red;}" } }, buttons: { size: "large", textCase: "uppercase", borderWidth: "thick", hover: "lift" } });
  expect(tokens["--jelly-scheme-2-bg"]).toBe("#123456");
  // The unsafe text colour falls back to the theme's (#2b2f33), which is unreadable on #123456, so it turns white.
  expect(tokens["--jelly-scheme-2-text"]).toBe("#ffffff");
  expect(tokens).toMatchObject({ "--jelly-button-height": "56px", "--jelly-button-padding": "36px", "--jelly-button-case": "uppercase", "--jelly-button-border-width": "2px", "--jelly-button-hover-transform": "translateY(-2px)" });
});

it("accepts the new settings and rejects values outside their choices", () => {
  expect(validateThemeSettings("jelly-signature", { textStyles: { h3: { size: 30, textCase: "none" } }, colorSchemes: { scheme1: { button: "#000000" } }, buttons: { hover: "underline" } })).toEqual([]);
  expect(validateThemeSettings("jelly-signature", { textStyles: { h3: { size: 500 } } })[0]?.path).toBe("textStyles.h3.size");
  expect(validateThemeSettings("jelly-avenue", { buttons: { hover: "spin" } })[0]?.path).toBe("buttons.hover");
});

it("adds field, product card and badge tokens only for changed settings", () => {
  for (const id of ["jelly-signature", "jelly-avenue"]) {
    const untouched = tokensFor(id);
    expect(Object.keys(untouched).filter((key) => /^--jelly-(field|badge)-|^--jelly-card-(radius|shadow|hover|bg)/.test(key))).toEqual([]);
    const tokens = tokensFor(id, {
      fields: { radius: "pill", borderWidth: "thick", height: "large" },
      productCard: { radius: "rounded", shadow: "soft", hover: "lift" },
      badges: { sale: "show", position: "top-left", shape: "pill", background: "#c0392b", text: "javascript:alert(1)" },
    });
    expect(tokens).toMatchObject({
      "--jelly-field-radius": "999px", "--jelly-field-border-width": "2px", "--jelly-field-height": "56px",
      "--jelly-card-radius": "16px", "--jelly-card-padding": "12px", "--jelly-card-bg": "var(--theme-surface)", "--jelly-card-hover-lift": "translateY(-4px)", "--jelly-card-hover-image": "none",
      "--jelly-badge-sale-display": "inline-block", "--jelly-badge-left": "12px", "--jelly-badge-right": "auto", "--jelly-badge-radius": "999px", "--jelly-badge-bg": "#c0392b",
    });
    expect(tokens["--jelly-badge-text"]).toBeUndefined();
    expect(validateThemeSettings(id, { fields: { height: "huge" }, badges: { sale: "yes" } }).map((issue) => issue.path)).toEqual(["badges.sale", "fields.height"]);
  }
});

it("turns the product card content settings into card tokens", () => {
  for (const id of ["jelly-signature", "jelly-avenue"]) {
    const untouched = tokensFor(id);
    expect(Object.keys(untouched).filter((key) => /--jelly-card-(media-order|price-order|title|price-display|button)/.test(key))).toEqual([]);
    const tokens = tokensFor(id, { productCard: { order: "title-price-photo", titleLines: "2", showPrice: "hide", button: "shop" } });
    expect(tokens).toMatchObject({ "--jelly-card-media-order": "1", "--jelly-card-title-display": "-webkit-box", "--jelly-card-title-lines": "2", "--jelly-card-price-display": "none", "--jelly-card-button-display": "inline-flex", "--jelly-card-button-label": '"Shop now"' });
    expect(tokensFor(id, { productCard: { showTitle: "hide", titleLines: "1", order: "photo-price-title" } })).toMatchObject({ "--jelly-card-title-display": "none", "--jelly-card-price-order": "-1" });
  }
});

it("shows savings on cards only when chosen, the amount, the percentage or both", () => {
  for (const id of ["jelly-signature", "jelly-avenue"]) {
    expect(Object.keys(tokensFor(id)).filter((key) => key.startsWith("--jelly-card-saving"))).toEqual([]);
    expect(Object.keys(tokensFor(id, { productCard: { savings: "none" } })).filter((key) => key.startsWith("--jelly-card-saving"))).toEqual([]);
    expect(tokensFor(id, { productCard: { savings: "both" } })).toMatchObject({ "--jelly-card-saving-display": "flex" });
    expect(tokensFor(id, { productCard: { savings: "amount" } })).toMatchObject({ "--jelly-card-saving-display": "flex", "--jelly-card-saving-percent-display": "none" });
    expect(tokensFor(id, { productCard: { savings: "percent" } })).toMatchObject({ "--jelly-card-saving-display": "flex", "--jelly-card-saving-amount-display": "none" });
  }
});

it("lists only https social links from theme settings, in footer order", () => {
  expect(themeSocialLinks({ social: { youtube: "https://youtube.com/@shop", instagram: " https://instagram.com/shop ", facebook: "http://facebook.com/shop", x: "javascript:alert(1)" } })).toEqual([
    { id: "instagram", label: "Instagram", href: "https://instagram.com/shop" },
    { id: "youtube", label: "YouTube", href: "https://youtube.com/@shop" },
  ]);
  expect(themeSocialLinks(undefined)).toEqual([]);
});

it("scopes theme custom CSS to the store and refuses unsafe CSS on save", () => {
  expect(themeCustomCss({ advanced: { customCss: "h2 { color: red } & { --x: 1 }" } })).toBe("[data-jelly-theme] h2{color: red}\n[data-jelly-theme]{--x: 1}");
  expect(themeCustomCss({ advanced: { customCss: "@import url(https://x.test/a.css);" } })).toBeNull();
  for (const id of ["jelly-signature", "jelly-avenue"]) {
    expect(validateThemeSettings(id, { advanced: { customCss: "p { color: red }" } })).toEqual([]);
    expect(validateThemeSettings(id, { advanced: { customCss: "p { color: red } </style>" } })).toEqual([{ path: "advanced.customCss", message: "Custom CSS: CSS can't contain the < character." }]);
    expect(validateThemeSettings(id, { advanced: { customCss: "p{}".repeat(4000) } })[0]?.message).toMatch(/at most 10000/);
  }
});

it("maps the older Page / Soft / Dark choices to each theme's own schemes", () => {
  const minimal = tokensFor("jelly-signature");
  expect([minimal["--jelly-scheme-page-bg"], minimal["--jelly-scheme-soft-bg"], minimal["--jelly-scheme-dark-bg"]]).toEqual(["var(--jelly-scheme-1-bg)", "var(--jelly-scheme-2-bg)", "var(--jelly-scheme-4-bg)"]);
  const avenue = tokensFor("jelly-avenue");
  expect(avenue["--jelly-scheme-dark-text"]).toBe("var(--jelly-scheme-3-text)");
  expect(legacySchemeMap(undefined)).toBeUndefined();
  // A theme without schemes: Dark swaps the theme's text and background.
  const plain = resolveThemeStyleTokens({}, undefined);
  expect(plain["--jelly-scheme-dark-bg"]).toBe("var(--theme-text, #1a1a1a)");
  expect(plain["--jelly-scheme-dark-text"]).toBe("var(--theme-background, #ffffff)");
});

it("keeps scheme text readable (contrast fallback)", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  expect(readableTextColour("#777777", "#ffffff")).toBe("#111111");
  expect(readableTextColour("#cccccc", "#1c1b19")).toBe("#cccccc");
  expect(readableTextColour("#333333", "#222222")).toBe("#ffffff");
  expect(readableTextColour("var(--theme-text)", "#ffffff")).toBe("var(--theme-text)");
  const tokens = tokensFor("jelly-avenue", { colorSchemes: { scheme2: { background: "#ffffff", text: "#eeeeee", button: "#222222", buttonText: "#333333" } } });
  expect(tokens["--jelly-scheme-2-text"]).toBe("#111111");
  expect(tokens["--jelly-scheme-2-button-text"]).toBe("#ffffff");
  // The themes' own schemes are readable as they are.
  for (const id of ["jelly-signature", "jelly-avenue"]) {
    const own = tokensFor(id);
    for (const n of [1, 2, 3, 4]) expect(contrastRatio(own[`--jelly-scheme-${n}-text`], own[`--jelly-scheme-${n}-bg`])).toBeGreaterThanOrEqual(4.5);
  }
});
