"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useShop } from "@/contexts/shop-context";

export default function OnboardingPage() {
  const { state, repository } = useShop();
  const store = state.stores.find((item) => item.id === state.activeStoreId)!;
  const [complete, setComplete] = useState(false);
  function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); repository.saveStore({ ...store, name: String(data.get("storeName")), slug: String(data.get("slug")), tagline: String(data.get("tagline")) }); setComplete(true); }
  return <div className="admin-page onboarding-page"><span className="page-kicker">Welcome to Jelly</span><h1>Let’s shape your shop.</h1><p>Three details are enough to get a convincing storefront on its feet.</p>{complete ? <section className="onboarding-done"><span><Check /></span><h2>Your shop is ready to explore</h2><p>Products and demo orders are already waiting inside.</p><Link className="button button-primary" href="/admin">Open dashboard <ArrowRight size={17} /></Link></section> : <form className="form-card admin-form" onSubmit={save}><label className="field"><span>Store name</span><input name="storeName" defaultValue={store.name} required /></label><label className="field"><span>Store address</span><div className="slug-input"><span>jelly.shop/</span><input name="slug" defaultValue={store.slug} required /></div></label><label className="field"><span>One-line promise</span><input name="tagline" defaultValue={store.tagline} required /></label><button className="button button-primary" type="submit">Create my store <ArrowRight size={17} /></button></form>}</div>;
}
