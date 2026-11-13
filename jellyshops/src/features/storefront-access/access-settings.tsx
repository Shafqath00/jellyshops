"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Banner, Button, Field, SkeletonBlock, useToast } from "@/components/admin";
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
  const [attempt, setAttempt] = useState(0);
  const toast = useToast();

  useEffect(() => {
    const controller = new AbortController();
    void fetcher(url, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
      .then(parse)
      .then((value) => { setSettings(value); setError(""); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load the password settings."); });
    return () => controller.abort();
  }, [url, token, fetcher, attempt]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const enabled = data.get("enabled") === "on";
    setSaving(true); setError("");
    try {
      const next = await fetcher(url, { method: "PUT", headers, body: JSON.stringify({ enabled, message: String(data.get("message") ?? ""), ...(password ? { password } : {}) }) }).then(parse);
      setSettings(next);
      toast("Password settings saved");
      form.reset();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the password settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return error
    ? <Banner tone="critical" title="Could not load the password settings" action={<Button size="small" onClick={() => { setError(""); setAttempt((count) => count + 1); }}>Try again</Button>}>{error}</Banner>
    : <div className="jk-stack-sm" role="status" aria-label="Loading password settings"><SkeletonBlock width="50%" height={14} /><SkeletonBlock height={34} /><SkeletonBlock height={64} /></div>;
  return <form className="jk-stack-sm" onSubmit={(event) => void save(event)}>
    {error && <Banner tone="critical" title="Not saved">{error}</Banner>}
    <label className="jk-check"><input type="checkbox" name="enabled" defaultChecked={settings.enabled} /><span>Ask shoppers for a password<span className="jk-cell-sub">While this is on, shoppers see a password page instead of your store. Your own editor preview is not affected.</span></span></label>
    <Field id="access-password" label={settings.hasPassword ? "New password" : "Password"} help="Changing the password signs every shopper out. It is stored scrambled; nobody, including us, can read it back.">
      <input id="access-password" type="password" name="password" autoComplete="new-password" minLength={4} maxLength={100} placeholder={settings.hasPassword ? "Leave empty to keep the current password" : "At least 4 characters"} />
    </Field>
    <Field id="access-message" label="Message above the password box" help="Tell visitors when you open, or who to ask for the password.">
      <textarea id="access-message" name="message" rows={3} maxLength={500} defaultValue={settings.message} placeholder="We open on 1 December. Enter the password if you have an early invitation." />
    </Field>
    <p className="jk-muted">This keeps your store&apos;s pages private. It does not hide your products from the public catalogue feed, so don&apos;t use it for secrets.</p>
    <div className="jk-row"><Button type="submit" variant="primary" loading={saving} loadingLabel="Saving…">Save password settings</Button></div>
  </form>;
}
