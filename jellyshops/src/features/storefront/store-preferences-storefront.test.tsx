import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultStorePreferences, type StorePreferences } from "@jelly/storefront-schema";
import { classifyHost } from "@/lib/hosts";
import { contentSecurityPolicy } from "@/lib/security-headers";
import { consentRequiredFor } from "./consent-regions";
import { policyLinks, storeSocialLinks } from "./policy-links";
import { robotsTxt, sitemapEntries, sitemapXml } from "./store-crawl-files";
import { breadcrumbData, jsonLd, organizationData, pageTitle, robotsFor, storeMetadata } from "./store-seo";
import { StorePrivacy, readConsent, safeTracking } from "./components/store-privacy";

vi.mock("next/navigation", () => ({ usePathname: () => "/harbour" }));

const prefs = (patch: (p: StorePreferences) => void = () => undefined) => { const p = defaultStorePreferences(); patch(p); return p; };
const store = { name: "Harbour", slug: "harbour", description: "Welcome to Harbour." };

describe("store metadata", () => {
  it("uses the homepage title, description, sharing image, icon and Search Console code", () => {
    const meta = storeMetadata(prefs((p) => {
      p.seo.homeTitle = "Oak beds | Harbour"; p.seo.homeDescription = "Solid oak beds.";
      p.seo.socialImage = { mediaId: "m1", url: "https://img.example/share.jpg", width: 1200, height: 630, alt: "Showroom" };
      p.seo.favicon = { mediaId: "m2", url: "https://img.example/icon.png", width: 192, height: 192, alt: "" };
      p.seo.searchConsoleToken = "abcdefghij123";
    }), store, "https://img.example/product.jpg");
    expect(meta.title).toBe("Oak beds | Harbour");
    expect(meta.description).toBe("Solid oak beds.");
    expect(meta.openGraph).toMatchObject({ images: [{ url: "https://img.example/share.jpg", width: 1200, height: 630, alt: "Showroom" }] });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.icons).toMatchObject({ icon: [{ url: "https://img.example/icon.png", sizes: "192x192" }] });
    expect(meta.verification).toEqual({ google: "abcdefghij123" });
    expect(meta.robots).toBeUndefined();
  });
  it("falls back to the store name and a product photo, and hides the store when asked", () => {
    const meta = storeMetadata(prefs((p) => { p.seo.allowIndexing = false; }), store, "https://img.example/product.jpg");
    expect(meta.title).toBe("Harbour");
    expect(meta.openGraph).toMatchObject({ images: [{ url: "https://img.example/product.jpg" }] });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(robotsFor(prefs(), true)).toEqual({ index: false, follow: true });
  });
  it("fills page titles from templates unless the page has its own", () => {
    const p = prefs((x) => { x.seo.titleTemplates.product = "{product name} | {brand} | {store name}"; });
    expect(pageTitle("product", p, { "product name": "Oak bed", brand: "", "store name": "Harbour" })).toBe("Oak bed | Harbour");
    expect(pageTitle("product", p, { "product name": "Oak bed", brand: "Harbour Home", "store name": "Harbour" })).toBe("Oak bed | Harbour Home | Harbour");
    expect(pageTitle("product", p, { "product name": "Oak bed" }, "Custom title")).toBe("Custom title");
  });
});

describe("structured data", () => {
  it("never lets a value close the script tag", () => {
    expect(jsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
  it("describes the business with its contact details and social pages", () => {
    const data = organizationData(prefs((p) => {
      p.business.legalName = "Harbour Home Ltd"; p.business.phone = "+44 20 7946 0000";
      p.business.address = { line1: "1 Quay St", line2: "", city: "Bristol", region: "", postalCode: "BS1 1AA", country: "GB" };
      p.social.instagram = "https://instagram.com/harbour";
    }), { name: "Harbour", slug: "harbour" }, new URL("https://harbour.jellyshop.io"));
    expect(data).toMatchObject({ "@type": "Organization", legalName: "Harbour Home Ltd", telephone: "+44 20 7946 0000", sameAs: ["https://instagram.com/harbour"], address: { addressLocality: "Bristol", postalCode: "BS1 1AA", addressCountry: "GB" } });
  });
  it("lists breadcrumbs in order with full addresses", () => {
    const data = breadcrumbData([{ name: "Harbour", path: "/harbour" }, { name: "Beds", path: "/harbour/collections/beds" }], new URL("https://jellyshop.io"));
    expect(data.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Harbour", item: "https://jellyshop.io/harbour" },
      { "@type": "ListItem", position: 2, name: "Beds", item: "https://jellyshop.io/harbour/collections/beds" },
    ]);
  });
});

describe("sitemap and robots", () => {
  const base = new URL("https://jellyshop.io");
  const input = {
    slug: "harbour", base, preferences: prefs(),
    products: [{ slug: "oak-bed", published: true, archived: false }, { slug: "draft", published: false, archived: false }],
    collections: [{ slug: "beds" }],
    navigation: [
      { kind: "page" as const, id: "p1", handle: "about", updatedAt: "2026-11-20T10:00:00.000Z" },
      { kind: "page" as const, id: "p2", handle: "secret", noindex: true },
      { kind: "article" as const, id: "a1", handle: "first", blogHandle: "news" },
    ],
  };
  it("lists published pages with full addresses and leaves hidden ones out", () => {
    expect(sitemapEntries(input).map((entry) => entry.loc)).toEqual([
      "https://jellyshop.io/harbour", "https://jellyshop.io/harbour/collections/beds", "https://jellyshop.io/harbour/products/oak-bed",
      "https://jellyshop.io/harbour/about", "https://jellyshop.io/harbour/blogs/news/first",
    ]);
    expect(sitemapXml(input)).toContain("<lastmod>2026-11-20</lastmod>");
    expect(sitemapEntries({ ...input, preferences: prefs((p) => { p.seo.allowIndexing = false; }) })).toEqual([]);
  });
  it("keeps shopping pages out, points to the sitemap, and closes a private store", () => {
    const text = robotsTxt({ slug: "harbour", base, preferences: prefs(), protected: false });
    expect(text).toContain("Disallow: /harbour/checkout");
    expect(text).toContain("Sitemap: https://jellyshop.io/harbour/sitemap.xml");
    expect(robotsTxt({ slug: "harbour", base, preferences: prefs(), protected: true })).toBe("User-agent: *\nDisallow: /harbour\n");
  });
  it("routes each shop's sitemap and robots.txt to the shop, not the main site", () => {
    expect(classifyHost({ host: "harbour.jellyshop.io", path: "/sitemap.xml" })).toMatchObject({ kind: "shop", path: "/sites/harbour/sitemap.xml" });
    expect(classifyHost({ host: "harbour.jellyshop.io", path: "/robots.txt" })).toMatchObject({ kind: "shop", path: "/sites/harbour/robots.txt" });
    expect(classifyHost({ host: "harbour.jellyshop.io", path: "/logo.png" })).toEqual({ kind: "pass" });
    expect(classifyHost({ host: "jellyshop.io", path: "/harbour/sitemap.xml", storeLinks: "path" })).toMatchObject({ kind: "shop", path: "/sites/harbour/sitemap.xml" });
  });
});

describe("policy and social links", () => {
  const navigation = [{ kind: "page" as const, id: "p1", handle: "privacy" }, { kind: "page" as const, id: "p2", handle: "returns" }];
  it("links only published policy pages, and skips ones a menu already links", () => {
    expect(policyLinks("harbour", prefs(), navigation).map((link) => link.label)).toEqual(["Refund policy", "Privacy policy"]);
    const menus = { footer: { items: [{ target: { kind: "page", resourceId: "p1" }, children: [] }] } };
    expect(policyLinks("harbour", prefs(), navigation, menus).map((link) => link.href)).toEqual(["/harbour/pages/returns"]);
    expect(policyLinks("harbour", prefs(), null)).toEqual([]);
  });
  it("puts the store's own social links first and keeps theme ones for other platforms", () => {
    const links = storeSocialLinks(prefs((p) => { p.social.instagram = "https://instagram.com/harbour"; }), [{ id: "instagram", label: "Instagram", href: "https://instagram.com/old" }, { id: "whatsapp", label: "WhatsApp", href: "https://wa.me/1" }]);
    expect(links.map((link) => link.href)).toEqual(["https://instagram.com/harbour", "https://wa.me/1"]);
  });
});

describe("cookie banner and tracking", () => {
  const tracking = { googleAnalyticsId: "G-AB12CD34EF", googleTagManagerId: "", metaPixelId: "123456789012" };
  beforeEach(() => { window.localStorage.clear(); document.head.querySelectorAll("script[id^=jelly-]").forEach((node) => node.remove()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("knows where consent is needed (unknown counts as needed)", () => {
    expect(consentRequiredFor("GB")).toBe(true);
    expect(consentRequiredFor("de")).toBe(true);
    expect(consentRequiredFor("US")).toBe(false);
    expect(consentRequiredFor(null)).toBe(true);
  });
  it("drops anything that isn't an exact tracking ID", () => {
    expect(safeTracking({ googleAnalyticsId: "G-1');alert(1)//", googleTagManagerId: "GTM-ABC1234", metaPixelId: "x" })).toEqual({ googleAnalyticsId: "", googleTagManagerId: "GTM-ABC1234", metaPixelId: "" });
  });
  it("asks first where the law requires it, and loads nothing until accepted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ consentRequired: true }))));
    const user = userEvent.setup();
    render(<div data-jelly-theme="x"><StorePrivacy storeId="s1" mode="required-regions" message="" tracking={tracking} privacyHref="/harbour/pages/privacy" /></div>);
    expect(await screen.findByRole("region", { name: "Cookie choices" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/harbour/pages/privacy");
    expect(document.getElementById("jelly-ga")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(document.getElementById("jelly-ga")).toHaveAttribute("src", "https://www.googletagmanager.com/gtag/js?id=G-AB12CD34EF");
    expect(document.getElementById("jelly-pixel")).not.toBeNull();
    expect(readConsent("s1")).toBe("accepted");
  });
  it("loads nothing after Reject, and remembers it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ consentRequired: true }))));
    const user = userEvent.setup();
    const { unmount } = render(<StorePrivacy storeId="s2" mode="everywhere" message="Custom words." tracking={tracking} privacyHref={null} />);
    expect(await screen.findByText("Custom words.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(document.getElementById("jelly-ga")).toBeNull();
    unmount();
    render(<StorePrivacy storeId="s2" mode="everywhere" message="" tracking={tracking} privacyHref={null} />);
    await act(async () => undefined);
    expect(screen.queryByRole("region", { name: "Cookie choices" })).toBeNull();
  });
  it("starts straight away where consent isn't needed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ consentRequired: false }))));
    render(<StorePrivacy storeId="s3" mode="required-regions" message="" tracking={tracking} privacyHref={null} />);
    await act(async () => undefined);
    expect(screen.queryByRole("region", { name: "Cookie choices" })).toBeNull();
    expect(document.getElementById("jelly-ga")).not.toBeNull();
  });
  it("allows the tracking tools on shop pages only", () => {
    const options = { production: true };
    expect(contentSecurityPolicy("shop", options)).toContain("https://www.googletagmanager.com");
    expect(contentSecurityPolicy("shop", options)).toContain("https://connect.facebook.net");
    expect(contentSecurityPolicy("checkout", options)).not.toContain("connect.facebook.net");
    expect(contentSecurityPolicy("admin", options)).not.toContain("googletagmanager");
  });
});
