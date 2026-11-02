"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { authApiOrigin } from "@/features/auth/providers/auth-provider";
import type { AccessSettings } from "./access-api";

async function parse(response: Response): Promise<AccessSettings> {
  const body = await response.json().catch(() => ({})) as Partial<AccessSettings> & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? "Could not load or save the password settings. Try again.");
  return { enabled: body.enabled === true, hasPassword: body.hasPassword === true, message: typeof body.message === "string" ? body.message : "" };
}

/**
 * Settings > Password protection. While it is on, shoppers see a password page
 * instead of the store. It guards the storefront pages, not the data behind
 * them, so it is for keeping a store private before launch, not for secrets.
 */
export function StorefrontAccessSettings({ storeId, token, fetcher = fetch }: { storeId: string; token: string; fetcher?: typeof fetch }) {
  const url = `${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/storefront/access`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetcher(url, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
      .then(parse)
      .then((value) => { setSettings(value); setError(""); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load the password settings."); });
    return () => controller.abort();
  }, [url, token, fetcher]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const enabled = data.get("enabled") === "on";
    setSaving(true); setSaved(false); setError("");
    try {
      const next = await fetcher(url, { method: "PUT", headers, body: JSON.stringify({ enabled, message: String(data.get("message") ?? ""), ...(password ? { password } : {}) }) }).then(parse);
      setSettings(next);
      setSaved(true);
      form.reset();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the password settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <section className="form-card"><div className="form-card-title"><div><span>Storefront</span><h2>Password protection</h2></div></div>{error ? <div role="alert" className="error-banner">{error}</div> : <p aria-live="polite">Loading…</p>}</section>;
  return <form className="admin-form" onSubmit={save} onChange={() => setSaved(false)}>
    <section className="form-card">
      <div className="form-card-title"><div><span>Storefront</span><h2>Password protection</h2></div></div>
      {error && <div role="alert" className="error-banner">{error}</div>}
      {saved && <div className="success-banner" role="status"><CheckCircle2 size={18} /> Password settings saved</div>}
      <div className="field-grid">
        <label className="field"><span>Ask shoppers for a password</span><input type="checkbox" name="enabled" defaultChecked={settings.enabled} /><small>While this is on, shoppers see a password page instead of your store. Your own editor preview is not affected.</small></label>
        <label className="field"><span>{settings.hasPassword ? "New password" : "Password"}</span><input type="password" name="password" autoComplete="new-password" minLength={4} maxLength={100} placeholder={settings.hasPassword ? "Leave empty to keep the current password" : "At least 4 characters"} /><small>Changing the password signs every shopper out. The password is stored scrambled; nobody, including us, can read it back.</small></label>
        <label className="field"><span>Message above the password box</span><textarea name="message" rows={3} maxLength={500} defaultValue={settings.message} placeholder="We open on 1 December. Enter the password if you have an early invitation." /></label>
      </div>
      <p className="muted">This keeps the storefront pages private. It does not hide your products from the public catalogue feed, so don&apos;t use it for secrets.</p>
    </section>
    <div className="form-actions"><button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save password settings"}</button></div>
  </form>;
}
