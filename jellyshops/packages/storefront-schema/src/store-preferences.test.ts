import { describe, expect, it } from "vitest";
import { defaultStorePreferences, fillTitleTemplate, readStorePreferences, seoTitleFor, unknownTemplateTokens } from "./store-preferences-read.js";
import { changedPreferenceSections, validateStorePreferences } from "./store-preferences.js";
import { createsRedirectLoop, normaliseRedirectFrom, normaliseRedirectTo, redirectProblem } from "./url-redirects.js";

const valid = () => defaultStorePreferences();

describe("store preferences schema", () => {
  it("accepts the defaults", () => {
    expect(validateStorePreferences(valid()).ok).toBe(true);
  });

  it("refuses a homepage title over 70 characters with a plain message", () => {
    const prefs = valid();
    prefs.seo.homeTitle = "x".repeat(71);
    const result = validateStorePreferences(prefs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toEqual([{ path: "seo.homeTitle", message: "Homepage title can be up to 70 characters." }]);
  });

  it("refuses angle brackets so nothing can break out of a tag", () => {
    const prefs = valid();
    prefs.seo.homeDescription = "</title><script>alert(1)</script>";
    expect(validateStorePreferences(prefs).ok).toBe(false);
  });

  it("only accepts tracking ids in their exact shape", () => {
    for (const [field, good, bad] of [
      ["googleAnalyticsId", "G-AB12CD34EF", "UA-1234-1"],
      ["googleTagManagerId", "GTM-ABC1234", "GTM-abc'); alert(1)//"],
      ["metaPixelId", "123456789012345", "12345abc"],
    ] as const) {
      const prefs = valid();
      prefs.tracking[field] = good;
      expect(validateStorePreferences(prefs).ok, good).toBe(true);
      prefs.tracking[field] = bad;
      expect(validateStorePreferences(prefs).ok, bad).toBe(false);
    }
  });

  it("checks social links belong to their platform and use https", () => {
    const prefs = valid();
    prefs.social.instagram = "https://www.instagram.com/harbour";
    expect(validateStorePreferences(prefs).ok).toBe(true);
    prefs.social.instagram = "https://evil.example/instagram.com";
    expect(validateStorePreferences(prefs).ok).toBe(false);
    prefs.social.instagram = "javascript:alert(1)";
    expect(validateStorePreferences(prefs).ok).toBe(false);
  });

  it("refuses unknown words and unknown fields", () => {
    const prefs = valid();
    prefs.seo.titleTemplates.product = "{product name} | {price}";
    const result = validateStorePreferences(prefs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0].message).toBe("{price} isn't a word this template can use.");
    expect(validateStorePreferences({ ...valid(), extra: true }).ok).toBe(false);
  });

  it("lists the sections that changed", () => {
    const after = valid();
    after.tracking.metaPixelId = "123456789";
    after.business.phone = "+44 20 7946 0000";
    expect(changedPreferenceSections(valid(), after)).toEqual(["business", "tracking"]);
  });
});

describe("reading stored preferences", () => {
  it("falls back to defaults for missing or broken parts", () => {
    const read = readStorePreferences({ seo: { homeTitle: "Beds", favicon: { mediaId: "m", url: "javascript:x" } }, tracking: { googleAnalyticsId: "<script>" } });
    expect(read.seo.homeTitle).toBe("Beds");
    expect(read.seo.favicon).toBeNull();
    expect(read.tracking.googleAnalyticsId).toBe("");
    expect(read.seo.titleTemplates.product).toBe("{product name} | {store name}");
    expect(readStorePreferences(null)).toEqual(defaultStorePreferences());
  });
});

describe("title templates", () => {
  it("fills words and drops separators around empty ones", () => {
    expect(fillTitleTemplate("{product name} | {brand} | {store name}", { "product name": "Oak bed", brand: "", "store name": "Harbour" })).toBe("Oak bed | Harbour");
    expect(fillTitleTemplate("{Product Name} - {store name}", { "product name": "Oak bed", "store name": "Harbour" })).toBe("Oak bed - Harbour");
  });
  it("lets a page's own SEO title win", () => {
    expect(seoTitleFor("page", valid(), { "page title": "About", "store name": "Harbour" })).toBe("About | Harbour");
    expect(seoTitleFor("page", valid(), { "page title": "About" }, "Our story")).toBe("Our story");
  });
  it("knows which words each kind can use", () => {
    expect(unknownTemplateTokens("collection", "{collection name} {product name}")).toEqual(["product name"]);
  });
});

describe("redirect rules", () => {
  it("normalises old addresses", () => {
    expect(normaliseRedirectFrom("old-page/")).toBe("/old-page");
    expect(normaliseRedirectFrom("https://harbour.jellyshop.io/a//b/?x=1#top", ["harbour.jellyshop.io"])).toBe("/a/b?x=1");
    expect(normaliseRedirectFrom("https://other.example/a", ["harbour.jellyshop.io"])).toBeNull();
  });
  it("only sends shoppers to store paths or https addresses", () => {
    expect(normaliseRedirectTo("collections/beds")).toBe("/collections/beds");
    expect(normaliseRedirectTo("http://example.com")).toBeNull();
    expect(normaliseRedirectTo("//evil.example")).toBeNull();
    expect(normaliseRedirectTo("javascript:alert(1)")).toBe("/javascript:alert(1)");
  });
  it("explains problems in plain words", () => {
    expect(redirectProblem("/", "/new")).toMatch(/always a page/);
    expect(redirectProblem("/checkout/abc", "/new")).toMatch(/always a page/);
    expect(redirectProblem("/a", "/a")).toMatch(/same/);
    expect(redirectProblem("/old", "/new")).toBeNull();
  });
  it("spots loops", () => {
    const existing = new Map([["/b", "/c"], ["/c", "/a"]]);
    expect(createsRedirectLoop(existing, "/a", "/b")).toBe(true);
    expect(createsRedirectLoop(existing, "/x", "/b")).toBe(false);
  });
});
