"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { storeUrl } from "@jelly/storefront-schema";
import { MerchantAuthShell } from "@/features/auth/components/auth-shell";
import styles from "@/features/auth/components/merchant-auth.module.css";
import { merchantSupabase } from "@/features/auth/lib/supabase-clients";
import { authApiOrigin } from "@/features/auth/providers/auth-provider";

/**
 * The platform super-admin on platform.jellyshop.io (`app/platform-admin`). Its own sign-in (sessions are kept per
 * site), then a second step with an authenticator app, which is set up here the first time. The backend
 * (`/api/platform/*`) decides who may see anything: only people listed in "PlatformAdmin", with the second step,
 * signed in within 12 hours. This page only follows what it says.
 */
type Shop = { id: string; name: string; slug: string; country: string; currency: string; createdAt: string; archived: boolean; ownerEmail: string | null };
type Stage =
  | { kind: "loading" }
  | { kind: "sign-in"; message?: string }
  | { kind: "enrol"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string }
  | { kind: "refused"; message: string }
  | { kind: "ready"; email: string; role: string };

async function api<T>(client: SupabaseClient, path: string): Promise<{ status: number; body: T & { error?: { code?: string; message?: string } } }> {
  const token = (await client.auth.getSession()).data.session?.access_token;
  const response = await fetch(`${authApiOrigin()}/api/platform${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

export function PlatformConsole() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  /** Works out the next step from the session and the backend's answer. */
  const refresh = useCallback(async (supabase: SupabaseClient) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) { setStage({ kind: "sign-in" }); return; }
    const level = (await supabase.auth.mfa.getAuthenticatorAssuranceLevel()).data;
    if (level?.currentLevel !== "aal2") {
      const factors = (await supabase.auth.mfa.listFactors()).data;
      const ready = factors?.totp.find((factor) => factor.status === "verified");
      if (ready) { setStage({ kind: "verify", factorId: ready.id }); return; }
      // Unfinished set-ups would block a new one with the same name.
      for (const factor of factors?.all ?? []) if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
      const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Jellyshop platform" });
      if (enrolled.error || !enrolled.data) { setStage({ kind: "refused", message: "We couldn't start the authenticator set-up. Try again later." }); return; }
      setStage({ kind: "enrol", factorId: enrolled.data.id, qr: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret });
      return;
    }
    const me = await api<{ role: string; email: string }>(supabase, "/me");
    if (me.status === 200) { setStage({ kind: "ready", email: me.body.email, role: me.body.role }); return; }
    if (me.body.error?.code === "PLATFORM_SIGN_IN_AGAIN" || me.status === 401) {
      await supabase.auth.signOut();
      setStage({ kind: "sign-in", message: me.body.error?.message ?? "Sign in again." });
      return;
    }
    setStage({ kind: "refused", message: me.body.error?.message ?? "This page isn't available to your account." });
  }, []);

  useEffect(() => {
    let active = true;
    void merchantSupabase().then(async (supabase) => {
      if (!active) return;
      if (!supabase) { setStage({ kind: "refused", message: "Sign-in isn't set up on this server." }); return; }
      setClient(supabase);
      await refresh(supabase);
    });
    return () => { active = false; };
  }, [refresh]);

  if (stage.kind === "loading" || !client) return <MerchantAuthShell title="Platform" subtitle="Loading…"><span /></MerchantAuthShell>;
  if (stage.kind === "sign-in") return <SignIn client={client} message={stage.message} onDone={() => void refresh(client)} />;
  if (stage.kind === "enrol" || stage.kind === "verify") return <SecondStep client={client} stage={stage} onDone={() => void refresh(client)} />;
  const signOut = async () => { await client.auth.signOut(); setStage({ kind: "sign-in" }); };
  if (stage.kind === "refused") {
    return <MerchantAuthShell title="Not available" subtitle={stage.message}>
      <p className={styles.switch}><button type="button" className={styles.textLink} onClick={signOut}>Sign out</button></p>
    </MerchantAuthShell>;
  }
  return <ShopList client={client} email={stage.email} role={stage.role} onSignOut={signOut} />;
}

function SignIn({ client, message, onDone }: { client: SupabaseClient; message?: string; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(message ?? "");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const result = await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) { setError("That email and password don't match."); return; }
    onDone();
  }
  return <MerchantAuthShell eyebrow="Jellyshop platform" title="Sign in" subtitle="For Jellyshop staff only.">
    <form className={styles.form} onSubmit={submit}>
      <div><label className={styles.label} htmlFor="platform-email">Email</label><input className={styles.input} id="platform-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <div><label className={styles.label} htmlFor="platform-password">Password</label><input className={styles.input} id="platform-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
      {error && <p role="alert" className={styles.alert}>{error}</p>}
      <button className={styles.primary} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </MerchantAuthShell>;
}

function SecondStep({ client, stage, onDone }: { client: SupabaseClient; stage: Extract<Stage, { kind: "enrol" | "verify" }>; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const result = await client.auth.mfa.challengeAndVerify({ factorId: stage.factorId, code: code.trim() });
    setBusy(false);
    if (result.error) { setError("That code didn't work. Check the time on your phone and try the newest code."); return; }
    onDone();
  }
  const enrolling = stage.kind === "enrol";
  return <MerchantAuthShell eyebrow="Jellyshop platform" title={enrolling ? "Set up your authenticator" : "Confirm it's you"}
    subtitle={enrolling ? "Scan this with an authenticator app (for example 1Password, Google Authenticator or Authy), then enter the 6-digit code it shows." : "Enter the 6-digit code from your authenticator app."}>
    <form className={styles.form} onSubmit={submit}>
      {stage.kind === "enrol" && <div>
        {/* Supabase returns the QR code as an SVG data address. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stage.qr} alt="QR code for your authenticator app" width={180} height={180} />
        <p className={styles.hint}>Can&apos;t scan it? Enter this key instead: <code>{stage.secret}</code></p>
      </div>}
      <div><label className={styles.label} htmlFor="platform-code">6-digit code</label><input className={styles.input} id="platform-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></div>
      {error && <p role="alert" className={styles.alert}>{error}</p>}
      <button className={styles.primary} disabled={busy}>{busy ? "Checking…" : "Continue"}</button>
    </form>
  </MerchantAuthShell>;
}

function ShopList({ client, email, role, onSignOut }: { client: SupabaseClient; email: string; role: string; onSignOut: () => void }) {
  const [query, setQuery] = useState("");
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    void api<{ stores: Shop[] }>(client, `/stores${search ? `?q=${encodeURIComponent(search)}` : ""}`).then((result) => {
      if (!active) return;
      if (result.status !== 200) { setError(result.body.error?.message ?? "Could not load shops."); return; }
      setError(""); setShops(result.body.stores);
    });
    return () => { active = false; };
  }, [client, search]);

  return <main className={styles.shell} style={{ display: "block", padding: "32px 24px", minHeight: "100vh" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div><p className={styles.eyebrow}>Jellyshop platform</p><h1 style={{ margin: 0 }}>Shops</h1></div>
      <p style={{ margin: 0 }}>{email} · {role === "OWNER" ? "Owner" : "Support"} · <button type="button" className={styles.textLink} onClick={onSignOut}>Sign out</button></p>
    </header>
    <form role="search" onSubmit={(event) => { event.preventDefault(); setSearch(query.trim()); }} style={{ display: "flex", gap: 8, maxWidth: 520, marginBottom: 16 }}>
      <label className="sr-only" htmlFor="platform-search">Search shops by name or address</label>
      <input className={styles.input} id="platform-search" type="search" placeholder="Search by name or address" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button className={styles.secondary}>Search</button>
    </form>
    {error && <p role="alert" className={styles.alert}>{error}</p>}
    {!shops ? <p role="status">Loading shops…</p> : shops.length === 0 ? <p>No shops match.</p> :
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption className="sr-only">Shops, newest first (up to 200)</caption>
          <thead><tr>{["Shop", "Address", "Owner", "Market", "Created", "Status"].map((label) => <th key={label} scope="col" style={{ textAlign: "left", padding: "8px 12px" }}>{label}</th>)}</tr></thead>
          <tbody>{shops.map((shop) => <tr key={shop.id} style={{ borderTop: "1px solid color-mix(in srgb, currentColor 15%, transparent)" }}>
            <td style={{ padding: "8px 12px" }}>{shop.name}</td>
            <td style={{ padding: "8px 12px" }}><a className={styles.inlineLink} href={storeUrl(shop.slug)} target="_blank" rel="noreferrer">{shop.slug}</a></td>
            <td style={{ padding: "8px 12px" }}>{shop.ownerEmail ?? "None"}</td>
            <td style={{ padding: "8px 12px" }}>{shop.country} · {shop.currency}</td>
            <td style={{ padding: "8px 12px" }}>{new Date(shop.createdAt).toLocaleDateString("en-GB")}</td>
            <td style={{ padding: "8px 12px" }}>{shop.archived ? "Archived" : "Active"}</td>
          </tr>)}</tbody>
        </table>
      </div>}
  </main>;
}
