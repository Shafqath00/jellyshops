"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { createMerchantCommerceApi } from "@/features/commerce/api/client";
import type { MerchantOrderListItem } from "@/features/commerce/api/types";
import { SkeletonRows } from "@/components/ui/skeleton";

const API_URL =
  process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(value?: string | null) {
  if (!value) return "Not started";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getCustomerName(snapshot: Record<string, unknown>) {
  const name = snapshot.name;

  return typeof name === "string" && name.trim()
    ? name
    : "Customer unavailable";
}

function getStatusStyle(status: string) {
  switch (status) {
    case "DELIVERED":
      return "bg-[var(--warn-bg)] text-success";
    case "SHIPPED":
      return "bg-muted text-muted-foreground";
    case "CANCELLED":
      return "bg-muted text-tint-foreground";
    case "PROCESSING":
      return "bg-muted text-success";
    default:
      return "bg-[var(--warn-bg)] text-[var(--warn-fg)]";
  }
}

export default function OrdersPage() {
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

  const [orders, setOrders] = useState<MerchantOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      if (!api || !storeId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await api.listOrders(storeId);
        if (!cancelled) setOrders(result);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load orders"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrders();

    return () => {
      cancelled = true;
    };
  }, [api, storeId]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-tint-foreground">
          Fulfilment
        </p>
        <h1 className="mt-2 text-[30px] font-black tracking-[-0.045em] text-foreground sm:text-[34px]">
          Orders
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">
          Track customer orders and keep fulfilment moving.
        </p>
      </header>

      {loading ? (
        <Panel className="p-0">
          <SkeletonRows label="Loading orders…" />
        </Panel>
      ) : !api ? (
        <Panel>
          <h2 className="text-[15px] font-black text-foreground">
            Orders unavailable
          </h2>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Sign in as a merchant to manage orders.
          </p>
        </Panel>
      ) : error ? (
        <div
          role="alert"
          className="rounded-[22px] border border-tint-border bg-muted/50 p-5 text-[12px] font-semibold text-tint-foreground"
        >
          {error}
        </div>
      ) : orders.length === 0 ? (
        <EmptyOrders />
      ) : (
        <OrdersTable orders={orders} />
      )}
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[22px] border border-black/[0.06] bg-card p-6 shadow-[0_12px_40px_rgba(83,61,66,0.05)] ${className}`}
    >
      {children}
    </section>
  );
}

function EmptyOrders() {
  return (
    <section className="grid min-h-64 place-items-center rounded-[22px] border border-dashed border-black/[0.10] bg-card/70 px-6 py-10 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-tint-foreground">
          <ClipboardList size={20} strokeWidth={1.8} />
        </span>
        <h2 className="mt-4 text-[15px] font-black text-foreground">
          No orders yet
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-[12px] leading-5 text-muted-foreground">
          New paid orders will appear here after customers check out.
        </p>
      </div>
    </section>
  );
}

function OrdersTable({ orders }: { orders: MerchantOrderListItem[] }) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-black/[0.06] bg-card shadow-[0_12px_40px_rgba(83,61,66,0.05)]">
      <div className="hidden grid-cols-[0.8fr_1.5fr_0.9fr_0.9fr_0.8fr] gap-4 border-b border-black/[0.06] bg-muted/50 px-5 py-3 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground md:grid">
        <span>Order</span>
        <span>Customer</span>
        <span>Status</span>
        <span>Total</span>
        <span>Date</span>
      </div>

      <div className="divide-y divide-black/[0.06]">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/admin/orders/${order.id}`}
            className="group grid gap-4 px-5 py-4 transition hover:bg-muted/50 md:grid-cols-[0.8fr_1.5fr_0.9fr_0.9fr_0.8fr] md:items-center"
          >
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground md:hidden">
                Order
              </p>
              <p className="mt-1 text-[13px] font-black text-foreground md:mt-0">
                {order.number}
              </p>
            </div>

            <div className="min-w-0">
              <p className="truncate text-[12px] font-bold text-foreground">
                {getCustomerName(order.customerSnapshot)}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Payment: {formatStatus(order.paymentStatus)}
              </p>
            </div>

            <div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.06em] ${getStatusStyle(order.status)}`}
              >
                {formatStatus(order.status)}
              </span>
            </div>

            <p className="text-[12px] font-black text-foreground">
              {formatMoney(order.totalMinor, order.currency)}
            </p>

            <p className="text-[11px] font-semibold text-muted-foreground">
              {formatDate(order.createdAt)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
