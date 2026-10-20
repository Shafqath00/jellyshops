"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useShop } from "@/contexts/shop-context";
import { CartBadge } from "@/components/jelly/cart";

/* ──────────────────────────────────────────────────────────────────────
 * StoreHeader — sticky storefront navigation bar
 *
 * Uses Tailwind utilities backed by Jellyshop design tokens.
 * CartBadge uses animate-jelly-badge-bump for count changes.
 * ──────────────────────────────────────────────────────────────────── */

export function StoreHeader({
  storeSlug,
  onCartOpen,
}: {
  storeSlug: string;
  onCartOpen: () => void;
}) {
  const { repository, state } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const cart = repository.getCartForStore(storeSlug);
  const count = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  if (!store) return null;

  return (
    <header
      className={[
        "store-header",
        /* Tailwind token-driven overrides */
        "sticky top-0 z-20 h-[74px]",
        "px-5 sm:px-6 lg:px-[clamp(20px,5vw,72px)]",
        "grid items-center",
        "[grid-template-columns:1fr_auto_1fr]",
        "border-b border-[color-mix(in_srgb,var(--store-text,var(--foreground))_18%,transparent)]",
        "bg-[color-mix(in_srgb,var(--store-bg,var(--background))_92%,transparent)]",
        "backdrop-blur-md",
        "transition-[background-color] duration-[var(--duration-jelly-standard)]",
      ].join(" ")}
    >
      {/* Logo */}
      <Link
        href={`/${store.slug}`}
        className="store-logo justify-self-start font-[var(--store-display,Georgia)] text-[22px] font-[760] tracking-[-0.04em]"
      >
        {store.name}
      </Link>

      {/* Navigation */}
      <nav
        aria-label="Store navigation"
        className="hidden gap-6 text-[13px] font-[700] md:flex"
      >
        <Link href={`/${store.slug}`}>Home</Link>
        <Link href={`/${store.slug}/shop`}>Shop all</Link>
      </nav>

      {/* Cart button */}
      <div className="justify-self-end">
        <button
          type="button"
          onClick={onCartOpen}
          aria-label={`Open cart with ${count} items`}
          className={[
            "flex min-h-[40px] items-center gap-2 rounded-full px-3",
            "border border-[color-mix(in_srgb,var(--store-text,var(--foreground))_30%,transparent)]",
            "bg-transparent text-inherit",
            "transition-colors hover:bg-[color-mix(in_srgb,var(--store-text,var(--foreground))_8%,transparent)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          ].join(" ")}
        >
          <ShoppingBag size={19} />
          <span className="hidden text-[13px] font-[700] sm:inline">Bag</span>
          <CartBadge count={count} />
        </button>
      </div>

      {/* Reactive version marker — hidden */}
      <span hidden>{state.version}</span>
    </header>
  );
}
