"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useShop } from "@/contexts/shop-context";

export default function SettingsPage() {
  const { state, repository, resetDemo } = useShop();
  const store = state.stores.find((item) => item.id === state.activeStoreId)!;
  const [saved, setSaved] = useState(false);
  function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); repository.saveStore({ ...store, name: String(data.get("name")), slug: String(data.get("slug")), shippingMinor: Math.round(Number(data.get("shipping")) * 100) }); setSaved(true); }
  return <div className="admin-page narrow-page"><header className="page-head"><span className="page-kicker">Settings</span><h1>Shop essentials</h1><p>The operational details behind your storefront.</p></header>{saved ? <div className="success-banner"><CheckCircle2 size={18} /> Settings saved</div> : null}<form className="admin-form" onSubmit={save} onChange={() => setSaved(false)}><section className="form-card"><div className="form-card-title"><div><span>Business</span><h2>Store identity</h2></div></div><div className="field-grid"><label className="field"><span>Store name</span><input name="name" defaultValue={store.name} /></label><label className="field"><span>Store slug</span><input name="slug" defaultValue={store.slug} /></label><label className="field"><span>Flat shipping ({store.currency === "INR" ? "₹" : "$"})</span><input name="shipping" type="number" min="0" step="0.01" defaultValue={store.shippingMinor / 100} /></label><label className="field"><span>Currency</span><input value={store.currency} disabled /></label></div></section><div className="form-actions"><button className="button button-primary" type="submit">Save changes</button></div></form><section className="danger-zone"><div><h2>Reset local demo</h2><p>Restore seeded products, customers, orders, and storefront settings.</p></div><button className="button button-secondary" type="button" onClick={resetDemo}><RotateCcw size={16} /> Reset demo data</button></section></div>;
}
