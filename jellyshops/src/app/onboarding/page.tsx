"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { authApiOrigin, useAuth } from "@/features/auth/auth-provider";

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export default function OnboardingPage() {
  const { configured, loading, session, stores, refreshMerchant } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login?next=/onboarding");
    if (stores.length) router.replace("/admin");
  }, [loading, router, session, stores.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setPending(true); setError("");
    const response = await fetch(`${authApiOrigin()}/api/stores`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ name, slug, currency: "INR", country: "IN" }) });
    setPending(false);
    if (!response.ok) { const body = await response.json().catch(() => null) as { error?: { message?: string } } | null; setError(body?.error?.message ?? "Your store could not be created. Check the store address and try again."); return; }
    await refreshMerchant(); router.replace("/admin");
  }

  if (!configured) return <main className="auth-page"><section className="auth-panel auth-message"><strong>Authentication is not configured.</strong><p>Connect Supabase before creating a merchant store.</p></section></main>;
  return <main className="auth-page"><section className="auth-panel"><div className="auth-intro"><p>First, your storefront</p><h1>What should customers call your shop?</h1><div className="auth-orbit" aria-hidden="true"><i /><i /><i /></div></div><form className="auth-form" onSubmit={submit}><label><span>Store name</span><input value={name} onChange={(event) => { setName(event.target.value); setSlug(slugify(event.target.value)); }} placeholder="Maya's pottery" required /></label><label><span>Store address</span><div className="auth-slug"><b>jelly.shop/</b><input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" minLength={3} maxLength={63} required /></div></label><p className="auth-helper"><Check size={15} /> You can change your shop details later.</p>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" disabled={pending} type="submit">{pending ? "Creating your shop…" : "Create my shop"}<ArrowRight size={16} /></button></form></section></main>;
}
