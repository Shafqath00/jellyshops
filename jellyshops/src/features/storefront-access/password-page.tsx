"use client";

import { useState, type FormEvent } from "react";

/**
 * What shoppers see instead of a password-protected store. Plain markup and the
 * theme's own tokens, so it follows the store's colours and fonts.
 */
export function StorefrontPasswordPage({ storeSlug, storeName, message }: { storeSlug: string; storeName: string; message: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/storefront-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeSlug, password }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(body.error ?? "That password isn't right."); return; }
      window.location.reload();
    } catch {
      setError("Couldn't check the password. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="jelly-password-page">
    <form onSubmit={submit} className="jelly-password-card" aria-labelledby="jelly-password-title">
      <h1 id="jelly-password-title">{storeName}</h1>
      <p>{message.trim() || "This store is password protected. Enter the password to continue."}</p>
      <label>
        <span>Password</span>
        <input type="password" name="password" autoComplete="current-password" autoFocus required value={password} aria-invalid={error ? true : undefined} aria-describedby={error ? "jelly-password-error" : undefined} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error && <p id="jelly-password-error" role="alert" className="jelly-password-error">{error}</p>}
      <button type="submit" disabled={busy || !password}>{busy ? "Checking…" : "Enter store"}</button>
    </form>
  </main>;
}
