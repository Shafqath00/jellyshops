"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, Package, ArrowRight } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { createMerchantCommerceApi } from "@/features/commerce/api/client";
import type { OrderListQuery, OrderListResult, MerchantOrderStatus } from "@/features/commerce/api/types";
import { OrderBadge, orderLabel, orderMoney, orderStatuses, orderInputClass, orderButtonClass, orderPanelClass } from "@/features/commerce/components/order-ui";
const initialQuery: OrderListQuery = { sort: "date", direction: "desc", page: 1, pageSize: 25 };
export default function OrdersPage() {
    const { session, activeStore } = useAuth();
    const storeId = activeStore?.id;
    const api = useMemo(() => session?.access_token ? createMerchantCommerceApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", token: session.access_token }) : null, [session?.access_token]);
    const [query, setQuery] = useState<OrderListQuery>(initialQuery);
    const [hydrated, setHydrated] = useState(false);
    const [search, setSearch] = useState("");
    const [result, setResult] = useState<OrderListResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refresh, setRefresh] = useState(0);
    const [updating, setUpdating] = useState<string | null>(null);
    useEffect(() => { const params = new URLSearchParams(window.location.search); const next = { ...initialQuery, ...Object.fromEntries(params), page: Math.max(1, Number(params.get("page")) || 1), pageSize: 25 }; setQuery(next); setSearch(next.query ?? ""); setHydrated(true); }, []);
    useEffect(() => { if (!hydrated)
        return; const timer = setTimeout(() => setQuery(current => current.query === search ? current : { ...current, query: search, page: 1 }), 300); return () => clearTimeout(timer); }, [search, hydrated]);
    useEffect(() => { if (!hydrated)
        return; const params = new URLSearchParams(); for (const [key, value] of Object.entries(query))
        if (value !== undefined && value !== "")
            params.set(key, String(value)); window.history.replaceState(null, "", `${window.location.pathname}?${params}`); }, [query, hydrated]);
    useEffect(() => { let active = true; if (!hydrated)
        return; if (!api || !storeId) {
        setLoading(false);
        return;
    } setLoading(true); api.queryOrders(storeId, query).then(data => { if (active) {
        setResult({ ...data, total: data.total ?? data.orders.length, page: data.page ?? 1, pageSize: data.pageSize ?? 25, summary: data.summary ?? {} });
        setError("");
    } }).catch(caught => { if (active)
        setError(caught instanceof Error ? caught.message : "Unable to load orders"); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; }; }, [api, storeId, query, refresh, hydrated]);
    useEffect(() => { const focus = () => setRefresh(value => value + 1); window.addEventListener("focus", focus); const timer = result?.orders.some(order => order.status === "PENDING_PAYMENT" || order.paymentStatus === "PROCESSING") ? setInterval(focus, 5000) : null; return () => { window.removeEventListener("focus", focus); if (timer)
        clearInterval(timer); }; }, [result]);
    const update = (key: string, value: string) => setQuery(current => ({ ...current, [key]: value, page: 1 }));
    const summary = result?.summary ?? {};
    async function advance(orderId: string, status: MerchantOrderStatus) { if (!api || !storeId)
        return; setUpdating(orderId); setError(""); try {
        await api.transitionFulfilment(storeId, orderId, status);
        setRefresh(value => value + 1);
    }
    catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to update order");
    }
    finally {
        setUpdating(null);
    } }
    return <div className="space-y-5"><header className="flex items-end justify-between"><div><p className="text-xs font-semibold text-muted-foreground">Merchant workspace</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Orders</h1></div><button className={orderButtonClass} onClick={() => setRefresh(value => value + 1)}>Refresh</button></header>
    {result?.featureEnabled === false && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div><strong>Order workspace is in preview</strong><p className="mt-1">{["OWNER", "ADMIN"].includes(activeStore?.role ?? "") ? "Enable it for this store to manage shipments, financial edits and customer communication." : "An owner or administrator can enable order management for this store."}</p></div>{["OWNER", "ADMIN"].includes(activeStore?.role ?? "") && <button className={orderButtonClass} disabled={loading} onClick={async () => { if (!api || !storeId)
        return; setLoading(true); try {
        await api.setOrderWorkspaceEnabled(storeId, true);
        setRefresh(value => value + 1);
    }
    catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to enable workspace");
        setLoading(false);
    } }}>Enable order workspace</button>}</div>}<section aria-label="Order summary" className={`${orderPanelClass} grid grid-cols-3 divide-x divide-border overflow-hidden lg:grid-cols-9`}>{["TOTAL", ...orderStatuses].map(status => <button key={status} className="min-w-0 px-3 py-4 text-left hover:bg-muted" onClick={() => update("status", status === "TOTAL" ? "" : status)}><span className="block min-h-8 text-[10px] leading-4 text-muted-foreground">{status === "PAID" ? "Awaiting confirmation" : status === "TOTAL" ? "Total orders" : orderLabel(status)}</span><strong className="text-xl tabular-nums">{summary[status] ?? summary[status.toLowerCase()] ?? (status === "TOTAL" ? result?.total : undefined) ?? "—"}</strong></button>)}</section>
    <section className={`${orderPanelClass} overflow-hidden`}><div className="flex flex-wrap gap-3 border-b border-border p-3"><label className="relative min-w-48 flex-1"><span className="sr-only">Search orders</span><Search className="absolute left-3 top-2.5 text-muted-foreground" size={17}/><input className={`${orderInputClass} pl-9`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search order, customer or product"/></label><label><span className="sr-only">Order status</span><select className={orderInputClass} value={query.status ?? ""} onChange={event => update("status", event.target.value)}><option value="">All orders</option>{orderStatuses.map(status => <option key={status}>{status}</option>)}</select></label><label><span className="sr-only">Payment status</span><select className={orderInputClass} value={query.paymentStatus ?? ""} onChange={event => update("paymentStatus", event.target.value)}><option value="">All payments</option>{["PENDING", "PROCESSING", "PAID", "FAILED", "REFUNDED"].map(status => <option key={status}>{status}</option>)}</select></label><label><span className="sr-only">Sort orders</span><select className={orderInputClass} value={query.sort} onChange={event => update("sort", event.target.value)}><option value="date">Date</option><option value="amount">Amount</option><option value="status">Status</option></select></label><button className={orderButtonClass} onClick={() => update("direction", query.direction === "asc" ? "desc" : "asc")}>{query.direction === "asc" ? "Ascending ↑" : "Descending ↓"}</button></div>
    {error && <div role="alert" className="m-4 rounded-lg border border-red-200 p-4 text-sm text-red-800">{error} <button className="underline" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
    {!api && !loading ? <p className="p-8 text-center text-sm">Sign in as a merchant to manage orders.</p> : loading && !result ? <p className="p-12 text-center text-sm" role="status">Loading orders…</p> : !result?.orders.length ? <div className="p-14 text-center"><Package className="mx-auto text-muted-foreground"/><h2 className="mt-3 font-semibold">{search || query.status || query.paymentStatus ? "No matching orders" : "No orders yet"}</h2><p className="mt-2 text-sm text-muted-foreground">{search || query.status || query.paymentStatus ? "Try another search or clear your filters." : "Orders appear here when customers check out."}</p></div> : <div aria-busy={loading}><div className="hidden grid-cols-[1fr_1.2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 bg-muted/50 px-4 py-3 text-xs text-muted-foreground lg:grid"><span>Order / date</span><span>Customer</span><span>Items</span><span>Payment</span><span>Fulfilment</span><span>Total</span><span /></div>{result.orders.map(order => <div key={order.id} className="grid items-center gap-3 border-t border-border px-4 py-4 text-sm hover:bg-muted/50 lg:grid-cols-[1fr_1.2fr_1.5fr_1fr_1fr_1fr_auto]"><div><Link className="font-semibold underline-offset-4 hover:underline" href={`/admin/orders/${order.id}`}>{order.number}</Link><p className="mt-1 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", ...(result.timeZone ? { timeZone: result.timeZone } : {}) })}</p></div><div><span>{String(order.customerSnapshot.name ?? "Customer unavailable")}</span><p className="truncate text-xs text-muted-foreground">{String(order.customerSnapshot.email ?? "")}</p></div><div className="flex items-center gap-2">{order.items?.[0]?.imageSnapshot && <img src={order.items[0].imageSnapshot} alt="" className="size-9 rounded border border-border object-cover"/>}<span className="truncate text-xs">{order.items?.map(item => `${item.titleSnapshot} × ${item.quantity}`).join(", ") || `${order.itemCount ?? "—"} items`}</span></div><div><span className="mr-2 text-xs text-muted-foreground lg:hidden">Payment</span><OrderBadge value={order.paymentStatus}/></div><div><span className="mr-2 text-xs text-muted-foreground lg:hidden">Fulfilment</span><OrderBadge value={order.fulfilmentStatus ?? order.status}/></div><strong className="tabular-nums">{orderMoney(order.totalMinor, order.currency)}</strong>{result.featureEnabled && ["OWNER", "ADMIN", "ORDER_MANAGER"].includes(activeStore?.role ?? "") && ["PAID", "CONFIRMED"].includes(order.status) ? <button className={orderButtonClass} disabled={updating === order.id} onClick={event => { event.preventDefault(); event.stopPropagation(); void advance(order.id, order.status === "PAID" ? "CONFIRMED" : "PROCESSING"); }}>{updating === order.id ? "Updating�" : order.status === "PAID" ? "Confirm" : "Process"}</button> : <Link className={orderButtonClass} href={`/admin/orders/${order.id}`} aria-label={`View ${order.number}`}><ArrowRight size={15}/></Link>}</div>)}</div>}
    {result && result.total > 0 && <footer className="flex items-center justify-between border-t border-border px-4 py-3 text-xs"><span>{result.total} orders · Page {query.page} of {Math.max(1, Math.ceil(result.total / result.pageSize))}</span><div className="flex gap-2"><button className={orderButtonClass} disabled={Number(query.page) <= 1 || loading} onClick={() => setQuery(current => ({ ...current, page: Number(current.page) - 1 }))}>Previous</button><button className={orderButtonClass} disabled={Number(query.page) * result.pageSize >= result.total || loading} onClick={() => setQuery(current => ({ ...current, page: Number(current.page) + 1 }))}>Next</button></div></footer>}</section></div>;
}
