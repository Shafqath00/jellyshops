"use client";

import { useMemo, useState } from "react";
import { DISCOUNT_METHODS, DISCOUNT_TYPES, type DiscountMethod, type DiscountType } from "@jelly/storefront-schema";
import { AdminPage, Banner, CardSkeleton, useToast } from "@/components/admin";
import { useAdminRouter } from "@/features/admin/admin-routing";
import { useDiscountsApi } from "./api";
import { DiscountForm } from "./discount-form";
import { draftFromChoice } from "./form-state";
import { findTemplate } from "./templates";
import { DiscountTypePicker } from "./type-picker";
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
  const [picking, setPicking] = useState(false);
  const choice = newDiscountChoice(type, method, template);
  // Built once the shop's time zone is known, so the start date is today in the shop's own time.
  const initial = useMemo(() => (data.loading ? null : draftFromChoice(choice, data.timeZone)), [data.loading, data.timeZone, choice.type, choice.method, choice.template?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <AdminPage title={choice.template ? choice.template.title : "Create discount"} width="full" back={{ label: "Discounts", href: "/admin/discounts" }}>
    {!canManage
      ? <Banner tone="warning">Only the shop owner and admins can create discounts.</Banner>
      : !initial
        ? <div className="jk-discount-layout" aria-busy="true"><div className="jk-discount-main"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div><div className="jk-discount-aside"><CardSkeleton /></div></div>
        : <DiscountForm
          key={`${choice.type}-${choice.method}-${choice.template?.id ?? ""}`}
          initial={initial}
          onChangeType={() => setPicking(true)}
          data={data}
          currency={currency}
          side={choice.template ? <p className="jk-muted jk-discount-help">{choice.template.description} Check the details, then save.</p> : undefined}
          onSaved={(saved) => { toast(`Discount created: ${saved.title}`); router.replace(`/admin/discounts/${encodeURIComponent(saved.id)}`); }}
          onDiscard={() => router.push("/admin/discounts")}
        />}
    <DiscountTypePicker open={picking} onOpenChange={setPicking} initial={{ type: choice.type, method: choice.method }} onChoose={(href) => { setPicking(false); router.replace(href); }} />
  </AdminPage>;
}
