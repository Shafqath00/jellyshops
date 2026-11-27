"use client";

import { useMemo } from "react";
import { DISCOUNT_METHODS, DISCOUNT_TYPES, type DiscountMethod, type DiscountType } from "@jelly/storefront-schema";
import { AdminPage, Banner, Card, CardSkeleton, useToast } from "@/components/admin";
import { useAdminRouter } from "@/features/admin/admin-routing";
import { useDiscountsApi } from "./api";
import { DiscountForm } from "./discount-form";
import { DISCOUNT_METHOD_INFO, DISCOUNT_TYPE_INFO } from "./discount-words";
import { draftFromChoice } from "./form-state";
import { findTemplate } from "./templates";
import { useDiscountFormData } from "./use-form-data";

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

/** Creating a discount: the form, filled from the picker's choice or a template. */
export function NewDiscount({ type, method, template }: { type: string | null; method: string | null; template: string | null }) {
  const { currency, canManage } = useDiscountsApi();
  const data = useDiscountFormData();
  const router = useAdminRouter();
  const toast = useToast();
  const choice = newDiscountChoice(type, method, template);
  const info = DISCOUNT_TYPE_INFO[choice.type];
  // Built once the shop's time zone is known, so the start date is today in the shop's own time.
  const initial = useMemo(() => (data.loading ? null : draftFromChoice(choice, data.timeZone)), [data.loading, data.timeZone, choice.type, choice.method, choice.template?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <AdminPage title={choice.template?.title ?? `New discount: ${info.label.toLowerCase()}`} description={DISCOUNT_METHOD_INFO[choice.method].label} width="full" back={{ label: "Discounts", href: "/admin/discounts" }}>
    {!canManage
      ? <Banner tone="warning">Only the shop owner and admins can create discounts.</Banner>
      : !initial
        ? <Card><CardSkeleton /></Card>
        : <DiscountForm
          initial={initial}
          data={data}
          currency={currency}
          side={choice.template ? <Card title="From a template"><p className="jk-muted">{choice.template.description} Check the details, then save.</p></Card> : undefined}
          onSaved={(saved) => { toast(`Discount created: ${saved.title}`); router.replace(`/admin/discounts/${encodeURIComponent(saved.id)}`); }}
          onDiscard={() => router.push("/admin/discounts")}
        />}
  </AdminPage>;
}
