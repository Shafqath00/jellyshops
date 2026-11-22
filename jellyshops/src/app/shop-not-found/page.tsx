import type { Metadata } from "next";
import { ShopNotFound } from "@/features/storefront/components/shop-not-found";

/**
 * Shown (with status 404) for reserved names and unknown hosts: `src/proxy.ts` rewrites to it, and refuses
 * /shop-not-found when typed. Unknown shop addresses get the same page from `app/sites/not-found.tsx`.
 */
export const metadata: Metadata = {
  title: "Shop not found",
  robots: { index: false, follow: false },
};

export default function ShopNotFoundPage() {
  return <ShopNotFound />;
}
