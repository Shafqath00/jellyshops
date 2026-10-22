"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Mail,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import {
  type ComponentProps,
  useCallback,
  useMemo,
} from "react";
import {
  authApiOrigin,
  useAuth,
} from "@/features/auth/auth-provider";
import { createAdminApi } from "@/features/admin/api";
import { useAdminQuery } from "@/features/admin/use-admin-query";
import { OrderStatusBadge } from "@/features/commerce/components/order-status";
import { formatMoney } from "@/lib/domain";
import type { Currency } from "@/lib/domain";

type BadgeStatus = ComponentProps<typeof OrderStatusBadge>["status"];

type CustomerOrder = {
  id: string;
  number: string;
  status: string;
  totalMinor: number;
  currency: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { session, activeStore } = useAuth();

  const api = useMemo(() => {
    if (!session) return null;

    return createAdminApi({
      baseUrl: authApiOrigin(),
      token: session.access_token,
    });
  }, [session]);

  const customerId = useMemo(() => decodeURIComponent(params.id), [params.id]);

  const load = useCallback(
    (_signal: AbortSignal) =>
      api!.getCustomer(activeStore!.id, customerId),
    [api, activeStore, customerId]
  );

  const query = useAdminQuery(
    api && activeStore
      ? `customer:${activeStore.id}:${customerId}`
      : null,
    load
  );

  if (query.loading) {
    return (
      <div className="grid min-h-64 place-items-center">
        <div className="flex items-center gap-2.5 text-[12px] font-bold text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Loading customer…
        </div>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="mx-auto max-w-3xl rounded-[24px] border border-black/[0.06] bg-card p-8 text-center shadow-[0_14px_44px_rgba(83,61,66,0.05)]">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-tint-foreground">
          <UserRound size={19} />
        </span>

        <h1 className="mt-4 text-[20px] font-black tracking-[-0.03em] text-foreground">
          Customer not found
        </h1>

        <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
          This customer may no longer be available for this store.
        </p>

        <Link
          href="/admin/customers"
          className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-4 text-[11px] font-black text-primary-foreground"
        >
          Back to customers
        </Link>
      </div>
    );
  }

  const customer = query.data.customer as typeof query.data.customer & {
    orders?: CustomerOrder[];
  };

  const orders = customer.orders ?? [];
  const lifetimeValue = orders.reduce(
    (total, order) => total + order.totalMinor,
    0
  );
  const defaultCurrency =
    orders[0]?.currency ?? activeStore?.currency ?? "INR";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1.5 text-[11px] font-black text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Customers
      </Link>

      <section className="rounded-[26px] border border-black/[0.06] bg-card p-5 shadow-[0_14px_44px_rgba(83,61,66,0.055)] sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid size-16 shrink-0 place-items-center rounded-[22px] bg-muted text-[18px] font-black text-tint-foreground ring-1 ring-black/[0.04]">
            {initials(customer.name)}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-tint-foreground">
              Customer profile
            </p>

            <h1 className="mt-1.5 truncate text-[28px] font-black tracking-[-0.045em] text-foreground sm:text-[32px]">
              {customer.name}
            </h1>

            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Mail size={13} strokeWidth={1.8} />
              <span className="truncate">
                {customer.email ?? "Email unavailable"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-64">
            <div className="rounded-2xl bg-muted/50 p-3.5 ring-1 ring-black/[0.05]">
              <p className="text-[9px] font-black uppercase tracking-[0.09em] text-muted-foreground">
                Orders
              </p>
              <p className="mt-1.5 text-[18px] font-black text-foreground">
                {orders.length}
              </p>
            </div>

            <div className="rounded-2xl bg-muted/50 p-3.5 ring-1 ring-black/[0.05]">
              <p className="text-[9px] font-black uppercase tracking-[0.09em] text-muted-foreground">
                Spend
              </p>
              <p className="mt-1.5 truncate text-[14px] font-black text-foreground">
                {formatMoney(
                  lifetimeValue,
                  defaultCurrency as Currency
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-card shadow-[0_14px_44px_rgba(83,61,66,0.05)]">
        <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] bg-muted/50 px-5 py-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.11em] text-tint-foreground">
              Order history
            </p>

            <h2 className="mt-1 text-[15px] font-black tracking-[-0.02em] text-foreground">
              {orders.length}{" "}
              {orders.length === 1 ? "order" : "orders"}
            </h2>
          </div>

          <span className="grid size-9 place-items-center rounded-xl bg-muted text-tint-foreground">
            <ShoppingBag size={15} strokeWidth={1.8} />
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="grid min-h-48 place-items-center px-6 text-center">
            <div>
              <ShoppingBag
                size={20}
                className="mx-auto text-muted-foreground"
              />
              <p className="mt-3 text-[12px] font-black text-foreground">
                No orders yet
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Orders from this customer will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="grid gap-3 px-5 py-4 transition hover:bg-muted/50 sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <div>
                  <p className="text-[12px] font-black text-foreground">
                    {order.number}
                  </p>
                  <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Order
                  </p>
                </div>

                <div>
                  <OrderStatusBadge
                    status={order.status as BadgeStatus}
                  />
                </div>

                <p className="text-[12px] font-black text-foreground sm:min-w-24 sm:text-right">
                  {formatMoney(
                    order.totalMinor,
                    order.currency as Currency
                  )}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
