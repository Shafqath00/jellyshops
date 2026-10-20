"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { authApiOrigin, useAuth } from "@/features/auth/auth-provider";

interface Settings {
  id: string; name: string; slug: string; currency: string; country: string;
  shippingMinor: number; shippingCopy: string; contactEmail: string | null; timezone: string; revision: number;
}
async function settingsResponse(response: Response): Promise<Settings> {
  const body = await response.json() as { settings?: Settings; error?: { message?: string } };
  if (!response.ok || !body.settings) throw new Error(body.error?.message ?? "Could not load or save your settings. Try again.");
  return body.settings;
}
function StoreSettingsForm({ storeId, token }: { storeId: string; token: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/settings`, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
      .then(settingsResponse).then((value) => { setSettings(value); setError(""); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load settings."); });
    return () => controller.abort();
  }, [storeId, token, reload]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!settings) return;
    const data = new FormData(event.currentTarget);
    setSaving(true); setSaved(false); setError("");
    try {
      const next = await fetch(`${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ revision: settings.revision, name: String(data.get("name")), slug: String(data.get("slug")), contactEmail: String(data.get("email") ?? "").trim() || null, timezone: String(data.get("timezone")), shippingMinor: Math.round(Number(data.get("shipping")) * 100), shippingCopy: String(data.get("shippingCopy") ?? "").trim() }),
      }).then(settingsResponse);
      setSettings(next); setSaved(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save settings."); }
    finally { setSaving(false); }
  }
  return <>
    {error && <div role="alert" className="error-banner">{error} <button type="button" className="button button-secondary" disabled={saving} onClick={() => setReload((value) => value + 1)}>Reload latest settings</button></div>}
    {saved && <div className="success-banner" role="status"><CheckCircle2 size={18} /> Settings saved</div>}
    {!settings ? <p aria-live="polite">Loading settings…</p> : <form key={`${settings.revision}:${reload}`} className="admin-form" onSubmit={save} onChange={() => setSaved(false)}>
      <section className="form-card"><div className="form-card-title"><div><span>Business</span><h2>Store identity</h2></div></div><div className="field-grid">
        <label className="field"><span>Store name</span><input name="name" required maxLength={120} defaultValue={settings.name} /></label>
        <label className="field"><span>Store slug</span><input name="slug" required minLength={3} maxLength={63} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={settings.slug} /><small>Locked after your first publication or order.</small></label>
        <label className="field"><span>Contact email</span><input name="email" type="email" defaultValue={settings.contactEmail ?? ""} /></label>
        <label className="field"><span>Timezone</span><input name="timezone" required defaultValue={settings.timezone} placeholder="Asia/Kolkata" /></label>
        <label className="field"><span>Flat shipping ({settings.currency})</span><input name="shipping" type="number" required min="0" max="21474836.47" step="0.01" defaultValue={settings.shippingMinor / 100} /><small>Charged once per order for domestic delivery. Enter 0 for free shipping.</small></label>
        <label className="field"><span>Shipping information for customers</span><textarea name="shippingCopy" maxLength={500} rows={3} defaultValue={settings.shippingCopy} placeholder="Delivery details, timing, or packaging information" /></label>
        <label className="field"><span>Country / currency</span><input value={`${settings.country} / ${settings.currency}`} disabled /></label>
      </div></section><div className="form-actions"><button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save changes"}</button></div>
    </form>}
  </>;
}
export default function SettingsPage() {
  const { activeStore, session } = useAuth();
  return <div className="admin-page narrow-page"><header className="page-head"><span className="page-kicker">Settings</span><h1>Shop essentials</h1><p>The operational details behind your storefront.</p></header>{activeStore && session ? <StoreSettingsForm key={activeStore.id} storeId={activeStore.id} token={session.access_token} /> : <p>Select a store to manage its settings.</p>}</div>;
}
