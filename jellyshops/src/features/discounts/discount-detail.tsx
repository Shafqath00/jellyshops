"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPage, Banner, Button, Card, CardSkeleton, ConfirmDialog, DetailLayout, StatusBadge, useToast } from "@/components/admin";
import { useAdminRouter } from "@/features/admin/admin-routing";
import { DiscountForm } from "./discount-form";
import { draftFromDiscount } from "./form-state";
import { useDiscountFormData } from "./use-form-data";
import { DiscountRequestError, useDiscountsApi, type MerchantDiscount } from "./api";
import { DISCOUNT_METHOD_INFO, DISCOUNT_STATUS_INFO, DISCOUNT_TYPE_INFO, discountDates, discountSentence, moneyFormatter, usesText } from "./discount-words";

/** One discount: what it does in one sentence, how it is doing, and switch on/off, duplicate, delete. */
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
      toast(discount.active ? "Discount switched off" : "Discount switched on");
      reload();
    } catch (failure) { toast((failure as Error).message); } finally { setBusy(false); }
  }

  async function copy() {
    if (!discount) return;
    setBusy(true);
    try {
      const made = await duplicate(discount.id);
      toast(`Copy made, switched off: ${made.title}`);
      router.push(`/admin/discounts/${encodeURIComponent(made.id)}`);
    } catch (failure) { toast((failure as Error).message); } finally { setBusy(false); }
  }

  if (error) {
    return <AdminPage title="Discount" width="detail" back={{ label: "Discounts", href: "/admin/discounts" }}>
      <Banner tone="critical" action={error.status === 404 ? undefined : <Button size="small" onClick={reload}>Try again</Button>}>{error.message}</Banner>
    </AdminPage>;
  }
  if (!discount) {
    return <AdminPage title="Discount" width="detail" back={{ label: "Discounts", href: "/admin/discounts" }}><CardSkeleton /></AdminPage>;
  }

  const status = DISCOUNT_STATUS_INFO[discount.status];
  const TypeIcon = DISCOUNT_TYPE_INFO[discount.type].icon;
  const facts = <>
    <Card title="Status">
      <dl className="jk-discount-facts">
        <div><dt>Status</dt><dd>{status.label}<span className="jk-muted"> · {status.explain}</span></dd></div>
        {discount.method === "code" && <div><dt>Code</dt><dd><span className="jk-code">{discount.code}</span>{discount.codeCount > 1 ? ` and ${discount.codeCount - 1} more` : ""}</dd></div>}
        <div><dt>Dates</dt><dd>{discountDates(discount, timeZone)} <span className="jk-muted">({timeZone.replace(/_/g, " ")} time)</span></dd></div>
        <div><dt>Used</dt><dd>{usesText(discount)}</dd></div>
      </dl>
    </Card>
    <Card title="Results" description="From paid orders that used this discount.">
      {discount.paidOrders === 0
        ? <p className="jk-muted">No paid orders yet. Results appear here once customers use it.</p>
        : <dl className="jk-discount-facts">
          <div><dt>Paid orders</dt><dd>{discount.paidOrders}</dd></div>
          <div><dt>Sales</dt><dd>{money(discount.salesMinor)}</dd></div>
          <div><dt>Average order</dt><dd>{money(Math.round(discount.salesMinor / discount.paidOrders))}</dd></div>
          <div><dt>Given away</dt><dd>{money(discount.givenMinor)}</dd></div>
        </dl>}
    </Card>
  </>;
  return <AdminPage
    title={discount.title}
    description={`${DISCOUNT_TYPE_INFO[discount.type].label} · ${DISCOUNT_METHOD_INFO[discount.method].label}`}
    width={canManage ? "full" : "detail"}
    back={{ label: "Discounts", href: "/admin/discounts" }}
    badges={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
    secondaryActions={canManage ? [
      { label: discount.active ? "Switch off" : "Switch on", onAction: () => void toggle(), disabled: busy },
      { label: "Duplicate", onAction: () => void copy(), disabled: busy },
    ] : []}
    moreActions={canManage ? [{ label: "Delete discount", destructive: true, onAction: () => setDeleting(true) }] : []}
  >
    {canManage
      ? initial
        ? <DiscountForm
          key={discount.updatedAt}
          discount={discount}
          initial={initial}
          data={data}
          currency={currency}
          side={facts}
          onSaved={(saved) => { setDiscount(saved); toast("Discount saved"); }}
          onDiscard={() => undefined}
        />
        : <CardSkeleton />
      : <DetailLayout
        main={<Card title="What this discount does">
          <p className="jk-discount-sentence"><TypeIcon size={18} aria-hidden="true" /> {discountSentence(discount, { timeZone, formatMoney: money })}</p>
        </Card>}
        side={facts}
      />}
    <ConfirmDialog
      open={deleting}
      onOpenChange={setDeleting}
      title={`Delete ${discount.title}?`}
      description="Customers won't be able to use it any more. Orders already placed keep their discount, and its results stay in your reports. This can't be undone; switch it off instead if you may want it again."
      confirmLabel="Delete discount"
      destructive
      onConfirm={async () => { await bulk([discount.id], "delete"); toast("Discount deleted"); router.push("/admin/discounts"); }}
    />
  </AdminPage>;
}
