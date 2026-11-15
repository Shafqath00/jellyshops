"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MerchantAuthShell } from "./components/auth-shell";
import styles from "./components/merchant-auth.module.css";
import { merchantCallbackUrl, merchantReturnPath } from "./lib/auth-navigation";
import { beginRecovery } from "./lib/recovery-session";
import { merchantSupabase, supabaseConfigured } from "./lib/supabase-clients";

const invalidLink = "This link has expired, was already used, or was opened in another browser. Return to sign in to try again.";

async function resolveCallback(code: string, nextPath: string, recovery: boolean) {
  const supabase = await merchantSupabase();
  if (!supabase) throw new Error();
  // The SDK reads the flow ID from the callback URL and uses the matching PKCE verifier.
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) throw new Error();
  const isRecovery = "redirectType" in data && data.redirectType === "recovery";

  if (isRecovery) {
    if (!beginRecovery(data.session)) throw new Error();
    return "/auth/reset-password";
  }

  if (recovery) throw new Error();
  return merchantReturnPath(nextPath);
}

export function MerchantAuthCallback({ code, nextPath, recovery, providerError }: {
  code: string; nextPath: string; recovery: boolean; providerError?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const exchange = useRef<{ code: string; result: Promise<string> } | null>(null);
  const cancelled = providerError === "access_denied";
  const confirmationError = cancelled ? "Sign-in was cancelled. Return to sign in when you’re ready." : !supabaseConfigured || !code || providerError ? invalidLink : error;

  useEffect(() => {
    if (!supabaseConfigured || !code || providerError) return;
    let active = true;
    if (exchange.current?.code !== code) {
      exchange.current = { code, result: resolveCallback(code, nextPath, recovery) };
    }
    void exchange.current.result.then((target) => {
      if (active) router.replace(target);
    }).catch(() => {
      if (active) setError(invalidLink);
    });
    return () => { active = false; };
  }, [code, nextPath, providerError, recovery, router]);

  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resending) return;
    setResending(true);
    setNotice("");
    try {
      const supabase = await merchantSupabase();
      if (!supabase) throw new Error();
      const result = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: merchantCallbackUrl("/onboarding") },
      });
      if (result.error && (result.error.status ?? 0) >= 500) throw new Error();
      setNotice("If this account needs verification, we’ll send a confirmation link. Open it in this browser.");
    } catch {
      setNotice("We couldn’t request a link. Check your connection and try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <MerchantAuthShell
      title={confirmationError ? "Check your sign-in link" : recovery ? "Opening password reset" : "Confirming your account"}
      subtitle={confirmationError || "Please wait while we verify your sign-in."}
    >
      {confirmationError && (
        <>
          {supabaseConfigured && !cancelled && !recovery && nextPath === "/onboarding" && (
            <form className={styles.form} onSubmit={resend}>
              <div>
                <label className={styles.label} htmlFor="confirm-email">Email</label>
                <input className={styles.input} id="confirm-email" autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              {notice && <p role="status" className={styles.notice}>{notice}</p>}
              <button className={styles.primary} disabled={resending}>{resending ? "Requesting link…" : "Request a new confirmation link"}</button>
            </form>
          )}
          <p className={styles.switch}><Link className={styles.textLink} href={recovery ? "/login?recover=1" : "/login"}>{recovery ? "Request a new reset link" : "Return to sign in"}</Link></p>
        </>
      )}
    </MerchantAuthShell>
  );
}
