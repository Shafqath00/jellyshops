"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  MapPin,
  PackageCheck,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { createMerchantCommerceApi } from "@/features/commerce/api/client";
import type {
  MerchantOrderDetail,
  MerchantOrderStatus,
} from "@/features/commerce/api/types";
import { OrderPaymentPanel } from "@/features/commerce/components/order-payment-panel";

const API_URL =
  process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

const fulfilmentActions: Partial<
  Record<
    MerchantOrderStatus,
    {
      next: MerchantOrderStatus;
      label: string;
      icon: typeof Check;
    }
  >
> = {
  PAID: {
    next: "CONFIRMED",
    label: "Confirm order",
    icon: Check,
  },
  CONFIRMED: {
    next: "PROCESSING",
    label: "Start processing",
    icon: PackageCheck,
  },
  PROCESSING: {
    next: "SHIPPED",
    label: "Mark shipped",
    icon: Truck,
  },
  SHIPPED: {
    next: "DELIVERED",
    label: "Mark delivered",
    icon: Check,
  },
};

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getSnapshotValue(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" && value.trim() ? value : "Not provided";
}

function getAddress(snapshot: Record<string, unknown>) {
  const address = snapshot.address;

  return address && typeof address === "object" && !Array.isArray(address)
    ? (address as Record<string, unknown>)
    : null;
}

function getStatusStyle(status: string) {
  switch (status) {
    case "DELIVERED":
      return "bg-[#edf3cf] text-[#586629]";
    case "SHIPPED":
      return "bg-[#e9edff] text-[#5866a1]";
    case "CANCELLED":
      return "bg-[#f8e5e9] text-[#945264]";
    case "PROCESSING":
      return "bg-[#eaf3f0] text-[#4e756b]";
    default:
      return "bg-[#fff1d2] text-[#8a6419]";
  }
}

export function OrderDetailView({ orderId }: { orderId: string }) {
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id;
  const token = session?.access_token;

  const api = useMemo(() => {
    if (!storeId || !token) return null;

    return createMerchantCommerceApi({
      baseUrl: API_URL,
      token,
    });
  }, [storeId, token]);

  const [detail, setDetail] = useState<MerchantOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      if (!api || !storeId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await api.getOrder(storeId, orderId);
        if (!cancelled) setDetail(result);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load order"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [api, orderId, storeId]);

  async function advanceFulfilment() {
    if (!api || !storeId || !detail) return;

    const action = fulfilmentActions[detail.order.status];
    if (!action) return;

    setTransitioning(true);
    setError("");

    try {
      const order = await api.transitionFulfilment(
        storeId,
        detail.order.id,
        action.next
      );

      setDetail((current) => (current ? { ...current, order } : current));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update fulfilment"
      );
    } finally {
      setTransitioning(false);
    }
  }

  async function requestFullRefund() {
    if (!api || !storeId || !detail) {
      throw new Error("Merchant order access is unavailable.");
    }

    const refund = await api.requestFullRefund(storeId, detail.order.id);

    setDetail((current) => {
      if (!current) return current;

      const exists = current.refunds.some((item) => item.id === refund.id);

      return {
        ...current,
        refunds: exists ? current.refunds : [...current.refunds, refund],
      };
    });

    return refund;
  }

  if (loading) {
    return (
      <StatePanel>
        <Loader2 className="animate-spin" size={17} />
        Loading order…
      </StatePanel>
    );
  }

  if (!api) {
    return (
      <MessageState
        title="Order access unavailable"
        body="Sign in as a merchant to manage orders."
      />
    );
  }

  if (error && !detail) {
    return <MessageState title="Order unavailable" body={error} error />;
  }

  if (!detail) {
    return <MessageState title="Order not found" body="This order could not be found." />;
  }

  const { order, items, payment, refunds, disputes } = detail;
  const action = fulfilmentActions[order.status];
  const ActionIcon = action?.icon ?? Check;
  const address = getAddress(order.customerSnapshot);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#766a6d] transition hover:text-[#2d2628]"
      >
        <ArrowLeft size={14} />
        Orders
      </Link>

      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#a35c6d]">
            {order.number}
          </p>
          <h1 className="mt-2 text-[30px] font-black tracking-[-0.045em] text-[#2d2628] sm:text-[34px]">
            Order details
          </h1>
          <p className="mt-2 text-[12px] text-[#817477]">
            Placed {formatDate(order.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.07em] ${getStatusStyle(order.status)}`}
          >
            {formatStatus(order.status)}
          </span>

          {action ? (
            <button
              type="button"
              onClick={advanceFulfilment}
              disabled={transitioning}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#2d2628] px-4 text-[11px] font-black text-white shadow-[0_8px_24px_rgba(45,38,40,0.16)] transition hover:-translate-y-0.5 hover:bg-[#43383b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {transitioning ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ActionIcon size={15} />
              )}
              {transitioning ? "Updating…" : action.label}
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-[18px] border border-[#edcbd2] bg-[#fff5f7] px-4 py-3 text-[11px] font-semibold text-[#914f60]"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_12px_40px_rgba(83,61,66,0.05)]">
          <SectionHeader eyebrow="Items" title="What they ordered" />

          <div className="divide-y divide-black/[0.06]">
            {items.map((item) => (
              <div
                key={item.variantId}
                className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4"
              >
                <span
                  className="grid size-11 place-items-center rounded-xl bg-[#fff1f4] text-[#aa6070]"
                  aria-hidden="true"
                >
                  <PackageCheck size={17} strokeWidth={1.8} />
                </span>

                <div className="min-w-0">
                  <p className="truncate text-[12px] font-black text-[#3b3234]">
                    {item.titleSnapshot}
                  </p>
                  <p className="mt-1 text-[10px] text-[#9b8e91]">
                    {item.skuSnapshot ?? "No SKU"} · Qty {item.quantity}
                  </p>
                </div>

                <p className="text-[12px] font-black text-[#332b2d]">
                  {formatMoney(
                    item.unitPriceMinor * item.quantity,
                    order.currency
                  )}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-black/[0.06] bg-[#fffaf7] px-5 py-4">
            <TotalRow
              label="Subtotal"
              value={formatMoney(order.subtotalMinor, order.currency)}
            />
            <TotalRow
              label="Shipping"
              value={formatMoney(order.shippingMinor, order.currency)}
            />
            <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3">
              <span className="text-[12px] font-black text-[#3c3335]">Total</span>
              <strong className="text-[16px] font-black tracking-[-0.03em] text-[#2d2628]">
                {formatMoney(order.totalMinor, order.currency)}
              </strong>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <InfoCard eyebrow="Customer" title={getSnapshotValue(order.customerSnapshot, "name")}>
            <p>{getSnapshotValue(order.customerSnapshot, "email")}</p>
            <p>{getSnapshotValue(order.customerSnapshot, "phone")}</p>
          </InfoCard>

          <InfoCard
            eyebrow="Delivery"
            title={
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} />
                Shipping address
              </span>
            }
          >
            {address ? (
              <address className="not-italic">
                <p>{getSnapshotValue(address, "line1")}</p>
                {typeof address.line2 === "string" && address.line2.trim() ? (
                  <p>{address.line2}</p>
                ) : null}
                <p>
                  {getSnapshotValue(address, "city")},{" "}
                  {getSnapshotValue(address, "region")} {getSnapshotValue(address, "postalCode")}
                </p>
                <p>{getSnapshotValue(address, "country")}</p>
              </address>
            ) : (
              <p>No shipping address was supplied.</p>
            )}
          </InfoCard>

          <OrderPaymentPanel
            payment={payment}
            refunds={refunds}
            disputes={disputes}
            fulfilmentStatus={order.status}
            requestFullRefund={requestFullRefund}
          />
        </aside>
      </div>
    </div>
  );
}

function StatePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-[22px] border border-black/[0.06] bg-white">
      <div className="flex items-center gap-2.5 text-[12px] font-bold text-[#766a6d]">
        {children}
      </div>
    </div>
  );
}

function MessageState({
  title,
  body,
  error = false,
}: {
  title: string;
  body: string;
  error?: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] border p-6 ${
        error
          ? "border-[#edcbd2] bg-[#fff5f7]"
          : "border-black/[0.06] bg-white"
      }`}
    >
      <h1 className="text-[18px] font-black tracking-[-0.03em] text-[#322a2c]">
        {title}
      </h1>
      <p
        className={`mt-2 text-[12px] leading-5 ${
          error ? "text-[#914f60]" : "text-[#817477]"
        }`}
      >
        {body}
      </p>
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="border-b border-black/[0.06] px-5 py-4">
      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#a35c6d]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[15px] font-black tracking-[-0.025em] text-[#332b2d]">
        {title}
      </h2>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-[11px]">
      <span className="text-[#817477]">{label}</span>
      <strong className="font-bold text-[#4a4043]">{value}</strong>
    </div>
  );
}

function InfoCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-[0_12px_40px_rgba(83,61,66,0.05)]">
      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#a35c6d]">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-[14px] font-black tracking-[-0.02em] text-[#332b2d]">
        {title}
      </h2>
      <div className="mt-3 space-y-1 text-[11px] leading-5 text-[#817477]">
        {children}
      </div>
    </section>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  return <OrderDetailView orderId={params.id} />;
}
