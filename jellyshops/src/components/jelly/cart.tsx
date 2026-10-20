"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/* ──────────────────────────────────────────────────────────────────────
 * CartDrawer — slide-in cart panel
 *
 * Uses accessible Sheet primitive (Radix-based).
 * Commerce state lives in CartPanel.
 * ──────────────────────────────────────────────────────────────────── */

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  accessibleTitle?: string;
}

export function CartDrawer({ open, onClose, children, accessibleTitle = "Your cart" }: CartDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="flex min-h-0 flex-col overflow-y-auto px-7 pb-4 pt-7" aria-describedby={undefined}>
        <SheetTitle className="sr-only">{accessibleTitle}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * CartItem — individual line item in the cart drawer
 * ──────────────────────────────────────────────────────────────────── */
export function CartItem({
  imageUrl,
  name,
  variantName,
  options,
  quantity,
  lineTotal,
  canIncrease,
  onIncrease,
  onDecrease,
}: {
  imageUrl: string;
  name: string;
  variantName?: string;
  options?: string[];
  quantity: number;
  lineTotal: string;
  canIncrease: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  return (
    <div className="grid grid-cols-[78px_1fr_auto] items-start gap-3.5">
      {/* Thumbnail */}
      <div className="relative aspect-square w-[78px] overflow-hidden rounded-[18px] bg-muted">
        <Image src={imageUrl} alt="" fill sizes="90px" className="object-cover" />
      </div>

      {/* Details */}
      <div className="flex min-w-0 flex-col">
        <b className="text-[14px] font-semibold text-foreground">{name}</b>
        {variantName && (
          <span className="mt-0.5 text-[11px] text-muted-foreground">{variantName}</span>
        )}
        {options?.map((opt) => (
          <small key={opt} className="text-[10px] text-muted-foreground">{opt}</small>
        ))}

        {/* Quantity stepper */}
        <div className="mt-3 flex w-fit items-center overflow-hidden rounded-full border border-border">
          <button
            type="button"
            aria-label={`Remove one ${name}`}
            onClick={onDecrease}
            className="grid size-[30px] place-items-center text-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <Minus size={13} />
          </button>
          <span className="min-w-[26px] text-center text-[11px] font-bold">{quantity}</span>
          <button
            type="button"
            aria-label={`Add one ${name}`}
            disabled={!canIncrease}
            onClick={onIncrease}
            className="grid size-[30px] place-items-center text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Line total */}
      <strong className="text-[12px] font-bold text-foreground">{lineTotal}</strong>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * CartSummary — subtotal section + checkout CTA
 * ──────────────────────────────────────────────────────────────────── */
export function CartSummary({
  subtotal,
  checkoutHref,
  onClose,
}: {
  subtotal: string;
  checkoutHref: string;
  onClose: () => void;
}) {
  return (
    <div className="mt-auto border-t border-border pt-5">
      <div className="flex items-center justify-between text-[17px]">
        <span className="font-medium">Subtotal</span>
        <b className="font-bold">{subtotal}</b>
      </div>
      <p className="mb-4 mt-1.5 text-[11px] text-muted-foreground">
        Shipping is calculated at checkout.
      </p>
      <Link
        href={checkoutHref}
        onClick={onClose}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-[14px]",
          "bg-primary px-5 py-3.5 text-[13px] font-bold text-primary-foreground",
          "transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Checkout
      </Link>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * EmptyCart — empty state for cart drawer
 * ──────────────────────────────────────────────────────────────────── */
export function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="my-auto flex flex-col items-center text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-[18px] border-2 border-border bg-muted">
        <ShoppingBag size={26} className="text-muted-foreground" />
      </div>
      <h3 className="text-[20px] font-bold tracking-[-0.03em]">Your bag is waiting</h3>
      <p className="mt-2 mb-5 max-w-[240px] text-[13px] text-muted-foreground leading-relaxed">
        Pick something lovely from the shop.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-[12px] border border-border px-5 py-2.5 text-[13px] font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Keep browsing
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * CartBadge — animated item count badge
 * ──────────────────────────────────────────────────────────────────── */
export function CartBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span
      key={count}
      aria-live="polite"
      aria-label={`${count} items in cart`}
      className={cn(
        "grid size-5 place-items-center rounded-full bg-[var(--store-text,var(--foreground))] text-[10px] font-black text-[var(--store-bg,var(--background))]",
        "animate-jelly-badge-bump",
      )}
    >
      {count}
    </span>
  );
}
