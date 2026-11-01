"use client";

import { AdminPageHeader } from "@/components/admin-ui";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Package, Search } from "lucide-react";

import { useAuth } from "@/features/auth/providers/auth-provider";
import { createMerchantCommerceApi } from "@/features/commerce/api/client";
import type {
  MerchantOrderStatus,
  OrderListQuery,
  OrderListResult,
} from "@/features/commerce/api/types";
import {
  OrderBadge,
  orderButtonClass as buttonClass,
  orderInputClass as inputClass,
  orderLabel,
  orderMoney,
  orderPanelClass as panelClass,
  orderStatuses,
} from "@/features/commerce/components/order-ui";

// -----------------------------------------------------------------------------
// Configuration and types
// -----------------------------------------------------------------------------

const API_BASE_URL =
  process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

const PAGE_SIZE = 25;
const REFRESH_INTERVAL_MS = 5_000;
const SEARCH_DEBOUNCE_MS = 300;

const INITIAL_QUERY: OrderListQuery = {
  sort: "date",
  direction: "desc",
  page: 1,
  pageSize: PAGE_SIZE,
};

const PAYMENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "PAID",
  "FAILED",
  "REFUNDED",
] as const;

const SORT_OPTIONS = [
  { value: "date", label: "Date" },
  { value: "amount", label: "Amount" },
  { value: "status", label: "Status" },
] as const;

const OWNER_ROLES = ["OWNER", "ADMIN"];
const ORDER_MANAGER_ROLES = [...OWNER_ROLES, "ORDER_MANAGER"];

type OrderRowData = OrderListResult["orders"][number];
type FilterKey = "status" | "paymentStatus" | "sort" | "direction";

type OrderFiltersProps = {
  query: OrderListQuery;
  search: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (key: FilterKey, value: string) => void;
};

type OrderRowProps = {
  order: OrderRowData;
  timeZone?: string;
  canManage: boolean;
  updating: string | null;
  onAdvance: (orderId: string, status: MerchantOrderStatus) => void;
};

// Only persist known order-list parameters; keep the page number numeric.
function readQueryFromUrl(): OrderListQuery {
  const params = new URLSearchParams(window.location.search);
  const next: OrderListQuery = { ...INITIAL_QUERY };

  const search = params.get("query");
  const status = params.get("status");
  const paymentStatus = params.get("paymentStatus");
  const sort = params.get("sort");
  const direction = params.get("direction");
  const page = Number(params.get("page"));

  if (search) next.query = search;
  if (status) next.status = status as OrderListQuery["status"];
  if (paymentStatus) {
    next.paymentStatus = paymentStatus as OrderListQuery["paymentStatus"];
  }
  if (sort === "date" || sort === "amount" || sort === "status") {
    next.sort = sort;
  }
  if (direction === "asc" || direction === "desc") {
    next.direction = direction;
  }

  next.page = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  return next;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// -----------------------------------------------------------------------------
// Orders page
// -----------------------------------------------------------------------------

export default function OrdersPage() {
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id;
  const role = activeStore?.role ?? "";

  const api = useMemo(
    () =>
      session?.access_token
        ? createMerchantCommerceApi({
            baseUrl: API_BASE_URL,
            token: session.access_token,
          })
        : null,
    [session?.access_token],
  );

  // Filters and URL state
  const [query, setQuery] = useState<OrderListQuery>(INITIAL_QUERY);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");

  // Orders and action state
  const [result, setResult] = useState<OrderListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);

  const canEnableWorkspace = OWNER_ROLES.includes(role);
  const canManageOrders = ORDER_MANAGER_ROLES.includes(role);

  // Initialize filters from the address bar after mounting.
  useEffect(() => {
    const next = readQueryFromUrl();
    setQuery(next);
    setSearch(next.query ?? "");
    setHydrated(true);
  }, []);

  // Debounce search requests and reset pagination after a search change.
  useEffect(() => {
    if (!hydrated) return;

    const timer = window.setTimeout(() => {
      setQuery((current) =>
        current.query === search
          ? current
          : { ...current, query: search, page: 1 },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search, hydrated]);

  // Reflect the current filters in the URL without a page navigation.
  useEffect(() => {
    if (!hydrated) return;

    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    }

    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
  }, [query, hydrated]);

  // Fetch orders whenever the store, filters, or refresh counter changes.
  useEffect(() => {
    if (!hydrated) return;

    if (!api || !storeId) {
      setResult(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    void api
      .queryOrders(storeId, query)
      .then((data) => {
        if (!active) return;

        setResult({
          ...data,
          total: data.total ?? data.orders.length,
          page: data.page ?? 1,
          pageSize: data.pageSize ?? PAGE_SIZE,
          summary: data.summary ?? {},
        });
        setError("");
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(getErrorMessage(caught, "Unable to load orders"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, storeId, query, refresh, hydrated]);

  // Refresh on window focus, and poll while a payment is pending.
  useEffect(() => {
    if (!hydrated || !api || !storeId) return;

    const refreshOrders = () => setRefresh((value) => value + 1);
    window.addEventListener("focus", refreshOrders);

    const hasPendingPayments = result?.orders.some(
      (order) =>
        order.status === "PENDING_PAYMENT" ||
        order.paymentStatus === "PROCESSING",
    );

    const interval = hasPendingPayments
      ? window.setInterval(refreshOrders, REFRESH_INTERVAL_MS)
      : null;

    return () => {
      window.removeEventListener("focus", refreshOrders);
      if (interval !== null) window.clearInterval(interval);
    };
  }, [hydrated, api, storeId, result]);

  // Actions
  function refreshOrders() {
    setRefresh((value) => value + 1);
  }

  function updateFilter(key: FilterKey, value: string) {
    setQuery((current) => ({ ...current, [key]: value, page: 1 }));
  }

  function changePage(delta: number) {
    setQuery((current) => ({
      ...current,
      page: Math.max(1, Number(current.page ?? 1) + delta),
    }));
  }

  async function advanceOrder(
    orderId: string,
    status: MerchantOrderStatus,
  ) {
    if (!api || !storeId || updating) return;

    setUpdating(orderId);
    setError("");

    try {
      await api.transitionFulfilment(storeId, orderId, status);
      refreshOrders();
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to update order"));
    } finally {
      setUpdating(null);
    }
  }

  async function enableWorkspace() {
    if (!api || !storeId || enabling) return;

    setEnabling(true);
    setError("");

    try {
      await api.setOrderWorkspaceEnabled(storeId, true);
      refreshOrders();
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to enable workspace"));
    } finally {
      setEnabling(false);
    }
  }

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.pageSize))
    : 1;

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Orders" actions={<button type="button" className={buttonClass} onClick={refreshOrders}>Refresh</button>} />

      {result?.featureEnabled === false && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div>
            <strong>Order workspace is in preview</strong>
            <p className="mt-1">
              {canEnableWorkspace
                ? "Enable it for this store to manage shipments, financial edits and customer communication."
                : "An owner or administrator can enable order management for this store."}
            </p>
          </div>

          {canEnableWorkspace && (
            <button
              type="button"
              className={buttonClass}
              disabled={enabling || loading}
              onClick={() => void enableWorkspace()}
            >
              {enabling ? "Enabling…" : "Enable order workspace"}
            </button>
          )}
        </div>
      )}

      <OrderSummary result={result} onStatusChange={(status) => updateFilter("status", status)} />

      <section className={`${panelClass} overflow-hidden`}>
        <OrderFilters
          query={query}
          search={search}
          onSearchChange={setSearch}
          onFilterChange={updateFilter}
        />

        {error && (
          <div
            role="alert"
            className="m-4 rounded-lg border border-red-200 p-4 text-sm text-red-800"
          >
            {error}{" "}
            <button type="button" className="underline" onClick={refreshOrders}>
              Try again
            </button>
          </div>
        )}

        {!api && !loading ? (
          <p className="p-8 text-center text-sm">
            Sign in as a merchant to manage orders.
          </p>
        ) : loading && !result ? (
          <p role="status" className="p-12 text-center text-sm">
            Loading orders…
          </p>
        ) : !result?.orders.length ? (
          <EmptyOrders hasFilters={Boolean(search || query.status || query.paymentStatus)} />
        ) : (
          <OrderList
            result={result}
            loading={loading}
            updating={updating}
            canManage={canManageOrders}
            onAdvance={(orderId, status) => void advanceOrder(orderId, status)}
          />
        )}

        {result && result.total > 0 && (
          <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs">
            <span>
              {result.total} orders · Page {query.page} of {totalPages}
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                className={buttonClass}
                disabled={Number(query.page) <= 1 || loading}
                onClick={() => changePage(-1)}
              >
                Previous
              </button>
              <button
                type="button"
                className={buttonClass}
                disabled={Number(query.page) >= totalPages || loading}
                onClick={() => changePage(1)}
              >
                Next
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Summary and filters
// -----------------------------------------------------------------------------

function OrderSummary({
  result,
  onStatusChange,
}: {
  result: OrderListResult | null;
  onStatusChange: (status: string) => void;
}) {
  const summary = result?.summary ?? {};

  return (
    <section
      aria-label="Order summary"
      className={`${panelClass} grid grid-cols-3 divide-x divide-border overflow-hidden lg:grid-cols-9`}
    >
      {["TOTAL", ...orderStatuses].map((status) => {
        const label =
          status === "PAID"
            ? "Awaiting confirmation"
            : status === "TOTAL"
              ? "Total orders"
              : orderLabel(status);

        const count =
          summary[status] ??
          summary[status.toLowerCase()] ??
          (status === "TOTAL" ? result?.total : undefined) ??
          "—";

        return (
          <button
            type="button"
            key={status}
            className="min-w-0 px-3 py-4 text-left hover:bg-muted"
            onClick={() => onStatusChange(status === "TOTAL" ? "" : status)}
          >
            <span className="block min-h-8 text-[12px] leading-4 text-muted-foreground">
              {label}
            </span>
            <strong className="text-xl tabular-nums">{count}</strong>
          </button>
        );
      })}
    </section>
  );
}

function OrderFilters({
  query,
  search,
  onSearchChange,
  onFilterChange,
}: OrderFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 border-b border-border p-3">
      <label className="relative min-w-48 flex-1">
        <span className="sr-only">Search orders</span>
        <Search
          size={17}
          className="absolute left-3 top-2.5 text-muted-foreground"
        />
        <input
          type="search"
          className={`${inputClass} pl-9`}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search order, customer or product"
        />
      </label>

      <label>
        <span className="sr-only">Order status</span>
        <select
          className={inputClass}
          value={query.status ?? ""}
          onChange={(event) => onFilterChange("status", event.target.value)}
        >
          <option value="">All orders</option>
          {orderStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="sr-only">Payment status</span>
        <select
          className={inputClass}
          value={query.paymentStatus ?? ""}
          onChange={(event) => onFilterChange("paymentStatus", event.target.value)}
        >
          <option value="">All payments</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="sr-only">Sort orders</span>
        <select
          className={inputClass}
          value={query.sort}
          onChange={(event) => onFilterChange("sort", event.target.value)}
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={buttonClass}
        onClick={() =>
          onFilterChange(
            "direction",
            query.direction === "asc" ? "desc" : "asc",
          )
        }
      >
        {query.direction === "asc" ? "Ascending ↑" : "Descending ↓"}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Order list and row
// -----------------------------------------------------------------------------

function EmptyOrders({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="p-14 text-center">
      <Package className="mx-auto text-muted-foreground" />
      <h2 className="mt-3 font-semibold">
        {hasFilters ? "No matching orders" : "No orders yet"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasFilters
          ? "Try another search or clear your filters."
          : "Orders appear here when customers check out."}
      </p>
    </div>
  );
}

function OrderList({
  result,
  loading,
  updating,
  canManage,
  onAdvance,
}: {
  result: OrderListResult;
  loading: boolean;
  updating: string | null;
  canManage: boolean;
  onAdvance: OrderRowProps["onAdvance"];
}) {
  return (
    <div aria-busy={loading}>
      <div className="hidden grid-cols-[1fr_1.2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 bg-muted/50 px-4 py-3 text-xs text-muted-foreground lg:grid">
        <span>Order / date</span>
        <span>Customer</span>
        <span>Items</span>
        <span>Payment</span>
        <span>Fulfilment</span>
        <span>Total</span>
        <span />
      </div>

      {result.orders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          timeZone={result.timeZone}
          canManage={Boolean(result.featureEnabled) && canManage}
          updating={updating}
          onAdvance={onAdvance}
        />
      ))}
    </div>
  );
}

function OrderRow({
  order,
  timeZone,
  canManage,
  updating,
  onAdvance,
}: OrderRowProps) {
  const orderUrl = `/admin/orders/${order.id}`;
  const canAdvance =
    canManage && (order.status === "PAID" || order.status === "CONFIRMED");

  const nextStatus: MerchantOrderStatus =
    order.status === "PAID" ? "CONFIRMED" : "PROCESSING";

  const itemsDescription =
    order.items?.map((item) => `${item.titleSnapshot} × ${item.quantity}`).join(", ") ||
    `${order.itemCount ?? "—"} items`;

  return (
    <div className="grid items-center gap-3 border-t border-border px-4 py-4 text-sm hover:bg-muted/50 lg:grid-cols-[1fr_1.2fr_1.5fr_1fr_1fr_1fr_auto]">
      <div>
        <Link
          href={orderUrl}
          className="font-semibold underline-offset-4 hover:underline"
        >
          {order.number}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(order.createdAt).toLocaleString("en", {
            dateStyle: "medium",
            timeStyle: "short",
            ...(timeZone ? { timeZone } : {}),
          })}
        </p>
      </div>

      <div>
        <span>{String(order.customerSnapshot.name ?? "Customer unavailable")}</span>
        <p className="truncate text-xs text-muted-foreground">
          {String(order.customerSnapshot.email ?? "")}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {order.items?.[0]?.imageSnapshot && (
          <img
            src={order.items[0].imageSnapshot}
            alt=""
            className="size-9 rounded border border-border object-cover"
          />
        )}
        <span className="truncate text-xs">{itemsDescription}</span>
      </div>

      <div>
        <span className="mr-2 text-xs text-muted-foreground lg:hidden">
          Payment
        </span>
        <OrderBadge value={order.paymentStatus} />
      </div>

      <div>
        <span className="mr-2 text-xs text-muted-foreground lg:hidden">
          Fulfilment
        </span>
        <OrderBadge value={order.fulfilmentStatus ?? order.status} />
      </div>

      <strong className="tabular-nums">
        {orderMoney(order.totalMinor, order.currency)}
      </strong>

      {canAdvance ? (
        <button
          type="button"
          className={buttonClass}
          disabled={updating !== null}
          onClick={() => onAdvance(order.id, nextStatus)}
        >
          {updating === order.id
            ? "Updating…"
            : order.status === "PAID"
              ? "Confirm"
              : "Process"}
        </button>
      ) : (
        <Link
          href={orderUrl}
          className={buttonClass}
          aria-label={`View ${order.number}`}
        >
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
