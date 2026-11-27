"use client";

import { DISCOUNT_METHODS, DISCOUNT_TYPES, type DiscountMethod, type DiscountType } from "@jelly/storefront-schema";
import { AdminPage, Banner, Card } from "@/components/admin";
import { DISCOUNT_METHOD_INFO, DISCOUNT_TYPE_INFO } from "./discount-words";
import { findTemplate } from "./templates";

/** Reads the type picker's choice from the address. Unknown values fall back to a code for an amount off products. */
export function newDiscountChoice(type: string | null, method: string | null, template: string | null) {
  const chosen = findTemplate(template);
  if (chosen) return { type: chosen.type, method: chosen.input.method as DiscountMethod, template: chosen };
  return {
    type: (DISCOUNT_TYPES as readonly string[]).includes(type ?? "") ? type as DiscountType : "product_amount" as DiscountType,
    method: (DISCOUNT_METHODS as readonly string[]).includes(method ?? "") ? method as DiscountMethod : "code" as DiscountMethod,
    template: undefined,
  };
}

/** Creating a discount. The full form (phase 4 of the discounts redesign) replaces this holding page. */
export function NewDiscount({ type, method, template }: { type: string | null; method: string | null; template: string | null }) {
  const choice = newDiscountChoice(type, method, template);
  const info = DISCOUNT_TYPE_INFO[choice.type];
  return <AdminPage title={choice.template?.title ?? `New ${info.label.toLowerCase()} discount`} description={`${info.label} · ${DISCOUNT_METHOD_INFO[choice.method].label}`} width="detail" back={{ label: "Discounts", href: "/admin/discounts" }}>
    <Banner tone="info">The form for setting up this discount is being built. Until then you can switch existing discounts on and off, duplicate and delete them.</Banner>
    <Card title={info.label}><p className="jk-muted">{info.explain} For example: {info.example}.</p></Card>
  </AdminPage>;
}
