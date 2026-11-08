"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { AdminPage, Banner, EmptyState, IndexTable, StatusBadge, statusOptions, type IndexColumn, type IndexTab } from "@/components/admin";

import { useAuth } from "@/features/auth/providers/auth-provider";
import { createMerchantCommerceApi } from "@/features/commerce/api/client";
import type {
  MerchantOrderStatus,
  OrderListQuery,
  OrderListResult,
} from "@/features/commerce/api/types";
import { orderMoney } from "@/features/commerce/components/order-ui";
import { downloadOrdersCsv } from "@/features/commerce/orders-csv";

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

/** View tabs: each shows orders at one step. "Paid" orders still need the merchant to confirm them. */
const ORDER_VIEWS = [
  { status: "PENDING_PAYMENT", label: "Waiting for payment" },
  { status: "PAID", label: "To confirm" },
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "PROCESSING", label: "Being prepared" },
  { status: "SHIPPED", label: "Shipped" },
  { status: "DELIVERED", label: "Delivered" },
  { status: "CANCELLED", label: "Cancelled" },
  { status: "REFUNDED", label: "Refunded" },
] as const;

const OWNER_ROLES = ["OWNER", "ADMIN"];
const ORDER_MANAGER_ROLES = [...OWNER_ROLES, "ORDER_MANAGER"];

type OrderRowData = OrderListResult["orders"][number];
type FilterKey = "status" | "paymentStatus" | "sort" | "direction";

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
  const summary = result?.summary ?? {};
  const countFor = (status: string) => summary[status] ?? summary[status.toLowerCase()];
  const tabs: IndexTab[] = [
    { id: "", label: "All", count: countFor("TOTAL") ?? countFor("total") ?? (!query.status ? result?.total : undefined) },
    ...ORDER_VIEWS.map((view) => ({ id: view.status, label: view.label, count: countFor(view.status) })),
  ];
  const hasFilters = Boolean(search || query.status || query.paymentStatus);

  return (
    <AdminPage
      title="Orders"
      description="Every order placed in your store. Open an order to fulfil it, refund it or contact the customer."
      secondaryActions={[{ label: loading ? "Refreshing…" : "Refresh", onAction: refreshOrders, disabled: loading }]}
    >
      {result?.featureEnabled === false && (
        <Banner
          tone="warning"
          title="Order workspace is in preview"
          action={canEnableWorkspace ? (
            <button type="button" className="jk-button" disabled={enabling || loading} onClick={() => void enableWorkspace()}>
              {enabling ? "Enabling…" : "Enable order workspace"}
            </button>
          ) : undefined}
        >
          {canEnableWorkspace
            ? "Enable it for this store to manage shipments, order edits and customer emails."
            : "An owner or administrator can enable order management for this store."}
        </Banner>
      )}

      {!api && !loading ? (
        <p className="jk-muted">Sign in as a merchant to manage orders.</p>
      ) : (
        <IndexTable
          label="Orders"
          rows={result?.orders ?? []}
          rowKey={(order) => order.id}
          rowLabel={(order) => `order ${order.number}`}
          columns={orderColumns({ timeZone: result?.timeZone, canManage: Boolean(result?.featureEnabled) && canManageOrders, updating, onAdvance: (orderId, status) => void advanceOrder(orderId, status) })}
          loading={loading}
          error={error}
          onRetry={refreshOrders}
          tabs={tabs}
          activeTab={query.status ?? ""}
          onTabChange={(status) => updateFilter("status", status)}
          search={{ value: search, onChange: setSearch, label: "Search orders", placeholder: "Search by order number, customer or product" }}
          filters={<OrderFilters query={query} onFilterChange={updateFilter} />}
          bulkActions={[{ label: "Export to CSV", onAction: (ids) => downloadOrdersCsv((result?.orders ?? []).filter((order) => ids.includes(order.id))) }]}
          emptyState={hasFilters
            ? <EmptyState icon={Package} title="No matching orders" description="Try another search, or choose All to clear the view." />
            : <EmptyState icon={Package} title="No orders yet" description="When a customer checks out, their order appears here so you can pack it and send it." />}
          pagination={result && result.total > 0 ? {
            summary: `${result.total} ${result.total === 1 ? "order" : "orders"} · Page ${query.page} of ${totalPages}`,
            hasPrevious: Number(query.page) > 1,
            hasNext: Number(query.page) < totalPages,
            onPrevious: () => changePage(-1),
            onNext: () => changePage(1),
          } : undefined}
        />
      )}
    </AdminPage>
  );
}

// -----------------------------------------------------------------------------
// Filters, columns and export
// -----------------------------------------------------------------------------

function OrderFilters({ query, onFilterChange }: { query: OrderListQuery; onFilterChange: (key: FilterKey, value: string) => void }) {
  return (
    <>
      <label>
        <span className="sr-only">Payment status</span>
        <select className="jk-select" value={query.paymentStatus ?? ""} onChange={(event) => onFilterChange("paymentStatus", event.target.value)}>
          <option value="">Any payment</option>
          {statusOptions("payment", PAYMENT_STATUSES).map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>
        <span className="sr-only">Sort orders</span>
        <select className="jk-select" value={query.sort} onChange={(event) => onFilterChange("sort", event.target.value)}>
          {SORT_OPTIONS.map(({ value, label }) => <option key={value} value={value}>Sort by {label.toLowerCase()}</option>)}
        </select>
      </label>
      <button type="button" className="jk-button" onClick={() => onFilterChange("direction", query.direction === "asc" ? "desc" : "asc")}>
        {query.direction === "asc" ? "Oldest first" : "Newest first"}
      </button>
    </>
  );
}

/** A cancelled or refunded order is not waiting to be sent, so it never shows as "Unfulfilled". */
function fulfilmentShown(order: OrderRowData) {
  const closed = order.status === "CANCELLED" || order.status === "REFUNDED";
  return closed && (!order.fulfilmentStatus || order.fulfilmentStatus === "UNFULFILLED") ? order.status : order.fulfilmentStatus ?? order.status;
}

function orderColumns({ timeZone, canManage, updating, onAdvance }: Omit<OrderRowProps, "order">): IndexColumn<OrderRowData>[] {
  return [
    {
      id: "order", header: "Order", mobile: "primary",
      cell: (order) => (
        <div>
          <Link href={`/admin/orders/${order.id}`} className="jk-cell-strong">{order.number}</Link>
          <span className="jk-cell-sub">{new Date(order.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", ...(timeZone ? { timeZone } : {}) })}</span>
        </div>
      ),
    },
    {
      id: "customer", header: "Customer",
      cell: (order) => (
        <div className="min-w-0">
          <span>{String(order.customerSnapshot.name ?? "No name given")}</span>
          {order.customerSnapshot.email ? <span className="jk-cell-sub truncate">{String(order.customerSnapshot.email)}</span> : null}
        </div>
      ),
    },
    {
      id: "items", header: "Items", mobile: "hidden",
      cell: (order) => (
        <div className="flex max-w-72 items-center gap-2">
          {order.items?.[0]?.imageSnapshot && <img src={order.items[0].imageSnapshot} alt="" className="jk-thumb !size-8" />}
          <span className="truncate">{order.items?.map((item) => `${item.titleSnapshot} × ${item.quantity}`).join(", ") || `${order.itemCount ?? 0} items`}</span>
        </div>
      ),
    },
    { id: "payment", header: "Payment", cell: (order) => <StatusBadge kind="payment" value={order.paymentStatus} /> },
    { id: "fulfilment", header: "Fulfilment", cell: (order) => <StatusBadge kind="fulfilment" value={fulfilmentShown(order)} /> },
    { id: "total", header: "Total", align: "end", cell: (order) => <strong className="tabular-nums">{orderMoney(order.totalMinor, order.currency)}</strong> },
    {
      id: "next", header: "Next step", hideHeader: true, align: "end",
      cell: (order) => {
        const canAdvance = canManage && (order.status === "PAID" || order.status === "CONFIRMED");
        if (!canAdvance) return null;
        const nextStatus: MerchantOrderStatus = order.status === "PAID" ? "CONFIRMED" : "PROCESSING";
        return (
          <button type="button" className="jk-button" disabled={updating !== null} onClick={() => onAdvance(order.id, nextStatus)}>
            {updating === order.id ? "Updating…" : order.status === "PAID" ? "Confirm order" : "Start preparing"}
          </button>
        );
      },
    },
  ];
}
