import { POLICY_KINDS, SOCIAL_PLATFORMS, storePath, type PolicyKind, type StorePreferences } from "@jelly/storefront-schema";
import type { NavigationResource } from "@/features/navigation/resource-links";

export const POLICY_LABELS: Record<PolicyKind, string> = { refund: "Refund policy", privacy: "Privacy policy", terms: "Terms of service", shipping: "Shipping policy" };

type MenuItemLike = { target: { kind: string; resourceId?: string; url?: string }; children?: MenuItemLike[] };
type MenuLike = { items?: MenuItemLike[] };

/**
 * The store's published policy pages (Settings > Store preferences > Policies), in a fixed order. A policy whose page
 * is missing or not published is left out, so shoppers never land on a "page not found". With `menus`, policies
 * already linked from one of the store's menus are left out too (the footer menu usually lists them).
 */
export function policyLinks(storeSlug: string, preferences: Pick<StorePreferences, "policies">, navigation: NavigationResource[] | null | undefined, menus?: Record<string, MenuLike> | null): Array<{ kind: PolicyKind; label: string; href: string }> {
  if (!navigation) return [];
  const pages = navigation.filter((item) => item.kind === "page");
  const linked = new Set<string>();
  const visit = (items: MenuItemLike[] | undefined) => {
    for (const item of items ?? []) {
      if (item.target.kind === "page" && item.target.resourceId) linked.add(item.target.resourceId);
      if (item.target.kind === "external" && item.target.url) {
        const handle = /\/(?:pages\/)?([a-z0-9-]+)\/?$/.exec(item.target.url)?.[1];
        const page = handle ? pages.find((entry) => entry.handle === handle) : undefined;
        if (page) linked.add(page.id);
      }
      visit(item.children);
    }
  };
  for (const menu of Object.values(menus ?? {})) visit(menu.items);
  return POLICY_KINDS.flatMap((kind) => {
    const handle = preferences.policies[kind];
    const page = handle ? pages.find((entry) => entry.handle === handle) : undefined;
    if (!page || linked.has(page.id)) return [];
    return [{ kind, label: POLICY_LABELS[kind], href: storePath(storeSlug, `/pages/${encodeURIComponent(page.handle)}`) }];
  });
}

/** Every published policy page, menus or not (checkout footer, cookie banner). */
export function allPolicyLinks(storeSlug: string, preferences: Pick<StorePreferences, "policies">, navigation: NavigationResource[] | null | undefined) {
  return policyLinks(storeSlug, preferences, navigation, null);
}

const SOCIAL_LABELS: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", x: "X", youtube: "YouTube", tiktok: "TikTok", pinterest: "Pinterest", linkedin: "LinkedIn", threads: "Threads" };

/**
 * Social links for the footer: the store's own (Settings > Store preferences > Social media) first, then any the
 * theme settings still hold for platforms the store hasn't filled in.
 */
export function storeSocialLinks(preferences: Pick<StorePreferences, "social">, themeLinks: Array<{ id: string; label: string; href: string }>): Array<{ id: string; label: string; href: string }> {
  const own = SOCIAL_PLATFORMS.flatMap((id) => preferences.social[id] ? [{ id, label: SOCIAL_LABELS[id] ?? id, href: preferences.social[id] }] : []);
  const ownIds = new Set<string>(own.map((link) => link.id));
  return [...own, ...themeLinks.filter((link) => !ownIds.has(link.id))];
}
