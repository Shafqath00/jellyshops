import { describe, expect, it } from "vitest";
import { buildSeoChecks, seoGrade, seoScore, setupChecklist, setupProgress, sortSeoChecks, storeSeoChecks } from "./seo-health.js";
import { defaultStorePreferences, type StorePreferences } from "./store-preferences-read.js";

const prefs = (patch: (p: StorePreferences) => void = () => undefined) => { const p = defaultStorePreferences(); patch(p); return p; };
const allPublished = { refund: "published", privacy: "published", terms: "published", shipping: "published" } as const;

describe("SEO health", () => {
  it("flags the store's own gaps and passes once they are filled", () => {
    const failing = (p: StorePreferences) => storeSeoChecks(p).filter((c) => c.count > 0).map((c) => c.id);
    expect(failing(prefs())).toEqual(["store-description", "store-title", "store-share-image", "store-favicon", "store-search-console"]);
    expect(failing(prefs((p) => { p.seo.allowIndexing = false; p.seo.structuredData.products = false; }))).toEqual(expect.arrayContaining(["store-indexing", "store-structured-products"]));
    const done = prefs((p) => {
      p.seo.homeTitle = "Beds | Harbour"; p.seo.homeDescription = "Oak beds."; p.seo.searchConsoleToken = "abcdefghij1";
      p.seo.socialImage = { mediaId: "m", url: "/x", width: 1200, height: 630, alt: "" }; p.seo.favicon = { mediaId: "f", url: "/y", width: 64, height: 64, alt: "" };
    });
    expect(failing(done)).toEqual([]);
    expect(seoScore(buildSeoChecks(storeSeoChecks(done)))).toBe(100);
  });

  it("writes plain wording with the numbers and leaves out checks that examined nothing", () => {
    const checks = buildSeoChecks([
      { id: "product-no-description", total: 12, count: 1, items: [{ kind: "product", id: "p", label: "Pine bed" }] },
      { id: "product-no-photo", total: 12, count: 3, items: [] },
      { id: "page-no-description", total: 0, count: 0, items: [] },
      { id: "made-up-check", total: 5, count: 5, items: [] },
    ]);
    expect(checks.map((c) => c.title)).toEqual(["1 product has no description", "3 products have no photo"]);
    expect(checks[0]).toMatchObject({ severity: "problem", fix: { href: "/admin/settings/preferences/seo" } });
  });

  it("scores by the share of things affected, so one bad product costs less than all of them", () => {
    const one = buildSeoChecks([{ id: "product-no-description", total: 100, count: 1, items: [] }]);
    const all = buildSeoChecks([{ id: "product-no-description", total: 100, count: 100, items: [] }]);
    expect(seoScore(one)).toBe(99);
    expect(seoScore(all)).toBe(0);
    expect(seoScore([])).toBe(100);
    expect([95, 80, 60, 20].map((n) => seoGrade(n).label)).toEqual(["Great", "Good", "Needs work", "Poor"]);
  });

  it("lists problems before tips, biggest first", () => {
    const sorted = sortSeoChecks(buildSeoChecks([
      { id: "store-favicon", total: 1, count: 1, items: [] },
      { id: "product-no-photo", total: 10, count: 2, items: [] },
      { id: "product-no-description", total: 10, count: 2, items: [] },
    ]));
    expect(sorted.map((c) => c.id)).toEqual(["product-no-description", "product-no-photo", "store-favicon"]);
  });
});

describe("setup checklist", () => {
  it("starts with the basics undone and counts only required items in the progress", () => {
    const items = setupChecklist(prefs(), { contactEmail: null, policies: { refund: "unset", privacy: "unset", terms: "unset", shipping: "unset" } });
    const progress = setupProgress(items);
    expect(progress.done).toBe(0);
    expect(progress.total).toBe(items.filter((i) => !i.optional).length);
    expect(items.find((i) => i.id === "policy-shipping")?.optional).toBe(true);
    expect(items.find((i) => i.id === "policy-privacy")?.help).toMatch(/starter wording/);
  });

  it("marks things done as they are filled in, and explains a draft policy", () => {
    const filled = prefs((p) => {
      p.business.legalName = "Harbour Home Ltd"; p.business.address = { line1: "1 Quay St", line2: "", city: "Bristol", region: "", postalCode: "BS1", country: "GB" };
      p.seo.homeTitle = "Beds"; p.seo.homeDescription = "Oak beds."; p.social.instagram = "https://instagram.com/harbour";
    });
    const items = setupChecklist(filled, { contactEmail: "hi@harbour.test", policies: { ...allPublished, refund: "draft" } });
    const done = (id: string) => items.find((i) => i.id === id)?.done;
    expect([done("contact-email"), done("legal-name"), done("address"), done("home-listing"), done("social"), done("policy-privacy"), done("policy-refund")]).toEqual([true, true, true, true, true, true, false]);
    expect(items.find((i) => i.id === "policy-refund")?.help).toMatch(/still a draft/);
  });

  it("turns tracking without a cookie banner into a task", () => {
    const risky = prefs((p) => { p.tracking.googleAnalyticsId = "G-AB12CD34EF"; p.privacy.cookieBanner = "off"; });
    const context = { contactEmail: null, policies: allPublished };
    expect(setupChecklist(risky, context).find((i) => i.id === "cookie-banner")).toMatchObject({ done: false, optional: false });
    expect(setupChecklist(prefs(), context).some((i) => i.id === "cookie-banner")).toBe(false);
    expect(setupChecklist(prefs((p) => { p.tracking.googleAnalyticsId = "G-AB12CD34EF"; }), context).some((i) => i.id === "cookie-banner")).toBe(false);
  });
});
