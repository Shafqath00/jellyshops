"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Package, Download, X } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { createMerchantCommerceApi, createCommerceApi } from "@/features/commerce/api/client";
import type { MerchantOrderDetail, MerchantOrderStatus, OrderEditPreview } from "@/features/commerce/api/types";
import { OrderBadge, orderLabel, orderMoney, orderInputClass as input, orderButtonClass as button, orderPanelClass as panel } from "@/features/commerce/components/order-ui";
const nextActions: Partial<Record<MerchantOrderStatus, {
    status: MerchantOrderStatus;
    label: string;
}>> = { PAID: { status: "CONFIRMED", label: "Confirm order" }, CONFIRMED: { status: "PROCESSING", label: "Start processing" } };
type Action = "cancel" | "refund" | "edit" | "contact" | "tracking" | "fulfil" | "return" | "resend";
export function OrderDetailView({ orderId }: {
    orderId: string;
}) {
    const { session, activeStore } = useAuth();
    const storeId = activeStore?.id;
    const api = useMemo(() => session?.access_token ? createMerchantCommerceApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", token: session.access_token }) : null, [session?.access_token]);
    const context = useRef("");
    context.current = `${storeId}/${orderId}/${session?.access_token}`;
    const [catalog, setCatalog] = useState<Array<{
        id: string;
        name: string;
        variants: Array<{
            id: string;
            name: string;
        }>;
    }>>([]);
    const [added, setAdded] = useState<Array<{
        variantId: string;
        title: string;
        quantity: number;
    }>>([]);
    const [detail, setDetail] = useState<MerchantOrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [action, setAction] = useState<Action | null>(null);
    const [note, setNote] = useState("");
    const [form, setForm] = useState<Record<string, string>>({});
    const [quantities, setQuantities] = useState<number[]>([]);
    const [preview, setPreview] = useState<OrderEditPreview | null>(null);
    const [notice, setNotice] = useState("");
    const key = useRef("");
    const load = useCallback(async () => { if (!api || !storeId) {
        setLoading(false);
        return;
    } const scope = context.current; try {
        const response = await api.getOrder(storeId, orderId);
        if (context.current !== scope)
            return;
        setDetail(response);
    }
    catch (caught) {
        if (context.current === scope)
            setError(caught instanceof Error ? caught.message : "Unable to load order");
    }
    finally {
        if (context.current === scope)
            setLoading(false);
    } }, [api, storeId, orderId]);
    useEffect(() => { setDetail(null); setLoading(true); void load(); }, [load]);
    useEffect(() => { const focus = () => void load(); window.addEventListener("focus", focus); const pending = detail?.order.status === "PENDING_PAYMENT" || detail?.payment?.status === "PROCESSING" || detail?.transactions?.some(transaction => transaction.status === "PENDING") || detail?.refunds.some(refund => ["PENDING", "REQUIRES_ACTION"].includes(refund.status)) || detail?.revisions?.some(revision => ["PENDING", "PENDING_PAYMENT", "PENDING_REFUND", "PREPARING", "SETTLING"].includes(revision.status)); const timer = pending ? setInterval(focus, 5000) : null; return () => { window.removeEventListener("focus", focus); if (timer)
        clearInterval(timer); }; }, [detail, load]);
    async function run(task: () => Promise<unknown>, close = true) { setBusy(true); setError(""); setNotice(""); try {
        await task();
        if (close)
            setAction(null);
        await load();
        setNotice("Order updated.");
        return true;
    }
    catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to update order");
        return false;
    }
    finally {
        setBusy(false);
    } }
    function open(next: Action) { if (!detail)
        return; setAction(next); setAdded([]); if (next === "edit" && storeId)
        void createCommerceApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }).getPublicCatalog(storeId).then(products => setCatalog(products.map(product => ({ id: product.id, name: product.name, variants: product.variants })))).catch(caught => setError(caught instanceof Error ? caught.message : "Unable to load products")); setError(""); setPreview(null); key.current = crypto.randomUUID(); setQuantities(detail.items.map(item => next === "edit" ? item.quantity : 0)); setForm({ name: String(detail.order.customerSnapshot.name ?? ""), email: String(detail.order.customerSnapshot.email ?? ""), phone: String(detail.order.customerSnapshot.phone ?? ""), reason: "", refundMode: "amount", amount: String(detail.order.totalMinor / 100), ...Object.fromEntries(["shipping", "billing"].flatMap(prefix => { const address = (prefix === "shipping" ? detail.order.deliverySnapshot?.address ?? detail.order.customerSnapshot.address : detail.order.billingAddress) as Record<string, unknown> | undefined; return ["line1", "line2", "city", "region", "postalCode", "country"].map(name => [`${prefix}_${name}`, String(address?.[name] ?? "")]); })), type: "PLACED", trackingNumber: "", carrier: "", trackingUrl: "" }); }
    const field = (name: string, value: string) => { setForm(current => ({ ...current, [name]: value })); setPreview(null); };
    if (loading)
        return <p className={`${panel} p-12 text-center`} role="status">Loading order…</p>;
    if (!detail)
        return <div className={`${panel} p-8`}><h1 className="text-xl font-bold">Order unavailable</h1><p role="alert" className="mt-3 text-sm">{error || "Sign in as a merchant to manage orders."}</p><button className={`${button} mt-4`} onClick={() => void load()}>Try again</button></div>;
    const { order, items, payment } = detail;
    const revision = order.revision ?? 1;
    const money = (minor: number) => orderMoney(minor, order.currency);
    const capability = (name: string) => detail.capabilities ? detail.capabilities[name] === true : true;
    const canManage = capability("manage");
    const canRefund = capability("refund");
    const canEdit = capability("edit");
    const physicalItems = items.some(item => (item.fulfillmentType ?? item.fulfilmentType) !== "DIGITAL"); const next = !physicalItems && order.fulfilmentStatus === "FULFILLED" ? undefined : nextActions[order.status];
    const itemInput = () => [...items.map((item, index) => ({ variantId: item.variantId, configurationKey: item.configurationKey, quantity: quantities[index] ?? 0 })), ...added.map(item => ({ variantId: item.variantId, quantity: item.quantity }))].filter(item => item.quantity > 0);
    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (!api || !storeId || !action)
            return;
        const base = { revision, idempotencyKey: key.current };
        const selected = items.flatMap((item, index) => quantities[index] > 0 ? [{ orderItemId: item.id, variantId: item.variantId, configurationKey: item.configurationKey, quantity: quantities[index] }] : []);
        if (action === "edit" && !preview) {
            setBusy(true);
            setError("");
            try {
                setPreview(await api.previewOrderEdit(storeId, orderId, { revision, items: itemInput() }));
            }
            catch (caught) {
                setError(caught instanceof Error ? caught.message : "Unable to preview changes");
            }
            finally {
                setBusy(false);
            }
            return;
        }
        await run(async () => { switch (action) {
            case "cancel": return api.cancelOrder(storeId, orderId, { ...base, reason: form.reason });
            case "refund": return api.refundOrder(storeId, orderId, { ...base, ...(form.refundMode === "items" ? { items: selected } : { amountMinor: Math.round(Number(form.amount) * 100) }), reason: form.reason });
            case "edit": return api.commitOrderEdit(storeId, orderId, { ...base, items: itemInput() });
            case "contact": return api.updateOrderContact(storeId, orderId, { revision, customerSnapshot: { ...order.customerSnapshot, name: form.name, email: form.email, phone: form.phone }, ...(!["SHIPPED", "DELIVERED"].includes(order.status) && ["line1", "city", "country"].some(name => form[`shipping_${name}`]) ? { deliverySnapshot: { ...order.deliverySnapshot, address: Object.fromEntries(["line1", "line2", "city", "region", "postalCode", "country"].map(name => [name, form[`shipping_${name}`]])) } } : {}), ...(["line1", "city", "country"].some(name => form[`billing_${name}`]) ? { billingAddress: Object.fromEntries(["line1", "line2", "city", "region", "postalCode", "country"].map(name => [name, form[`billing_${name}`]])) } : {}) });
            case "tracking": return api.updateOrderTracking(storeId, orderId, { revision, fulfilmentId: form.fulfilmentId || detail?.fulfilments?.[0]?.id, trackingNumber: form.trackingNumber, trackingUrl: form.trackingUrl || undefined, carrier: form.carrier });
            case "fulfil": return api.fulfilOrder(storeId, orderId, { ...base, items: selected, trackingNumber: form.trackingNumber, trackingUrl: form.trackingUrl || undefined, carrier: form.carrier });
            case "return": return api.returnOrder(storeId, orderId, { ...base, items: selected, reason: form.reason });
            case "resend": return api.resendOrderNotification(storeId, orderId, form.type);
        } });
    }
    async function invoice(format: "pdf" | "html", invoiceRevision?: number) { if (!api || !storeId)
        return; await run(async () => { const blob = await api.downloadInvoice(storeId, orderId, format, invoiceRevision); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${order.number}.${format}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, false); }
    return <div className="space-y-5"><Link href="/admin/orders" className="inline-flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft size={14}/>Orders</Link><header className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h1 className="mr-2 text-3xl font-bold tracking-tight">{order.number}</h1><OrderBadge value={payment?.status}/><OrderBadge value={order.fulfilmentStatus ?? order.status}/></div><p className="mt-2 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: detail.timeZone ?? "UTC" })} · Online store · Revision {revision}</p></div><div className="flex flex-wrap gap-2"><Link className={button} href="/admin/settings/notifications">Email settings</Link><button className={button} disabled={busy} onClick={() => void invoice("pdf")}><Download size={14}/>Invoice PDF</button><button className={button} disabled={busy} onClick={() => void invoice("html")}>Printable invoice</button>{canEdit && <button className={button} onClick={() => open("edit")}>Edit items</button>}{canRefund && payment?.status === "PAID" && <button className={button} onClick={() => open("refund")}>Refund</button>}{canManage && (payment?.status !== "PAID" || canRefund) && !["CANCELLED", "REFUNDED", "SHIPPED", "DELIVERED"].includes(order.status) && <button className={button} onClick={() => open("cancel")}>Cancel order</button>}</div></header>
    {error && !action && <p role="alert" className="rounded-lg border border-red-200 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}{order.isTest && <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><strong>Test order</strong><p className="mt-1">The payment gateway was in test mode when this order was placed.</p></div>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-5"><section className={panel}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="font-semibold">Items & fulfilment</h2><p className="mt-1 text-xs text-muted-foreground">{items.reduce((sum, item) => sum + item.quantity, 0)} items</p></div><div className="flex flex-wrap gap-2">{canManage && next && <button className={`${button} bg-primary text-primary-foreground`} disabled={busy || (order.balanceDueMinor ?? 0) > 0} onClick={() => void run(async () => { if (!api || !storeId)
        return; const updated = await api.transitionFulfilment(storeId, orderId, next.status); setDetail(current => current ? { ...current, order: updated } : null); })}>{next.label}</button>}{canManage && physicalItems && ["PROCESSING", "SHIPPED"].includes(order.status) && <button className={button} onClick={() => open("fulfil")}>Create shipment</button>}{canManage && physicalItems && ["SHIPPED", "DELIVERED"].includes(order.status) && <button className={button} onClick={() => open("return")}>Record return</button>}</div></div>{items.map((item, index) => <div className="flex items-start gap-3 border-b border-border p-5 last:border-0" key={item.id ?? `${item.variantId}-${index}`}><div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">{item.imageSnapshot ? <img className="size-full object-cover" src={item.imageSnapshot} alt={item.productTitleSnapshot ?? item.titleSnapshot}/> : <Package size={22} className="text-muted-foreground"/>}</div><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{item.productTitleSnapshot ?? item.titleSnapshot}</h3>{item.variantTitleSnapshot && <p className="text-xs text-muted-foreground">{item.variantTitleSnapshot}</p>}<p className="mt-1 text-xs text-muted-foreground">SKU {item.skuSnapshot ?? "Not recorded"} · {(item.fulfillmentType ?? item.fulfilmentType) === "DIGITAL" ? "Digital delivery" : "Physical item"}</p>{item.configurationSnapshot?.map(selection => <p className="text-xs text-muted-foreground" key={selection.optionId}>{selection.optionName}: {selection.valueLabel}</p>)}<p className="mt-2 text-xs">{money(item.unitPriceMinor)} × {item.quantity}{item.discountMinor != null && ` · Discount ${money(item.discountMinor)}`}</p></div><strong className="text-sm tabular-nums">{money(item.unitPriceMinor * item.quantity - (item.discountMinor ?? 0))}</strong></div>)}</section>
    {detail.fulfilments?.map(fulfilment => <section className={`${panel} p-5`} key={fulfilment.id}><div className="flex justify-between"><h2 className="font-semibold">Shipment</h2><OrderBadge value={fulfilment.status}/></div><p className="mt-2 text-sm">{fulfilment.carrier} {fulfilment.trackingNumber || "No tracking number"}</p>{fulfilment.trackingUrl && /^https?:\/\//.test(fulfilment.trackingUrl) && <a className="mt-2 inline-block text-xs underline" href={fulfilment.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a>}{canManage && fulfilment.status !== "DELIVERED" && <button className={`${button} mt-3`} disabled={busy} onClick={() => void run(() => api!.deliverFulfilment(storeId!, orderId, fulfilment.id, { revision }))}>Mark delivered</button>}</section>)}
    <section className={`${panel} p-5`}><h2 className="mb-4 flex items-center gap-2 font-semibold">Payment <OrderBadge value={payment?.status}/></h2>{[["Subtotal", money(order.subtotalMinor)], ["Shipping", money(order.shippingMinor)], ["Discounts", order.discountMinor == null ? "Not recorded" : money(order.discountMinor)], ["Taxes", order.taxMinor == null ? "Not recorded" : money(order.taxMinor)], ["Total", money(order.totalMinor)], ["Balance due", money(order.balanceDueMinor ?? 0)]].map(([label, value]) => <div key={label} className="flex justify-between border-b border-border py-2 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><strong className="font-medium tabular-nums">{value}</strong></div>)}<p className="mt-3 break-all text-xs text-muted-foreground">Payment reference: {payment?.paymentIntentId ?? "Not recorded"}</p>{detail.transactions?.map(transaction => <div className="mt-3 flex items-center justify-between text-sm" key={transaction.id}><span>{orderLabel(transaction.kind)} {money(transaction.amountMinor)}</span><OrderBadge value={transaction.status}/></div>)}{detail.refunds.map(refund => <div className="mt-3 flex items-center justify-between text-sm" key={refund.id}><span>Refund {money(refund.amountMinor)}</span><OrderBadge value={refund.status}/></div>)}{!!detail.disputes.length && <div aria-label="Payment disputes" className="mt-4 rounded bg-amber-50 p-3 text-xs">{detail.disputes.map(dispute => <p key={dispute.stripeDisputeId}>Payment dispute: {orderLabel(dispute.status)}</p>)}</div>}</section>
    {!!detail.revisions?.length && <section className={`${panel} p-5`}><h2 className="font-semibold">Order revisions</h2>{detail.revisions.map(item => <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm" key={item.id}><span>Revision {item.number ?? item.revision ?? item.id.slice(0, 8)}</span><OrderBadge value={item.status}/>{item.status === "APPLIED" && item.number && <button className={button} disabled={busy} onClick={() => void invoice("pdf", item.number)}>Revision invoice</button>}{item.balancePaymentUrl && <a href={item.balancePaymentUrl} className="underline" target="_blank" rel="noreferrer">Balance payment link</a>}</div>)}</section>}
    {!!detail.returns?.length && <section className={`${panel} p-5`}><h2 className="font-semibold">Returns</h2>{detail.returns.map(item => <div key={item.id} className="mt-4"><div className="flex justify-between text-sm"><span>{item.reason || "No reason provided"}</span><OrderBadge value={item.status}/></div>{canManage && item.status !== "RECEIVED" && <div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => void run(() => api!.receiveReturn(storeId!, orderId, item.id, { revision, sellable: true, idempotencyKey: crypto.randomUUID() }))}>Receive sellable items & restock</button><button className={button} disabled={busy} onClick={() => void run(() => api!.receiveReturn(storeId!, orderId, item.id, { revision, sellable: false, idempotencyKey: crypto.randomUUID() }))}>Receive without restocking</button></div>}</div>)}</section>}
    {detail.operations?.some(operation => ["FAILED", "UNCERTAIN"].includes(operation.status)) && <section className={`${panel} p-5`}><h2 className="font-semibold">Actions needing attention</h2>{detail.operations.filter(operation => ["FAILED", "UNCERTAIN"].includes(operation.status)).map(operation => <div key={operation.id} className="mt-3 text-sm"><OrderBadge value={operation.status}/><span className="ml-2">{orderLabel(operation.kind)}</span><p className="mt-1 text-xs text-red-800">{operation.lastError || "Review this action before retrying."}</p></div>)}</section>}<section className={`${panel} p-5`}><h2 className="font-semibold">Timeline</h2>{canManage && <form className="mt-4" onSubmit={event => { event.preventDefault(); void run(async () => { await api!.addOrderNote(storeId!, orderId, note); setNote(""); }, false); }}><label className="text-xs text-muted-foreground" htmlFor="order-note">Only staff can see these comments</label><textarea id="order-note" value={note} onChange={event => setNote(event.target.value)} className={`${input} mt-2`} placeholder="Leave an internal comment…" required maxLength={10000}/><button className={`${button} mt-2`} disabled={busy || !note.trim()}>Post comment</button></form>}<ol className="mt-5 space-y-4 border-l border-border pl-4">{[...(detail.events ?? []).map(event => ({ id: event.id, date: event.createdAt, text: event.message ?? orderLabel(event.type) })), ...(detail.notes ?? []).map(comment => ({ id: comment.id, date: comment.createdAt, text: `${comment.authorName ?? "Staff"}: ${comment.body}` }))].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).map(event => <li key={event.id} className="text-sm"><p className="whitespace-pre-wrap">{event.text}</p><time className="mt-1 block text-xs text-muted-foreground">{new Date(event.date).toLocaleString()}</time></li>)}{!detail.events?.length && !detail.notes?.length && <li className="text-xs text-muted-foreground">No activity recorded yet.</li>}</ol></section></div>
    <aside className="space-y-5"><section className={`${panel} p-5`}><div className="flex items-center justify-between"><h2 className="font-semibold">Customer</h2>{canManage && <button className="text-xs underline" onClick={() => open("contact")}>Edit contact</button>}</div><p className="mt-4 text-sm">{String(order.customerSnapshot.name ?? "Not recorded")}</p><p className="mt-1 break-all text-xs text-muted-foreground">{String(order.customerSnapshot.email ?? "Not recorded")}</p><p className="mt-1 text-xs text-muted-foreground">{String(order.customerSnapshot.phone ?? "Not recorded")}</p></section><section className={`${panel} p-5`}><h2 className="font-semibold">Shipping method</h2><p className="mt-3 text-sm text-muted-foreground">{String(order.deliverySnapshot?.method ?? order.deliverySnapshot?.shippingMethod ?? "Not recorded")}</p></section><Address title="Shipping address" value={(order.deliverySnapshot?.address ?? order.customerSnapshot.address) as Record<string, unknown> | undefined}/><Address title="Billing address" value={order.billingAddress}/><section className={`${panel} p-5`}><h2 className="font-semibold">Customer note</h2><p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{order.customerNote || "No customer note"}</p></section>{canManage && <section className={`${panel} p-5`}><h2 className="font-semibold">Communication & tracking</h2><div className="mt-4 flex flex-wrap gap-2"><button className={button} onClick={() => open("tracking")}>Update tracking</button><button className={button} onClick={() => open("resend")}>Resend email</button></div>{detail.notifications?.map(notification => <div key={notification.id} className="mt-3 text-xs"><span>{orderLabel(notification.type)}</span><span className="ml-2 text-muted-foreground">{orderLabel(notification.status)}</span>{(notification.lastError || notification.error) && <p className="mt-1 text-red-800">{notification.lastError || notification.error}</p>}</div>)}</section>}</aside></div>
    {action && <OrderDialog title={{ cancel: "Cancel order", refund: "Refund payment", edit: "Edit order items", contact: "Edit customer contact", tracking: "Update tracking", fulfil: "Create shipment", return: "Record return", resend: "Resend customer email" }[action]} onClose={() => { if (!busy)
        setAction(null); }}><form onSubmit={submit} className="space-y-4">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}{["cancel", "refund"].includes(action) && <p className="text-sm text-muted-foreground">{action === "cancel" ? "Cancellation releases unfulfilled inventory. Paid orders require a refund; its progress will appear separately." : "The refund is processed against captured payments. Its final status is confirmed by the payment provider."}</p>}{action === "contact" && ["name", "email", "phone"].map(name => <label className="block text-sm" key={name}>{orderLabel(name)}<input className={`${input} mt-1`} value={form[name] ?? ""} type={name === "email" ? "email" : "text"} onChange={event => field(name, event.target.value)}/></label>)}{action === "contact" && ["shipping", "billing"].map(prefix => <fieldset key={prefix} className="space-y-2 rounded-lg border border-border p-3" disabled={prefix === "shipping" && ["SHIPPED", "DELIVERED"].includes(order.status)}><legend className="px-1 text-sm font-semibold">{orderLabel(prefix)} address</legend>{prefix === "shipping" && ["SHIPPED", "DELIVERED"].includes(order.status) && <p className="text-xs text-muted-foreground">Shipping address is locked after shipment.</p>}{["line1", "line2", "city", "region", "postalCode", "country"].map(name => <label className="block text-xs" key={name}>{orderLabel(name.replace(/([A-Z])/g, " $1"))}<input className={`${input} mt-1`} value={form[`${prefix}_${name}`] ?? ""} onChange={event => field(`${prefix}_${name}`, event.target.value)}/></label>)}</fieldset>)}{action === "refund" && <label className="block text-sm">Refund by<select className={`${input} mt-1`} value={form.refundMode ?? "amount"} onChange={event => field("refundMode", event.target.value)}><option value="amount">Payment amount</option><option value="items">Selected items</option></select></label>}{action === "refund" && form.refundMode !== "items" && <label className="block text-sm">Refund amount ({order.currency})<input className={`${input} mt-1`} required type="number" min="0.01" step="0.01" max={order.totalMinor / 100} value={form.amount} onChange={event => field("amount", event.target.value)}/></label>}{(["edit", "fulfil", "return"].includes(action) || (action === "refund" && form.refundMode === "items")) && <div className="space-y-3">{items.map((item, index) => ["fulfil", "return"].includes(action) && (item.fulfillmentType ?? item.fulfilmentType) === "DIGITAL" ? null : <label key={item.id ?? `${item.variantId}-${index}`} className="flex items-center justify-between gap-4 text-sm"><span>{item.titleSnapshot}<small className="block text-muted-foreground">{item.skuSnapshot ?? "No SKU"}</small></span><input aria-label={`${item.titleSnapshot} quantity`} className={`${input} max-w-24`} type="number" min="0" max={action === "edit" ? 9999 : item.quantity} required value={quantities[index] ?? 0} onChange={event => { setQuantities(current => current.map((value, i) => i === index ? Number(event.target.value) : value)); setPreview(null); }}/></label>)}{action === "edit" && <><label className="block text-sm">Add product<select className={`${input} mt-2`} value="" onChange={event => { const variantId = event.target.value; const product = catalog.find(product => product.variants.some(variant => variant.id === variantId)); const variant = product?.variants.find(variant => variant.id === variantId); if (variant && product && !items.some(item => item.variantId === variantId)) {
        setAdded(current => current.some(item => item.variantId === variantId) ? current : [...current, { variantId, title: `${product.name} / ${variant.name}`, quantity: 1 }]);
        setPreview(null);
    } }}><option value="">Choose a product variant</option>{catalog.flatMap(product => product.variants.filter(variant => !items.some(item => item.variantId === variant.id)).map(variant => <option key={variant.id} value={variant.id}>{product.name} / {variant.name}</option>))}</select></label>{added.map(item => <label className="flex justify-between gap-3 text-sm" key={item.variantId}><span>{item.title}</span><input className={`${input} max-w-24`} aria-label={`${item.title} quantity`} type="number" min="0" value={item.quantity} onChange={event => { setAdded(current => current.map(value => value.variantId === item.variantId ? { ...value, quantity: Number(event.target.value) } : value)); setPreview(null); }}/></label>)}<p className="text-xs text-muted-foreground">Added products use their current price. Set quantity to zero to remove an item.</p></>}{action !== "edit" && <p className="text-xs text-muted-foreground">Enter the quantity of each item included.</p>}</div>}{["tracking", "fulfil"].includes(action) && <>{action === "tracking" && !!detail.fulfilments?.length && <label className="block text-sm">Shipment<select className={`${input} mt-1`} value={form.fulfilmentId ?? detail.fulfilments[0].id} onChange={event => field("fulfilmentId", event.target.value)}>{detail.fulfilments.map(item => <option value={item.id} key={item.id}>{item.trackingNumber || item.id}</option>)}</select></label>}{["carrier", "trackingNumber", "trackingUrl"].map(name => <label className="block text-sm" key={name}>{orderLabel(name.replace(/([A-Z])/g, " $1"))}<input className={`${input} mt-1`} type={name === "trackingUrl" ? "url" : "text"} value={form[name]} onChange={event => field(name, event.target.value)}/></label>)}</>}{["cancel", "refund", "return"].includes(action) && <label className="block text-sm">Reason<textarea className={`${input} mt-1`} value={form.reason} onChange={event => field("reason", event.target.value)}/></label>}{action === "resend" && <label className="block text-sm">Email type<select className={`${input} mt-1`} value={form.type} onChange={event => field("type", event.target.value)}>{["PLACED", "PAYMENT_CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUND_PROCESSED", "DIGITAL_READY"].map(type => <option value={type} key={type}>{orderLabel(type)}</option>)}</select></label>}{preview && <div className="rounded-lg bg-muted p-4 text-sm"><p>Previous total: {money(preview.beforeTotalMinor ?? order.totalMinor)}</p><p>Proposed total: {money(preview.afterTotalMinor ?? preview.totalMinor ?? order.totalMinor)}</p><p className="mt-2 font-semibold">Settlement: {money(preview.deltaMinor ?? preview.settlementMinor ?? preview.differenceMinor ?? 0)}</p><p className="mt-2 text-xs">The original order remains effective until payment or refund is confirmed.</p>{preview.message && <p className="mt-2">{preview.message}</p>}</div>}<footer className="flex justify-end gap-2 border-t border-border pt-4"><button type="button" className={button} disabled={busy} onClick={() => setAction(null)}>Close</button><button className={`${button} bg-primary text-primary-foreground`} disabled={busy || (["fulfil", "return"].includes(action) && !quantities.some(quantity => quantity > 0))}>{busy ? "Working…" : action === "edit" ? preview ? "Confirm financial changes" : "Preview changes" : "Confirm"}</button></footer></form></OrderDialog>}</div>;
}
function Address({ title, value }: {
    title: string;
    value?: Record<string, unknown> | null;
}) { return <section className={`${panel} p-5`}><h2 className="font-semibold">{title}</h2><address className="mt-3 text-sm not-italic leading-6 text-muted-foreground">{value ? Object.entries(value).filter(([, value]) => typeof value === "string" && value).map(([key, value]) => <p key={key}>{String(value)}</p>) : "Not recorded"}</address></section>; }
function OrderDialog({ title, onClose, children }: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) { const dialog = useRef<HTMLDialogElement>(null); useEffect(() => { dialog.current?.showModal(); }, []); return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current)
    onClose(); }} aria-labelledby="order-dialog-title" className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-xl border border-border bg-card p-5 text-foreground shadow-xl backdrop:bg-black/40"><header className="mb-5 flex items-center justify-between"><h2 id="order-dialog-title" className="text-lg font-semibold">{title}</h2><button className={button} aria-label="Close dialog" onClick={onClose}><X size={16}/></button></header>{children}</dialog>; }
export default function OrderDetailPage() { const params = useParams<{
    id: string;
}>(); return <OrderDetailView orderId={params.id}/>; }
