"use client";

import type { ReactNode } from "react";
import { RegistrySectionRenderer, withStoreIdentity, type CommerceDataProvider } from "@jelly/storefront-renderer";
import type { SectionNode } from "@jelly/storefront-schema";
import type { RuntimeMenuV4 } from "@jelly/storefront-schema";
import { resolveTheme } from "@jelly/storefront-themes";
import type { ResolvedStorefrontRoute } from "./resource-loader";

type ReadyRoute = Extract<ResolvedStorefrontRoute, { status: "ready" }>;

/**
 * The one page composition shared by the live store and the theme preview (one render path): announcement, header,
 * the template's sections in <main>, footer, each drawn by the registry renderer for the route's page context.
 * Callers differ only in where data comes from (the API or sample fixtures), never in how the page is put together.
 * `chrome: false` leaves out announcement, header and footer when the storefront frame already draws them;
 * `identity` puts the store's name (and logo) into header and footer, as the storefront frame does; `main` replaces
 * the template's sections for a built-in page (the compare page) drawn inside the same frame.
 */
export function RuntimeStorefrontView({ route, commerce, themeId, themeVersion, menus, storeSlug, resourceLinks, collectionLinks, language, chrome = true, mode = "published", identity, main }: {
  route: ReadyRoute;
  commerce: CommerceDataProvider;
  themeId: string;
  themeVersion?: string;
  menus: Record<string, RuntimeMenuV4>;
  storeSlug: string;
  resourceLinks?: Record<string, string>;
  collectionLinks?: Record<string, string>;
  language?: string | null;
  chrome?: boolean;
  mode?: "published" | "preview";
  identity?: { name: string; logoUrl?: string };
  main?: ReactNode;
}) {
  const chromeSection = (section: SectionNode) => identity ? withStoreIdentity(section, identity) : section;
  const theme = resolveTheme(themeId, undefined, themeVersion);
  // Every section, the page's own included, reads its text and built-in words in the shopper's language.
  const shared = { mode, commerce, themeId: theme.id, themeVersion: theme.version, page: route.context, menus, resourceLinks, collectionLinks, storeSlug, language } as const;
  return <>
    {theme.layout === "editorial" ? <div className="jelly-theme-masthead"><span>JellyShop collection</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- theme asset, not a Next Image */}
      <img src={`${theme.assetPrefix}monogram.svg`} alt="" />
    </div> : null}
    {chrome && route.layout.announcement.map((section) => <RegistrySectionRenderer key={section.id} section={chromeSection(section)} region="header" {...shared} />)}
    {chrome && route.layout.header.map((section) => <RegistrySectionRenderer key={section.id} section={chromeSection(section)} region="header" {...shared} />)}
    <main className={theme.layout === "editorial" ? "jelly-theme-editorial-main" : undefined}>
      {main ?? route.layout.template.map((section) => <RegistrySectionRenderer key={section.id} section={section} region="template" {...shared} />)}
    </main>
    {chrome && route.layout.footer.map((section) => <RegistrySectionRenderer key={section.id} section={chromeSection(section)} region="footer" {...shared} />)}
  </>;
}
