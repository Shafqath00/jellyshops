"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { hasRecoverySession, endRecovery } from "../lib/recovery-session";
import { merchantSupabase } from "../lib/supabase-clients";
import { MerchantAuthShell } from "./auth-shell";
import { MerchantPasswordField, newPasswordMinimum } from "./password-field";
import styles from "./merchant-auth.module.css";

export function MerchantResetPasswordForm() {
  const router = useRouter();
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [changed, setChanged] = useState(false);
  const inFlight = useRef(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void merchantSupabase().then(async (supabase) => {
      const session = (await supabase?.auth.getSession())?.data.session ?? null;
      if (active) setValid(hasRecoverySession(session));
    }).catch(() => {
      if (active) setValid(false);
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !valid) return;
    if (password.length < newPasswordMinimum) {
      setError("Use at least 6 characters.");
      passwordInput.current?.focus();
      return;
    }
    if (confirm !== password) {
      setError("Passwords don’t match.");
      confirmInput.current?.focus();
      return;
    }

    setError("");
    inFlight.current = true;
    setPending(true);
    try {
      const supabase = await merchantSupabase();
      if (!supabase) throw new Error();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session || !hasRecoverySession(data.session)) {
        setValid(false);
        return;
      }

      const result = await supabase.auth.updateUser({ password });
      if (result.error) {
        if (result.error.code === "same_password") setError("Choose a password you haven’t used for this account.");
        else if (result.error.code === "weak_password") setError("Choose a stronger password and try again.");
        else setError("We couldn’t update your password. Try again, or request a new link.");
        return;
      }

      endRecovery();
      setChanged(true);
    } catch {
      setError("We couldn’t update your password. Check your connection and try again.");
    } finally {
      setPending(false);
      inFlight.current = false;
    }
  }

  return (
    <MerchantAuthShell title="Choose a new password" subtitle="Use this password the next time you sign in.">
      {valid === null && <p className={styles.hint} role="status">Checking your reset link…</p>}
      {valid === false && (
        <>
          <p className={styles.alert} role="alert">Your password reset link is invalid or expired.</p>
          <p className={styles.switch}><Link className={styles.textLink} href="/login?recover=1">Request a new reset link</Link></p>
        </>
      )}
      {changed && (
        <>
          <p className={styles.notice} role="status">Your password has been updated.</p>
          <p className={styles.switch}><button type="button" className={styles.textLink} onClick={() => router.replace("/admin")}>Continue to your dashboard</button></p>
        </>
      )}
      {valid && !changed && (
        <form className={styles.form} onSubmit={submit} noValidate aria-busy={pending}>
          {error && <p className={styles.alert} role="alert" id="reset-error">{error}</p>}
          <MerchantPasswordField id="reset-password" name="password" label="New password" ref={passwordInput} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete="new-password" minLength={newPasswordMinimum} required disabled={pending} aria-describedby={error ? "reset-error" : undefined} />
          <MerchantPasswordField id="reset-confirm" name="confirmPassword" label="Confirm password" ref={confirmInput} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required disabled={pending} aria-describedby={error ? "reset-error" : undefined} />
          <button className={styles.primary} type="submit" disabled={pending}>
            {pending && <LoaderCircle className="motion-safe:animate-spin" size={17} aria-hidden="true" />}
            {pending ? "Updating password…" : "Update password"}
          </button>
        </form>
      )}
    </MerchantAuthShell>
  );
}
