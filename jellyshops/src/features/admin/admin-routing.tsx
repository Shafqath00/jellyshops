"use client";

/**
 * Which shop the merchant admin is looking at comes from the address, not from what the browser remembers:
 * `jellyshop.io/admin/s/<shop>/orders` today, `admin.jellyshop.io/s/<shop>/orders` once shops have subdomains
 * (NEXT_PUBLIC_STORE_LINKS=subdomain). Pages for one shop live under `app/admin/s/[shop]/`.
 *
 * Admin code keeps writing shop links the old way ("/admin/orders"). `Link` (default export), `useAdminRouter` and
 * `useAdminPathname` from this file turn them into the current shop's address and back, so links, buttons and the
 * "you are here" checks need no shop at each call site. Outside a shop page they change nothing.
 * `src/features/admin/admin-routing-guard.test.ts` keeps admin files on these instead of next/link and next/navigation.
 * Design: docs/plans/2026-11-22-subdomain-tenancy-plan.md (owner decision 1, step 5).
 */
import NextLink from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { forwardRef, useMemo, type ComponentProps } from "react";
import { adminPagePath, toShopAdmin } from "./admin-paths";

export { SHOP_ADMIN_SECTIONS, adminPagePath, isShopAdminHref, shopAdminBase, shopFromAdminPath, toShopAdmin } from "./admin-paths";

/** The shop this admin page is for (from the route), or undefined outside a shop's pages. */
export function useShopSlug(): string | undefined {
  const params = useParams<{ shop?: string }>();
  return typeof params?.shop === "string" ? decodeURIComponent(params.shop) : undefined;
}

/** Maps an old-style admin link to the current shop's address. */
export function useShopAdminHref(): (href: string) => string {
  const shop = useShopSlug();
  return useMemo(() => (href: string) => (shop ? toShopAdmin(shop, href) : href), [shop]);
}

type LinkProps = ComponentProps<typeof NextLink>;

/** next/link for admin pages: "/admin/..." links go to the current shop's page. */
const AdminLink = forwardRef<HTMLAnchorElement, LinkProps>(function AdminLink({ href, ...props }, ref) {
  const toShop = useShopAdminHref();
  return <NextLink ref={ref} href={typeof href === "string" ? toShop(href) : href} {...props} />;
});
export default AdminLink;

/** useRouter for admin pages: push/replace/prefetch of "/admin/..." go to the current shop's page. */
export function useAdminRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const toShop = useShopAdminHref();
  return useMemo(() => ({
    ...router,
    // Options are passed only when given, so calls look exactly like next/navigation's.
    push: (href, ...options) => router.push(toShop(href), ...options),
    replace: (href, ...options) => router.replace(toShop(href), ...options),
    prefetch: (href, ...options) => router.prefetch(toShop(href), ...options),
  }), [router, toShop]);
}

/** usePathname for admin pages, in the old form ("/admin/orders"), the same on the server and in the browser. */
export function useAdminPathname(): string {
  return adminPagePath(usePathname() ?? "");
}
