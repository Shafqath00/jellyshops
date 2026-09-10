"use client";

import { useState } from "react";
import { CheckCircle2, ImageIcon } from "lucide-react";
import type { Product } from "@/lib/domain";
import { useShop } from "@/contexts/shop-context";

const defaultImage = "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1200&q=85";

export function ProductForm({ product }: { product?: Product }) {
  const { state, repository } = useShop();
  const [saved, setSaved] = useState(false);
  const store = state.stores.find((item) => item.id === state.activeStoreId)!;
  const variant = product?.variants[0];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const category = String(data.get("category") || "Other").trim();
    const priceMinor = Math.round(Number(data.get("price")) * 100);
    const stock = Number(data.get("stock"));
    const sku = String(data.get("sku") || "").trim() || `JS-${Date.now().toString().slice(-6)}`;
    if (!name || priceMinor < 100 || stock < 0) return;
    repository.saveProduct({
      id: product?.id ?? "",
      storeId: store.id,
      name,
      slug: product?.slug ?? "",
      description: String(data.get("description") || "").trim(),
      category,
      imageUrl: String(data.get("imageUrl") || "").trim() || defaultImage,
      published: data.get("published") === "on",
      archived: false,
      featured: product?.featured ?? false,
      variants: [{ id: variant?.id ?? "", name: String(data.get("variantName") || "Standard"), sku, priceMinor, stock }]
    });
    setSaved(true);
  }

  return (
    <form className="admin-form product-form" onSubmit={submit} onChange={() => setSaved(false)}>
      {saved ? <div className="success-banner" role="status"><CheckCircle2 size={18} /> Product saved</div> : null}
      <section className="form-card">
        <div className="form-card-title"><div><span>01 · Essentials</span><h2>Tell customers what it is</h2></div></div>
        <div className="field-grid">
          <label className="field field-wide"><span>Product name</span><input name="name" defaultValue={product?.name} required placeholder="Mango jelly cake" /></label>
          <label className="field"><span>Category</span><input name="category" defaultValue={product?.category ?? "Cakes"} required /></label>
          <label className="field"><span>Variant name</span><input name="variantName" defaultValue={variant?.name ?? "Standard"} /></label>
          <label className="field field-wide"><span>Description</span><textarea name="description" rows={4} defaultValue={product?.description} placeholder="What makes this product worth bringing home?" /></label>
        </div>
      </section>
      <section className="form-card">
        <div className="form-card-title"><div><span>02 · Selling details</span><h2>Price it and keep count</h2></div></div>
        <div className="field-grid field-grid-3">
          <label className="field"><span>Price ({store.currency === "INR" ? "₹" : "$"})</span><input name="price" type="number" min="1" step="0.01" defaultValue={variant ? variant.priceMinor / 100 : 650} required /></label>
          <label className="field"><span>Stock quantity</span><input name="stock" type="number" min="0" step="1" defaultValue={variant?.stock ?? 6} required /></label>
          <label className="field"><span>SKU</span><input name="sku" defaultValue={variant?.sku ?? ""} placeholder="Auto-generated" /></label>
        </div>
      </section>
      <section className="form-card">
        <div className="form-card-title"><div><span>03 · Shop window</span><h2>Give it a good first impression</h2></div><ImageIcon /></div>
        <label className="field"><span>Image URL</span><input name="imageUrl" type="url" defaultValue={product?.imageUrl ?? defaultImage} /></label>
        <label className="check-field"><input name="published" type="checkbox" defaultChecked={product?.published ?? true} /><span><b>Publish in storefront</b><small>Customers can find and buy this product.</small></span></label>
      </section>
      <div className="form-actions"><button className="button button-primary" type="submit">Save product</button></div>
    </form>
  );
}
