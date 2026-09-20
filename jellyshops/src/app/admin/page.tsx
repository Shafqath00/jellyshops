"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  PackageCheck,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { authApiOrigin, useAuth } from "@/features/auth/auth-provider";
import { createAdminApi } from "@/features/admin/api";
import { useAdminQuery } from "@/features/admin/use-admin-query";
import { OrderStatusBadge } from "@/components/order-status";
import type { OrderStatus } from "@/lib/domain";

function getCustomerName(snapshot?: Record<string, unknown> | null) {
  const name = snapshot?.name;
  return typeof name === "string" && name.trim() ? name.trim() : "Customer";
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export default function DashboardPage() {
  const { session, activeStore } = useAuth();
  const api = useMemo(() => session ? createAdminApi({ baseUrl: authApiOrigin(), token: session.access_token }) : null, [session]);
  const load = useCallback((_signal: AbortSignal) => api!.getSummary(activeStore!.id), [api, activeStore]);
  const query = useAdminQuery(api && activeStore ? `summary:${activeStore.id}` : null, load);
  if (query.loading) return <div className="admin-page"><div className="form-card">Loading dashboard…</div></div>;
  if (query.error || !query.data || !activeStore) return <div className="admin-page"><div className="form-card" role="alert">{query.error?.message ?? "Dashboard unavailable"}<button className="button button-secondary" onClick={query.retry}>Retry</button></div></div>;
  const store = activeStore;
  const { actionableOrders: needsAttention, revenueMinor: revenue, orderCount, publishedProductCount, lowStock } = query.data;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-[12px] font-medium text-[#6d7175]">
            Sunday, 30 August
          </p>

          <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-[#202223] sm:text-[28px]">
            Good evening, Maya.
          </h1>

          <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-[#6d7175]">
            Here&apos;s what&apos;s happening with{" "}
            <span className="font-medium text-[#454f5b]">
              {store.name}
            </span>{" "}
            today.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={`/${store.slug}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#c9cccf] bg-white px-3.5 text-[13px] font-semibold text-[#303030] shadow-[0_1px_0_rgba(0,0,0,0.04)] transition hover:bg-[#f6f6f7]"
          >
            View store
            <ArrowUpRight size={14} strokeWidth={1.8} />
          </Link>

          <Link
            href="/admin/products/new"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#303030] px-3.5 text-[13px] font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.15)] transition hover:bg-[#1f1f1f]"
          >
            <Plus size={15} strokeWidth={2} />
            Add product
          </Link>
        </div>
      </header>

      {/* Store setup */}
      <section className="rounded-xl border border-[#dfe3e8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf7f0]">
              <span className="text-[13px] font-bold text-[#29845a]">
                3/3
              </span>
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-[14px] font-semibold text-[#303030]">
                  Your storefront is ready
                </h2>

                <span className="rounded-full bg-[#eaf7f0] px-2 py-0.5 text-[10px] font-semibold text-[#237a50]">
                  Ready
                </span>
              </div>

              <p className="text-[12px] leading-5 text-[#6d7175]">
                Products published, checkout enabled, and shipping
                configured.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[#eeeeee] pt-4 lg:border-0 lg:pt-0">
            {["Store details", "Products", "Shipping"].map((item) => (
              <div
                key={item}
                className="flex items-center gap-1.5 text-[11px] font-medium text-[#454f5b]"
              >
                <span className="grid size-4 place-items-center rounded-full bg-[#eaf7f0] text-[9px] font-bold text-[#29845a]">
                  ✓
                </span>

                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-[#e3e3e3] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#6d7175]">
                Total mock sales
              </p>

              <p className="mt-2 text-[24px] font-semibold tracking-[-0.025em] text-[#202223]">
                {formatMoney(revenue, store.currency)}
              </p>

              <p className="mt-1 text-[11px] text-[#8c9196]">
                Across {orderCount}{" "}
                {orderCount === 1 ? "order" : "orders"}
              </p>
            </div>

            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f1f1f1] text-[#5c5f62]">
              <CircleDollarSign size={18} strokeWidth={1.7} />
            </span>
          </div>
        </article>

        <article className="rounded-xl border border-[#e3e3e3] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium text-[#6d7175]">
                Needs attention
              </p>

              <p className="mt-2 text-[24px] font-semibold tracking-[-0.025em] text-[#202223]">
                {needsAttention.length}
              </p>

              <p className="mt-1 text-[11px] text-[#8c9196]">
                Orders to move forward
              </p>
            </div>

            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f1f1f1] text-[#5c5f62]">
              <PackageCheck size={18} strokeWidth={1.7} />
            </span>
          </div>
        </article>

        <article className="rounded-xl border border-[#e3e3e3] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium text-[#6d7175]">
                Live products
              </p>

              <p className="mt-2 text-[24px] font-semibold tracking-[-0.025em] text-[#202223]">
                {publishedProductCount}
              </p>

              <p className="mt-1 text-[11px] text-[#8c9196]">
                {lowStock.length}{" "}
                {lowStock.length === 1 ? "product" : "products"} running
                low
              </p>
            </div>

            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f1f1f1] text-[#5c5f62]">
              <Boxes size={18} strokeWidth={1.7} />
            </span>
          </div>
        </article>
      </section>

      {/* Dashboard lists */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        {/* Orders */}
        <section className="overflow-hidden rounded-xl border border-[#e3e3e3] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex min-h-[64px] items-center justify-between gap-4 border-b border-[#eeeeee] px-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8c9196]">
                Order queue
              </p>

              <h2 className="mt-0.5 text-[15px] font-semibold text-[#303030]">
                What&apos;s moving
              </h2>
            </div>

            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#454f5b] hover:text-[#202223]"
            >
              View all
              <ArrowUpRight size={13} />
            </Link>
          </div>

          {needsAttention.length > 0 ? (
            <div className="divide-y divide-[#eeeeee]">
              {needsAttention.slice(0, 4).map((order) => {
                const customerName = getCustomerName(order.customerSnapshot);

                return (
                  <Link
                    href={`/admin/orders/${order.id}`}
                    key={order.id}
                    className="group grid min-h-[68px] grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-5 transition-colors hover:bg-[#fafafa] sm:grid-cols-[36px_minmax(0,1fr)_auto_auto]"
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-[#f1f1f1] text-[12px] font-semibold text-[#454f5b]">
                      {customerName.charAt(0).toUpperCase()}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[#303030]">
                        {customerName}
                      </p>

                      <p className="mt-0.5 truncate text-[11px] text-[#8c9196]">
                        {order.number}
                      </p>
                    </div>

                    <div className="hidden sm:block">
                      <OrderStatusBadge status={order.status as OrderStatus} />
                    </div>

                    <strong className="text-right text-[12px] font-semibold text-[#303030]">
                      {formatMoney(
                        order.totalMinor,
                        order.currency
                      )}
                    </strong>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-[220px] place-items-center px-6 py-10 text-center">
              <div>
                <span className="mx-auto grid size-10 place-items-center rounded-full bg-[#f1f1f1] text-[#6d7175]">
                  <PackageCheck size={18} />
                </span>

                <p className="mt-3 text-[13px] font-semibold text-[#303030]">
                  No orders need attention
                </p>

                <p className="mt-1 text-[11px] text-[#8c9196]">
                  New orders that need action will appear here.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Inventory */}
        <section className="overflow-hidden rounded-xl border border-[#e3e3e3] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex min-h-[64px] items-center justify-between gap-4 border-b border-[#eeeeee] px-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8c9196]">
                Inventory
              </p>

              <h2 className="mt-0.5 text-[15px] font-semibold text-[#303030]">
                Running low
              </h2>
            </div>

            <Link
              href="/admin/products"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#454f5b] hover:text-[#202223]"
            >
              Catalog
              <ArrowUpRight size={13} />
            </Link>
          </div>

          {lowStock.length > 0 ? (
            <div className="divide-y divide-[#eeeeee]">
              {lowStock.slice(0, 5).map((item) => (
                <Link
                  href={`/admin/products/${item.productId}`}
                  key={item.variantId}
                  className="group flex min-h-[68px] items-center gap-3 px-5 transition-colors hover:bg-[#fafafa]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#e3e3e3] bg-[#f7f7f7] text-[#6d7175]">
                    <Boxes size={18} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#303030]">
                      {item.title}
                    </p>

                    <p className="mt-0.5 truncate text-[11px] text-[#8c9196]">
                      {item.sku ?? "No SKU"}
                    </p>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff4e5] px-2 py-1 text-[10px] font-semibold text-[#8a6116]">
                    <TriangleAlert size={11} strokeWidth={2} />
                    {item.quantity} left
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid min-h-[220px] place-items-center px-6 py-10 text-center">
              <div>
                <span className="mx-auto grid size-10 place-items-center rounded-full bg-[#f1f1f1] text-[#6d7175]">
                  <Boxes size={18} />
                </span>

                <p className="mt-3 text-[13px] font-semibold text-[#303030]">
                  Inventory looks healthy
                </p>

                <p className="mt-1 text-[11px] text-[#8c9196]">
                  Products with low stock will appear here.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
