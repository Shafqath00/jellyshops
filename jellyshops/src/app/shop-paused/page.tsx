import type { Metadata } from "next";
import { ShopPaused } from "@/features/storefront/components/shop-paused";

/**
 * Shown (with status 503) on every page of a shop that billing has paused: `src/proxy.ts` rewrites to it, and refuses
 * /shop-paused when typed (docs/plans/2026-11-23-phase-4-billing-and-limits.md).
 */
export const metadata: Metadata = {
  title: "Shop temporarily unavailable",
};

export default function ShopPausedPage() {
  return <ShopPaused />;
}
