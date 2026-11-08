"use client";

import * as React from "react";
import { Check, Loader2, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────
 * AddToCartButton — loading → success state machine
 *
 * States:  idle → loading → success → idle
 * Motion:  icon swap with fade + scale (CSS transition)
 * Commerce interactions must remain predictable (no heavy animations).
 * ──────────────────────────────────────────────────────────────────── */

type CartButtonState = "idle" | "loading" | "success";

interface AddToCartButtonProps {
  disabled?: boolean;
  loading?: boolean;
  added?: boolean;
  wide?: boolean;
  onClick?: () => void | Promise<void>;
  className?: string;
  children?: React.ReactNode;
}

export function AddToCartButton({
  disabled,
  loading,
  added,
  wide,
  onClick,
  className,
  children,
}: AddToCartButtonProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);
  const mounted = React.useRef(true);

  React.useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  const isPending = loading || internalLoading;
  const state: CartButtonState = isPending ? "loading" : added ? "success" : "idle";

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled || isPending) return;
    if (onClick) {
      setInternalLoading(true);
      try {
        await onClick();
      } finally {
        if (mounted.current) {
          setInternalLoading(false);
        }
      }
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || isPending}
      onClick={handleClick}
      aria-live="polite"
      className={cn(
        /* Base */
        "relative inline-flex min-h-[50px] items-center justify-center gap-2",
        "rounded-[999px_999px_999px_14px]",
        "border-[1.5px] border-[var(--store-text,var(--primary))]",
        "px-5 text-[13px] font-extrabold",
        "transition-all duration-[var(--duration-jelly-standard)] ease-[var(--ease-jelly-standard)]",
        /* Colors by state */
        state === "success"
          ? "bg-success border-success text-success-foreground"
          : "bg-[var(--store-text,var(--primary))] text-[var(--store-bg,var(--primary-foreground))]",
        /* Hover */
        "hover:opacity-90 hover:-translate-y-0.5 hover:shadow-[5px_6px_0_var(--store-accent,var(--accent))]",
        /* Disabled */
        "disabled:opacity-45 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none",
        /* Width */
        wide && "w-full",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center gap-2 transition-all duration-[var(--duration-jelly-fast)]",
          state === "loading" && "opacity-0",
        )}
      >
        {state === "success" ? (
          <>
            <Check size={17} strokeWidth={2.5} aria-hidden="true" />
            Added to bag
          </>
        ) : (
          <>
            <ShoppingBag size={17} aria-hidden="true" />
            {children ?? "Add to cart"}
          </>
        )}
      </span>

      {/* Spinner overlay */}
      {state === "loading" && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          <span className="sr-only">Adding to cart…</span>
        </span>
      )}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * ProductBadge — stock / sale / featured badges
 * ──────────────────────────────────────────────────────────────────── */
export function ProductBadge({
  variant = "default",
  children,
  className,
}: {
  variant?: "default" | "sold-out" | "low-stock" | "sale" | "new";
  children?: React.ReactNode;
  className?: string;
}) {
  const variantClass = {
    "default": "bg-white/92 text-foreground backdrop-blur-md",
    "sold-out": "bg-foreground/85 text-background backdrop-blur-md",
    "low-stock": "bg-jelly-citrus/90 text-foreground backdrop-blur-md",
    "sale": "bg-jelly-guava text-white",
    "new": "bg-jelly-mint text-foreground",
  }[variant];

  const label =
    children ??
    {
      "default": null,
      "sold-out": "Sold out",
      "low-stock": "Limited",
      "sale": "Sale",
      "new": "New",
    }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5",
        "text-[9px] font-black uppercase tracking-[0.07em] shadow-sm",
        variantClass,
        className,
      )}
    >
      {label}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * ProductPrice — formatted price display
 * ──────────────────────────────────────────────────────────────────── */
export function ProductPrice({
  price,
  originalPrice,
  className,
}: {
  price: string;
  originalPrice?: string;
  className?: string;
}) {
  return (
    <span className={cn("flex items-baseline gap-2", className)}>
      <b className="text-[12px] font-black text-[var(--store-text,var(--foreground))]">{price}</b>
      {originalPrice && (
        <s className="text-[11px] font-medium text-muted-foreground">{originalPrice}</s>
      )}
    </span>
  );
}
