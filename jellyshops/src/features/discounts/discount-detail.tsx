"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPage, Banner, Button, Card, CardSkeleton, ConfirmDialog, DetailLayout, StatusBadge, useToast } from "@/components/admin";
import { useAdminRouter } from "@/features/admin/admin-routing";
import { DiscountCodesCard } from "./discount-codes-card";
import { DiscountForm } from "./discount-form";
import { draftFromDiscount } from "./form-state";
import { useDiscountFormData } from "./use-form-data";
import { DiscountRequestError, useDiscountsApi, type MerchantDiscount } from "./api";
import { DISCOUNT_STATUS_INFO, DISCOUNT_TYPE_INFO, discountSentence, moneyFormatter, usesText } from "./discount-words";

/**
 * One discount: the same form as creating one, with how it is doing beside it. Duplicate, Enable/Disable and Delete
 * live together under "More actions"; saving uses the form's own save bar.
 */
export function DiscountDetail({ id }: { id: string }) {
  const api = useDiscountsApi();
  const { get, list, bulk, duplicate, ready, currency, canManage } = api;
  const router = useAdminRouter();
  const toast = useToast();
  const money = useMemo(() => moneyFormatter(currency), [currency]);
  const [discount, setDiscount] = useState<MerchantDiscount | null>(null);
  const [timeZone, setTimeZone] = useState("Europe/London");
  const [error, setError] = useState<DiscountRequestError | null>(null);
  const [revision, setRevision] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const data = useDiscountFormData();
  const initial = useMemo(() => (discount && !data.loading ? draftFromDiscount(discount, data.timeZone) : null), [discount, data.loading, data.timeZone]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    // The list also carries the shop's time zone, which the dates are shown in.
    Promise.all([get(id), list().then((result) => result.timeZone).catch(() => "Europe/London")])
      .then(([found, zone]) => { if (active) { setDiscount(found); setTimeZone(zone); setError(null); } })
      .catch((failure: DiscountRequestError) => { if (active) setError(failure); });
    return () => { active = false; };
  }, [get, list, id, ready, revision]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  async function toggle() {
    if (!discount) return;
    setBusy(true);
    try {
      await bulk([discount.id], discount.active ? "disable" : "enable");
      toast(discount.active ? "Discount disabled" : "Discount enabled");
      reload();
    } catch (failure) { toast((failure as Error).message); } finally { setBusy(false); }
  }

  async function copy() {
    if (!discount) return;
    setBusy(true);
    try {
      const made = await duplicate(discount.id);
      toast(`Copy made (disabled): ${made.title}`);
      router.push(`/admin/discounts/${encodeURIComponent(made.id)}`);
    } catch (failure) { toast((failure as Error).message); } finally { setBusy(false); }
  }

  const skeleton = <div className="jk-discount-layout" aria-busy="true"><div className="jk-discount-main"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div><div className="jk-discount-aside"><CardSkeleton /></div></div>;
  if (error) {
    return <AdminPage title="Discount" width="full" back={{ label: "Discounts", href: "/admin/discounts" }}>
      <Banner tone="critical" action={error.status === 404 ? undefined : <Button size="small" onClick={reload}>Try again</Button>}>{error.message}</Banner>
    </AdminPage>;
  }
  if (!discount) return <AdminPage title="Discount" width="full" back={{ label: "Discounts", href: "/admin/discounts" }}>{skeleton}</AdminPage>;

  const status = DISCOUNT_STATUS_INFO[discount.status];
  const TypeIcon = DISCOUNT_TYPE_INFO[discount.type].icon;
  const performance = <>
    <Card title="Performance">
      <dl className="jk-discount-facts">
        <div><dt>Status</dt><dd>{status.label}{discount.status === "used_up" ? " (used up)" : ""}</dd></div>
        <div><dt>Used</dt><dd>{usesText(discount)}</dd></div>
        <div><dt>Paid orders</dt><dd>{discount.paidOrders}</dd></div>
        <div><dt>Sales</dt><dd>{money(discount.salesMinor)}</dd></div>
        {discount.paidOrders > 0 && <div><dt>Average order</dt><dd>{money(Math.round(discount.salesMinor / discount.paidOrders))}</dd></div>}
        <div><dt>Given away</dt><dd>{money(discount.givenMinor)}</dd></div>
      </dl>
    </Card>
    {discount.method === "code" && <DiscountCodesCard discount={discount} onChanged={reload} />}
  </>;

  return <AdminPage
    title={discount.title}
    width="full"
    back={{ label: "Discounts", href: "/admin/discounts" }}
    badges={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
    moreActions={canManage ? [
      { label: "Duplicate", onAction: () => void copy(), disabled: busy },
      { label: discount.active ? "Disable" : "Enable", onAction: () => void toggle(), disabled: busy },
      { label: "Delete", destructive: true, onAction: () => setDeleting(true) },
    ] : []}
  >
    {canManage
      ? initial
        ? <DiscountForm
          key={discount.updatedAt}
          discount={discount}
          initial={initial}
          data={data}
          currency={currency}
          side={performance}
          onSaved={(saved) => { setDiscount(saved); toast("Discount saved"); }}
          onDiscard={() => undefined}
        />
        : skeleton
      : <DetailLayout
        main={<Card title="What this discount does">
          <p className="jk-discount-sentence"><TypeIcon size={18} aria-hidden="true" /> {discountSentence(discount, { timeZone, formatMoney: money })}</p>
        </Card>}
        side={performance}
      />}
    <ConfirmDialog
      open={deleting}
      onOpenChange={setDeleting}
      title={`Delete ${discount.title}?`}
      description="Customers won't be able to use it any more. Orders already placed keep their discount, and its results stay in your reports. This can't be undone; disable it instead if you may want it again."
      confirmLabel="Delete discount"
      destructive
      onConfirm={async () => { await bulk([discount.id], "delete"); toast("Discount deleted"); router.push("/admin/discounts"); }}
    />
  </AdminPage>;
}
