"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, LockKeyhole, PackageCheck } from "lucide-react";
import { useShop } from "@/contexts/shop-context";
import { formatMoney, type Order } from "@/lib/domain";
import { createCommerceApi } from "@/features/commerce/api/client";
import { PaymentElementCheckout } from "@/features/commerce/components/payment-element-checkout";
import { useCustomer } from "@/features/customers/customer-provider";
import { useThemePresentation } from "@/features/storefront/components/storefront-shell";

export function CheckoutView({ storeSlug }: { storeSlug: string }) {
  const { session: customerSession } = useCustomer();
  const { repository, state } = useShop();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [prepared, setPrepared] = useState<{ clientSecret: string; connectedAccountId: string; publicToken: string } | null>(null);
  const store = repository.getStoreBySlug(storeSlug);
  const cart = repository.getCartForStore(storeSlug);
  if (!store) return null;
  if (order) return <main className="jelly-order-confirmation">
    <span className="jelly-order-confirmation-icon" aria-hidden="true"><Check /></span>
    <p className="jelly-eyebrow">Payment accepted</p>
    <h1>Thank you for your order</h1>
    <p>Thank you, {order.customerSnapshot.name.split(" ")[0]}. Your order <b>{order.number}</b> is confirmed and a receipt is on its way to your inbox.</p>
    <dl className="jelly-order-confirmation-summary"><div><dt>Total paid</dt><dd>{formatMoney(order.totalMinor, order.currency)}</dd></div><div><dt>Order number</dt><dd>{order.number}</dd></div></dl>
    <div className="jelly-section-actions"><Link className="jelly-button" href={`/${store.slug}/order/${order.id}`}>View order</Link><Link className="jelly-button jelly-button--secondary" href={`/${store.slug}/shop`}>Keep shopping</Link></div>
  </main>;
  const lines = cart?.items.map((item) => { const product = state.products.find((entry) => entry.variants.some((variant) => variant.id === item.variantId)); const variant = product?.variants.find((entry) => entry.id === item.variantId); return product && variant ? { item, product, variant } : null; }).filter(Boolean) ?? [];
  const requiresShipping = lines.some((line) => line?.product.fulfillmentType !== "DIGITAL");
  const shippingMinor = requiresShipping ? store.shippingMinor : 0;
  const country = store.country ?? (store.currency === "GBP" ? "GB" : store.currency === "USD" ? "US" : "IN");
  const regionLabel = country === "GB" ? "County (optional)" : "State";
  const postalLabel = country === "US" ? "ZIP code" : country === "IN" ? "PIN code" : "Postcode";
  const subtotal = lines.reduce((sum, line) => sum + (line!.item.unitPriceMinor ?? line!.variant.priceMinor) * line!.item.quantity, 0);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!cart || !store) return; setPending(true); setError(""); const data = new FormData(event.currentTarget); try { const customer = { name: String(data.get("name")), email: String(data.get("email")), phone: String(data.get("phone") ?? ""), ...(requiresShipping ? { address: { line1: String(data.get("line1")), line2: String(data.get("line2") || "") || undefined, city: String(data.get("city")), region: String(data.get("region")), postalCode: String(data.get("postalCode")), country: store.country ?? (store.currency === "GBP" ? "GB" : store.currency === "USD" ? "US" : "IN") } } : {}) }; const api = createCommerceApi({ token: customerSession?.user.email_confirmed_at ? customerSession.access_token : undefined, baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }); const items = cart.items.map((item) => { const product = state.products.find((entry) => entry.variants.some((variant) => variant.id === item.variantId)); return { ...item, configurationSelections: item.configurationSelections?.map((selection) => { const option = product?.options?.find((candidate) => candidate.id === selection.optionId); const value = option?.values.find((candidate) => candidate.id === selection.valueId); return { ...selection, optionName: option?.name ?? selection.optionId, valueLabel: value?.label ?? selection.valueId, priceAdjustmentMinor: value?.priceAdjustmentMinor ?? 0 }; }) }; }); const attempt = await api.createAttempt(store.id, { cartKey: cart.id, currency: store.currency.toUpperCase(), items, customerSnapshot: customer, ...(requiresShipping ? { deliverySnapshot: customer.address } : {}) }); const payment = await api.preparePayment(store.id, attempt.attemptId); setPrepared(payment); } catch (caught) { setError(caught instanceof Error ? caught.message.replaceAll("_", " ") : "Checkout failed"); } finally { setPending(false); } }
  if (!cart || lines.length === 0) return <main className="jelly-checkout-empty">
    <PackageCheck size={32} aria-hidden="true" />
    <h1>Your bag is empty</h1>
    <p>Add something you love, then come back to check out.</p>
    <Link className="jelly-button" href={`/${store.slug}/shop`}>Browse the shop</Link>
  </main>;
  return <main className="checkout-page"><Link className="product-back" href={`/${store.slug}/shop`}><ArrowLeft size={16} /> Keep shopping</Link><header><span>Secure card checkout</span><h1>Almost yours.</h1><p>{requiresShipping ? "Enter delivery details and pay securely by card." : "Enter your details and pay securely. Downloads arrive by email after payment."}</p></header><div className="checkout-grid"><div className="checkout-form"><form onSubmit={submit}><section><span className="checkout-step">01</span><h2>Your details</h2><div className="field-grid"><label className="field"><span>Name</span><input name="name" autoComplete="name" required /></label><label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required /></label><label className="field field-wide"><span>Phone</span><input name="phone" type="tel" autoComplete="tel" required={requiresShipping} /></label></div></section>{requiresShipping && <section><span className="checkout-step">02</span><h2>Delivery address</h2><div className="field-grid"><label className="field field-wide"><span>Address line</span><input name="line1" autoComplete="street-address" required /></label><label className="field field-wide"><span>Apartment, suite, etc. (optional)</span><input name="line2" /></label><label className="field"><span>City</span><input name="city" autoComplete="address-level2" required /></label><label className="field"><span>{regionLabel}</span><input name="region" autoComplete="address-level1" required={country !== "GB"} /></label><label className="field"><span>{postalLabel}</span><input name="postalCode" autoComplete="postal-code" required /></label></div></section>}{error ? <p className="checkout-error" role="alert">{error}</p> : null}{prepared ? null : <button type="submit" className="store-button wide" disabled={pending}><LockKeyhole size={17} /> {pending ? "Preparing payment…" : "Continue to card payment"}</button>}</form>{prepared ? <PaymentElementCheckout clientSecret={prepared.clientSecret} connectedAccountId={prepared.connectedAccountId} onPaid={() => window.location.assign(`/${store.slug}/order/${prepared.publicToken}`)} /> : null}</div><aside className="checkout-summary"><h2>Order summary</h2>{lines.map((line) => line && <div className="checkout-line" key={line.variant.id}><span className="checkout-thumb">{line.product.imageUrl ? <Image src={line.product.imageUrl} alt="" fill sizes="64px" /> : null}<b aria-label={`Quantity ${line.item.quantity}`}>{line.item.quantity}</b></span><div><strong>{line.product.name}</strong><span>{line.variant.name}</span></div><b>{formatMoney((line.item.unitPriceMinor ?? line.variant.priceMinor) * line.item.quantity, store.currency)}</b></div>)}<div className="checkout-totals"><div><span>Subtotal</span><b>{formatMoney(subtotal, store.currency)}</b></div><div><span>Shipping</span><b>{formatMoney(shippingMinor, store.currency)}</b></div><div><span>Total</span><b>{formatMoney(subtotal + shippingMinor, store.currency)}</b></div></div></aside></div></main>;
}

export default function CheckoutPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { repository } = useShop();
  const { shell, settings } = useThemePresentation();
  const store = repository.getStoreBySlug(storeSlug);
  if (!store) return null;
  const Checkout = shell.CheckoutPage;
  return <Checkout store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings}><CheckoutView storeSlug={storeSlug} /></Checkout>;
}

