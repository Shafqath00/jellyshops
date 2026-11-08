"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createCommerceApi } from "@/features/commerce/api/client";
import { PaymentElementCheckout } from "@/features/commerce/components/payment-element-checkout";
type Balance = Awaited<ReturnType<ReturnType<typeof createCommerceApi>["getOrderBalance"]>>;
export default function OrderBalancePage() {
    const { storeSlug, publicToken } = useParams<{
        storeSlug: string;
        publicToken: string;
    }>();
    const api = useMemo(() => createCommerceApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }), []);
    const [balance, setBalance] = useState<Balance | null>(null);
    const [error, setError] = useState("");
    const [confirmationPending, setConfirmationPending] = useState(false);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let storeId: string | undefined;
        async function load() { try {
            if (!storeId)
                storeId = (await api.getPublicStoreBySlug(storeSlug)).store.id;
            const data = await api.getOrderBalance(storeId, publicToken);
            if (!active)
                return;
            setBalance(data);
            setError("");
            if (!["APPLIED", "EXPIRED", "FAILED", "CANCELLED"].includes(data.status))
                timer = setTimeout(load, 5000);
        }
        catch (caught) {
            if (!active)
                return;
            setError(caught instanceof Error ? caught.message : "Unable to load balance payment");
        } }
        void load();
        const focus = () => { if (timer)
            clearTimeout(timer); void load(); };
        window.addEventListener("focus", focus);
        return () => { active = false; if (timer)
            clearTimeout(timer); window.removeEventListener("focus", focus); };
    }, [api, storeSlug, publicToken, refresh]);
    const completed = balance?.status === "APPLIED";
    const unavailable = balance && (["EXPIRED", "FAILED", "CANCELLED"].includes(balance.status) || Boolean(balance.expiresAt && Date.parse(balance.expiresAt) < Date.now()));
    return <main className="mx-auto max-w-xl space-y-5 px-5 py-16"><Link className="text-sm underline" href={`/${storeSlug}/order/${publicToken}`}>Back to your order</Link><h1 className="text-3xl font-semibold tracking-tight">{completed ? "Balance payment confirmed" : "Order balance"}</h1>{error ? <div role="alert" className="rounded-lg border border-red-200 p-4"><p>{error}</p><button className="mt-2 underline" onClick={() => setRefresh(value => value + 1)}>Try again</button></div> : !balance ? <p role="status">Loading balance payment…</p> : completed ? <p role="status">Your payment has been verified and your order changes have been applied.</p> : unavailable ? <p role="alert">This payment request is no longer available. Contact the shop for an updated order.</p> : <><p className="text-sm">Additional payment for your requested order changes.</p><p className="text-2xl font-semibold">{new Intl.NumberFormat("en", { style: "currency", currency: balance.currency }).format(balance.amountMinor / 100)}</p>{balance.expiresAt && <p className="text-xs">Payment request expires {new Date(balance.expiresAt).toLocaleString()}.</p>}{confirmationPending ? <p role="status">Payment submitted. Waiting for the shop to verify your payment and apply the changes…</p> : balance.clientSecret && balance.connectedAccountId ? <PaymentElementCheckout key={balance.clientSecret} clientSecret={balance.clientSecret} connectedAccountId={balance.connectedAccountId} onPaid={() => { setConfirmationPending(true); setRefresh(value => value + 1); }}/> : <p role="status">Preparing secure payment… This page refreshes automatically.</p>}</>}</main>;
}
