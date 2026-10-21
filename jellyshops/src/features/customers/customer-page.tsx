"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useShop } from "@/contexts/shop-context";
import type { PageType } from "@jelly/storefront-schema";
import { customerAuth, customerRequest, useCustomer } from "./customer-provider";
import { mergeWishlistIds, readGuestWishlist, writeGuestWishlist } from "./wishlist";
import { ProtectedStorefrontPage } from "./protected-storefront-page";

interface Address { id: string; revision: number; label: string; name: string; line1: string; line2: string; city: string; region: string; postalCode: string; country: string; phone: string }
interface CustomerOrder { id: string; number: string; status: string; totalMinor: number; currency: string; createdAt: string; items?: { variantId: string; titleSnapshot: string; quantity: number; lineTotalMinor: number }[] }
interface Profile { name: string; email: string; revision: number }
interface WishlistItem { productId: string; title: string; slug: string; status: string }
const titles: Partial<Record<PageType, string>> = { "customer-login": "Welcome back", "customer-register": "Create your account", "customer-recovery": "Reset your password", "customer-account": "Your account", "customer-orders": "Your orders", "customer-order": "Order details", "customer-addresses": "Your addresses", wishlist: "Your wishlist" };
const subtitles: Partial<Record<PageType, string>> = {
  "customer-login": "Sign in to see your orders, addresses and saved favourites.",
  "customer-register": "Save your details for faster checkout and keep track of your orders.",
  "customer-recovery": "Enter your email and we will send you a link to choose a new password.",
  "customer-account": "Your details, orders and favourites in one place.",
  "customer-orders": "Every order you have placed with this account.",
  "customer-order": "Items, totals and delivery details for this order.",
  "customer-addresses": "Save delivery addresses for faster checkout.",
  wishlist: "The pieces you have saved for later.",
};
const accountTabs: Array<{ kind: PageType; label: string; path: string }> = [
  { kind: "customer-account", label: "Overview", path: "" },
  { kind: "customer-orders", label: "Orders", path: "/orders" },
  { kind: "customer-addresses", label: "Addresses", path: "/addresses" },
  { kind: "wishlist", label: "Wishlist", path: "" },
];
const addressFields = ["label", "name", "line1", "line2", "city", "region", "postalCode", "phone"] as const;
const labels = { label: "Label", name: "Full name", line1: "Address line 1", line2: "Address line 2", city: "City", region: "State or region", postalCode: "Postal code", phone: "Phone" };
export function CustomerPage({ kind }: { kind: PageType }) {
  const params = useParams<{ storeSlug: string; orderId?: string }>();
  const { repository, state } = useShop(); const store = repository.getStoreBySlug(params.storeSlug);
  const { session, loading: authLoading, error: authError } = useCustomer();
  const [result, setResult] = useState<{ scope: string; profile: Profile | null; addresses: Address[]; orders: CustomerOrder[]; wishlist: WishlistItem[]; error?: string }>();
  const [message, setMessage] = useState<string>(); const [error, setError] = useState<string>(); const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0); const [editing, setEditing] = useState<Address>();
  const scope = `${store?.id}:${session?.user.id}:${kind}:${params.orderId ?? ""}:${refresh}`;
  const verified = Boolean(session?.user.email_confirmed_at);
  const authPage = ["customer-login", "customer-register", "customer-recovery"].includes(kind);
  useEffect(() => {
    if (!store || authPage || authLoading) return;
    const controller = new AbortController(); let active = true;
    const id = store.id;
    const base = { scope, profile: null, addresses: [], orders: [], wishlist: [] };
    async function load() {
      try {
        if (!session || !verified) {
          const wishlist = readGuestWishlist(id).map((productId) => { const p = repository.listProducts(params.storeSlug).find((item) => item.id === productId); return { productId, title: p?.name ?? "Unavailable product", slug: p?.slug ?? "", status: p?.published && !p.archived ? "ACTIVE" : "ARCHIVED" }; });
          if (active) setResult({ ...base, wishlist }); return;
        }
        const profile = await customerRequest<Profile>(id, "/profile", session, "GET", undefined, controller.signal);
        let addresses: Address[] = []; let orders: CustomerOrder[] = []; let wishlist: WishlistItem[] = [];
        if (kind === "customer-addresses") addresses = (await customerRequest<{ addresses: Address[] }>(id, "/addresses", session, "GET", undefined, controller.signal)).addresses;
        if (kind === "customer-orders") orders = (await customerRequest<{ orders: CustomerOrder[] }>(id, "/orders", session, "GET", undefined, controller.signal)).orders;
        if (kind === "customer-order") orders = [await customerRequest<CustomerOrder>(id, `/orders/${encodeURIComponent(params.orderId ?? "")}`, session, "GET", undefined, controller.signal)];
        if (kind === "wishlist") {
          const guest = readGuestWishlist(id);
          wishlist = (await customerRequest<{ items: WishlistItem[] }>(id, guest.length ? "/wishlist/merge" : "/wishlist", session, guest.length ? "POST" : "GET", guest.length ? { productIds: mergeWishlistIds(guest) } : undefined, controller.signal)).items;
          if (active && guest.length) writeGuestWishlist(id, []);
        }
        if (active) setResult({ scope, profile, addresses, orders, wishlist });
      } catch (caught) { if (active) setResult({ ...base, error: caught instanceof Error ? caught.message : "Unable to load your account." }); }
    }
    void load(); return () => { active = false; controller.abort(); };
  }, [scope, store, authPage, authLoading, session, verified, kind, params.orderId, params.storeSlug, repository]);
  if (!store) return null;
  const current = result?.scope === scope ? result : undefined;
  const accountHref = `/${store.slug}/account`;
  async function act(work: () => Promise<void>) { setBusy(true); setError(undefined); setMessage(undefined); try { await work(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to complete this request."); } finally { setBusy(false); } }
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await act(async () => {
      if (!customerAuth) throw new Error("Customer authentication is not configured yet.");
      const email = String(form.get("email") ?? ""); const password = String(form.get("password") ?? "");
      const callback = `${window.location.origin}${accountHref}`;
      const response = kind === "customer-register" ? await customerAuth.auth.signUp({ email, password, options: { emailRedirectTo: callback } })
        : kind === "customer-recovery" ? session ? await customerAuth.auth.updateUser({ password }) : await customerAuth.auth.resetPasswordForEmail(email, { redirectTo: `${callback}/recover` })
        : await customerAuth.auth.signInWithPassword({ email, password });
      if (response.error) throw response.error;
      setMessage(kind === "customer-register" ? "Check your email to verify your account." : kind === "customer-recovery" ? session ? "Your password has been updated." : "If an account exists, a recovery email will arrive shortly." : "You are signed in.");
    });
  }
  const money = (minor: number, currency: string = store.currency) => new Intl.NumberFormat("en", { style: "currency", currency }).format(minor / 100);
  return <ProtectedStorefrontPage type={kind} storeSlug={store.slug}>
    <header className={`signature-page-heading${authPage ? " signature-page-heading--auth" : ""}`}><p className="signature-eyebrow">{store.name}</p><h1>{titles[kind] ?? "Your account"}</h1><p>{subtitles[kind] ?? subtitles["customer-account"]}</p></header>
    {message && <p className="signature-notice" role="status">{message}</p>}{(error || authError) && <p className="signature-notice" role="alert">{error ?? authError}</p>}
    {authLoading ? <p role="status">Loading your account…</p> : authPage ? <section className="signature-panel signature-auth">
      {session && kind !== "customer-recovery" ? <><p>{verified ? `Signed in as ${session.user.email}.` : "Check your email and verify your account before continuing."}</p><Link className="signature-primary" href={accountHref}>Continue to your account</Link><button className="signature-secondary" onClick={() => void act(async () => { const response = await customerAuth?.auth.signOut(); if (response?.error) throw response.error; })}>Sign out</button></> : <form onSubmit={(event) => void authenticate(event)}>
        {!(kind === "customer-recovery" && session) && <label>Email<input type="email" name="email" autoComplete="email" required maxLength={254} /></label>}
        {!(kind === "customer-recovery" && !session) && <label>Password<input type="password" name="password" minLength={8} required autoComplete={kind === "customer-login" ? "current-password" : "new-password"} /></label>}
        <button className="signature-primary" disabled={busy}>{busy ? "Please wait…" : kind === "customer-login" ? "Sign in" : kind === "customer-register" ? "Create account" : session ? "Save new password" : "Send recovery email"}</button>
      </form>}
      <nav aria-label="Customer access">{kind !== "customer-login" && <Link href={`${accountHref}/login`}>Already have an account? Sign in</Link>}{kind !== "customer-register" && <Link href={`${accountHref}/register`}>New here? Create an account</Link>}{kind !== "customer-recovery" && <Link href={`${accountHref}/recover`}>Forgot your password?</Link>}</nav>
    </section> : <>
      <nav className="signature-account-nav" aria-label="Your account">{accountTabs.map((tab) => <Link key={tab.kind} href={tab.kind === "wishlist" ? `/${store.slug}/wishlist` : `${accountHref}${tab.path}`} aria-current={tab.kind === kind || (tab.kind === "customer-orders" && kind === "customer-order") ? "page" : undefined}>{tab.label}</Link>)}{session && <button disabled={busy} onClick={() => void act(async () => { const response = await customerAuth?.auth.signOut(); if (response?.error) throw response.error; })}>Sign out</button>}</nav>
      {kind !== "wishlist" && (!session || !verified) ? <section className="signature-panel"><h2>{session ? "Verify your email" : "Make yourself at home"}</h2><p>{session ? "Use the verification link in your email to access your account." : "Sign in to see your orders and saved addresses."}</p><Link className="signature-primary" href={`${accountHref}/login`}>Sign in</Link></section> : !current ? <p role="status">Loading…</p> : current.error ? <div role="alert"><p>{current.error}</p><button onClick={() => setRefresh((value) => value + 1)}>Retry</button></div> : <>
        {kind === "customer-account" && current.profile && <section className="signature-panel"><h2>Good to see you{current.profile.name ? `, ${current.profile.name}` : ""}.</h2><p>{current.profile.email}</p><form key={`${current.profile.revision}:${scope}`} onSubmit={(event) => { event.preventDefault(); const name = String(new FormData(event.currentTarget).get("name") ?? ""); void act(async () => { await customerRequest(store.id, "/profile", session, "PATCH", { name, revision: current.profile!.revision }); setRefresh((value) => value + 1); setMessage("Your details have been saved."); }); }}><label>Your name<input name="name" required maxLength={120} defaultValue={current.profile.name} autoComplete="name" /></label><button className="signature-primary" disabled={busy}>Save details</button></form></section>}
        {(kind === "customer-orders" || kind === "customer-order") && <section className="signature-panel">{!current.orders.length ? <p>You haven’t placed any orders with this account yet.</p> : current.orders.map((order) => <article className="signature-order" key={order.id}><div><Link href={`${accountHref}/orders/${encodeURIComponent(order.id)}`}><h2>{order.number}</h2></Link><p>{new Date(order.createdAt).toLocaleDateString()} · {order.status.replaceAll("_", " ").toLowerCase()}</p></div><strong>{money(order.totalMinor, order.currency)}</strong>{order.items && <ul>{order.items.map((item) => <li key={item.variantId}>{item.titleSnapshot} × {item.quantity}<span>{money(item.lineTotalMinor, order.currency)}</span></li>)}</ul>}</article>)}</section>}
        {kind === "customer-addresses" && <div className="signature-account-grid"><section className="signature-panel"><h2>Saved addresses</h2>{!current.addresses.length && <p>No addresses saved yet.</p>}{current.addresses.map((address) => <article className="signature-address" key={address.id}><h3>{address.label || address.name}</h3><p>{address.name}<br />{address.line1}<br />{address.city}, {address.postalCode}<br />{address.country}</p><div className="signature-actions"><button className="signature-secondary" onClick={() => setEditing(address)}>Edit</button><button className="signature-secondary" disabled={busy} onClick={() => void act(async () => { await customerRequest(store.id, `/addresses/${address.id}`, session, "DELETE", { revision: address.revision }); setRefresh((value) => value + 1); })}>Remove</button></div></article>)}</section>
          <section className="signature-panel"><h2>{editing ? "Edit address" : "Add an address"}</h2><form key={`${store.id}:${editing?.id ?? "new"}:${editing?.revision ?? 0}`} onSubmit={(event) => { event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); void act(async () => { await customerRequest(store.id, editing ? `/addresses/${editing.id}` : "/addresses", session, editing ? "PATCH" : "POST", { ...fields, ...(editing ? { revision: editing.revision } : {}) }); setEditing(undefined); setRefresh((value) => value + 1); setMessage("Address saved."); }); }}>{addressFields.map((field) => <label key={field}>{labels[field]}<input name={field} defaultValue={editing?.[field] ?? ""} required={["name", "line1", "city", "postalCode"].includes(field)} maxLength={field === "postalCode" ? 24 : field === "phone" ? 32 : 120} /></label>)}<label>Country<select name="country" defaultValue={editing?.country ?? store.country ?? "US"}><option value="IN">India</option><option value="GB">United Kingdom</option><option value="US">United States</option></select></label><div className="signature-actions"><button className="signature-primary" disabled={busy}>Save address</button>{editing && <button className="signature-secondary" type="button" onClick={() => setEditing(undefined)}>Cancel</button>}</div></form></section></div>}
        {kind === "wishlist" && <section className="signature-panel">{!session && <p><Link href={`${accountHref}/login`}>Sign in</Link> to keep your wishlist across devices.</p>}{!current.wishlist.length ? <><h2>A little room for favourites.</h2><p>Save products as you browse and find them here.</p><Link className="signature-primary" href={`/${store.slug}/search`}>Explore the store</Link></> : <div className="signature-wishlist">{current.wishlist.map((item) => <article key={item.productId}><h2>{item.status === "ACTIVE" ? <Link href={`/${store.slug}/products/${item.slug}`}>{item.title}</Link> : item.title}</h2>{item.status !== "ACTIVE" && <p>Currently unavailable</p>}<button className="signature-secondary" disabled={busy} onClick={() => void act(async () => { if (session) await customerRequest(store.id, `/wishlist/${encodeURIComponent(item.productId)}`, session, "DELETE"); else writeGuestWishlist(store.id, readGuestWishlist(store.id).filter((id) => id !== item.productId)); setRefresh((value) => value + 1); })}>Remove</button></article>)}</div>}</section>}
      </>}
    </>}
    <span hidden>{state.version}</span>
  </ProtectedStorefrontPage>;
}
