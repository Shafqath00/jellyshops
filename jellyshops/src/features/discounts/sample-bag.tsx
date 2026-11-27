"use client";

import { Minus, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { calculateDiscounts, type DiscountDefinition } from "@jelly/storefront-schema";
import { Button, Card } from "@/components/admin";
import { parseMoney, moneyText } from "./form-state";
import type { DiscountFormData } from "./use-form-data";

type Shopper = "new" | "returning" | "tagged" | "chosen";

/**
 * "Try it on a sample bag": the merchant picks products and quantities, and sees what the customer would pay with
 * this discount as it stands in the form (unsaved), worked out by the same calculation checkout uses. Other
 * discounts and earlier uses are left out, so the answer is about this discount alone.
 */
export function SampleBag({ discount, data, formatMoney, bare = false }: { discount: Omit<DiscountDefinition, "id" | "createdAt">; data: DiscountFormData; formatMoney: (minor: number) => string; bare?: boolean }) {
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [adding, setAdding] = useState("");
  const [delivery, setDelivery] = useState(() => moneyText(data.shippingMinor ?? 0) || "0");
  const [shopper, setShopper] = useState<Shopper>("new");
  const products = useMemo(() => new Map(data.catalog.map((product) => [product.id, product])), [data.catalog]);
  const choices = data.catalog.filter((product) => product.active && !lines.some((line) => line.productId === product.id)).slice(0, 200);

  const result = useMemo(() => {
    const cartLines = lines.flatMap((line) => {
      const product = products.get(line.productId);
      return product ? [{ key: product.id, productId: product.id, collectionIds: product.collectionIds, unitPriceMinor: product.priceMinor, quantity: line.quantity }] : [];
    });
    if (!cartLines.length) return null;
    const shippingMinor = parseMoney(delivery);
    const eligibility = discount.eligibility;
    const customer = {
      email: shopper === "chosen" && eligibility.scope === "customers" ? eligibility.emails[0] ?? "sample@example.test" : "sample@example.test",
      tags: shopper === "tagged" && eligibility.scope === "tags" ? eligibility.tags : [],
      previousOrders: shopper === "returning" ? 1 : 0,
    };
    return calculateDiscounts(
      { lines: cartLines, shippingMinor: Number.isFinite(shippingMinor) && shippingMinor !== null ? shippingMinor : 0, hasDelivery: true },
      [{ discount: { ...discount, id: "sample", createdAt: new Date(0), code: discount.code }, code: discount.method === "code" ? discount.code || "SAMPLE" : null, uses: 0, usesByCustomer: 0 }],
      customer,
      // Dates still apply, so a scheduled discount is shown as not working yet.
      { now: new Date(), formatMoney },
    );
  }, [lines, products, delivery, shopper, discount, formatMoney]);

  const setQuantity = (productId: string, quantity: number) => setLines((current) => current.flatMap((line) => (line.productId !== productId ? [line] : quantity > 0 ? [{ ...line, quantity }] : [])));
  const problem = result?.problems[0]?.message;
  const applied = result?.applied[0];
  const notApplied = result && !applied && !problem && discount.method === "automatic" ? "This discount doesn't apply to this bag." : null;
  const audience = discount.eligibility.scope;

  const body = <div className="jk-discount-section jk-sample-bag">
      {lines.length > 0 && <ul className="jk-sample-lines" aria-label="Sample bag">
        {lines.map((line) => {
          const product = products.get(line.productId)!;
          return <li key={line.productId}>
            <span className="jk-sample-name">{product.title}<span className="jk-muted"> · {formatMoney(product.priceMinor)}</span></span>
            <span className="jk-sample-qty">
              <button type="button" onClick={() => setQuantity(line.productId, line.quantity - 1)} aria-label={`One fewer ${product.title}`}><Minus size={14} aria-hidden="true" /></button>
              <span aria-label={`Quantity of ${product.title}`}>{line.quantity}</span>
              <button type="button" onClick={() => setQuantity(line.productId, line.quantity + 1)} aria-label={`One more ${product.title}`}><Plus size={14} aria-hidden="true" /></button>
              <button type="button" onClick={() => setQuantity(line.productId, 0)} aria-label={`Remove ${product.title}`}><X size={14} aria-hidden="true" /></button>
            </span>
          </li>;
        })}
      </ul>}
      <div className="jk-sample-add">
        <label className="sr-only" htmlFor="sample-bag-product">Add a product to the sample bag</label>
        <select id="sample-bag-product" className="jk-select" value={adding} onChange={(event) => setAdding(event.target.value)}>
          <option value="">{choices.length ? "Choose a product…" : "No more products to add"}</option>
          {choices.map((product) => <option key={product.id} value={product.id}>{product.title} ({formatMoney(product.priceMinor)})</option>)}
        </select>
        <Button size="small" disabled={!adding} onClick={() => { setLines((current) => [...current, { productId: adding, quantity: 1 }]); setAdding(""); }}>Add</Button>
      </div>
      <div className="jk-sample-options">
        <label className="jk-sample-field"><span>Delivery charge</span><input className="jk-input jk-input-short" inputMode="decimal" value={delivery} onChange={(event) => setDelivery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /></label>
        {audience !== "everyone" && <label className="jk-sample-field"><span>The customer is</span>
          <select className="jk-select" value={shopper} onChange={(event) => setShopper(event.target.value as Shopper)}>
            {audience === "first_order" && <><option value="new">A new customer</option><option value="returning">A returning customer</option></>}
            {audience === "tags" && <><option value="tagged">In the customer group</option><option value="new">Not in the group</option></>}
            {audience === "customers" && <><option value="chosen">One of the chosen customers</option><option value="new">Someone else</option></>}
          </select></label>}
      </div>
      {result && <div className="jk-sample-result" aria-live="polite">
        {(problem || notApplied) && <p className="jk-sample-problem"><strong>Not applied:</strong> {problem ?? notApplied}</p>}
        <dl className="jk-discount-facts">
          <div><dt>Subtotal</dt><dd>{formatMoney(result.subtotalMinor)}</dd></div>
          {applied && applied.amountMinor > 0 && <div><dt>Discount</dt><dd>−{formatMoney(applied.amountMinor)}</dd></div>}
          <div><dt>Delivery</dt><dd>{result.shippingMinor === 0 && result.shippingBeforeMinor > 0 ? <><s>{formatMoney(result.shippingBeforeMinor)}</s> Free</> : formatMoney(result.shippingMinor)}</dd></div>
          <div className="jk-sample-total"><dt>Customer pays</dt><dd>{formatMoney(result.totalMinor)}</dd></div>
        </dl>
        {applied && <p className="jk-muted jk-discount-help">Saves {formatMoney(applied.amountMinor + applied.shippingMinor)}. Other discounts that might also apply aren&apos;t included here.</p>}
      </div>}
    </div>;
  return bare ? body : <Card title="Try it on a sample bag" description="See what a customer would pay with this discount as it is now, before you save.">{body}</Card>;
}
