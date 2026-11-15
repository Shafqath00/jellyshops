"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, MailCheck } from "lucide-react";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
import { merchantSupabase } from "@/features/auth/lib/supabase-clients";
import { merchantCallbackUrl, merchantReturnPath } from "../lib/auth-navigation";
import { MerchantAuthShell } from "./auth-shell";
import { MerchantPasswordField, newPasswordMinimum } from "./password-field";
import styles from "./merchant-auth.module.css";

type Policies = { version: string; termsUrl: string; privacyUrl: string };
type Action = "" | "submit" | "google";
const recoveryNotice = "If an account uses this email, we’ll send a password reset link. Open it in this browser.";

function isHttpsLink(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isPolicies(value: unknown): value is Policies {
  return Boolean(value && typeof value === "object"
    && "version" in value && typeof value.version === "string" && value.version.trim()
    && "termsUrl" in value && isHttpsLink(value.termsUrl)
    && "privacyUrl" in value && isHttpsLink(value.privacyUrl));
}

function friendlyAuthError(error: { code?: string }, signup: boolean) {
  switch (error.code) {
    case "invalid_credentials": return "The email or password doesn’t match. Check both and try again.";
    case "email_not_confirmed": return "Confirm your email first, then come back to sign in.";
    case "weak_password": return "Choose a stronger password and try again.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit": return "Too many attempts. Wait a moment and try again.";
    case "email_address_invalid": return "Enter a valid email address.";
    default: return signup
      ? "We couldn’t create the account. Try again, or sign in if you already have one."
      : "We couldn’t sign you in. Try again.";
  }
}

function PasswordStrength({ password }: { password: string }) {
  const score = !password ? 0 : password.length < newPasswordMinimum ? 1
    : [password.length >= 10, /[a-zA-Z]/.test(password) && /[0-9]/.test(password), /[^a-zA-Z0-9]/.test(password)]
        .filter(Boolean).length >= 2 ? 4 : password.length >= 10 ? 3 : 2;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  return (
    <div id="signup-strength">
      <div className={styles.strength} aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={step > score ? undefined : score === 1 ? styles.weak : score === 2 ? styles.fair : styles.strong} />
        ))}
      </div>
      <p className={styles.hint}>
        {password.length >= newPasswordMinimum ? `${labels[score]} password.` : "Use at least 6 characters. A mix of letters and numbers is stronger."}
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.6h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.8Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.2-1.8 13.5-4.7l-6.6-5a12.3 12.3 0 0 1-18.3-6.3H5.8v5.2A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.6 28a12 12 0 0 1 0-8v-5.2H5.8a20 20 0 0 0 0 18.4l6.8-5.2Z" />
      <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3l5.9-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 14.8l6.8 5.2A11.9 11.9 0 0 1 24 12Z" />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { configured } = useAuth();
  const router = useRouter();
  const query = useSearchParams();
  const signup = mode === "signup";
  const googleEnabled = process.env.NEXT_PUBLIC_JELLYSHOP_GOOGLE_SIGN_IN === "true";
  const [recovery, setRecovery] = useState(!signup && query.get("recover") === "1");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState<Action>("");
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [policies, setPolicies] = useState<Policies | null>(null);
  const [checksPolicies, setChecksPolicies] = useState(signup);
  const nameInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!signup || !configured) return;
    const controller = new AbortController();
    void fetch(`${authApiOrigin()}/api/onboarding/policies`, { signal: controller.signal })
      .then(async (response) => response.ok ? (await response.json()) as unknown : null)
      .then((result) => {
        if (!controller.signal.aborted && isPolicies(result)) setPolicies(result);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setChecksPolicies(false);
      });

    return () => controller.abort();
  }, [configured, signup]);

  const formId = recovery ? "merchant-recover" : signup ? "merchant-signup" : "merchant-login";
  const nameError = submitted && signup && !name.trim() ? "Enter your full name." : "";
  const emailError = submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Enter a valid email address." : "";
  const passwordError = submitted && !recovery && password.length < (signup ? newPasswordMinimum : 1)
    ? signup ? "Use at least 6 characters." : "Enter your password." : "";
  const mismatch = signup && (submitted || confirm.length > 0) && confirm !== password ? "Passwords don’t match." : "";
  const target = signup ? "/onboarding" : merchantReturnPath(query.get("next"));
  const busy = pending !== "";
  const unavailable = signup && !policies;

  function openRecovery(open: boolean) {
    setError("");
    setNotice("");
    setSubmitted(false);
    setPassword("");
    setRecovery(open);
    requestAnimationFrame(() => emailInput.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || unavailable) return;
    setSubmitted(true);
    setError("");
    setNotice("");
    if (signup && !name.trim()) { nameInput.current?.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { emailInput.current?.focus(); return; }
    if (!recovery && password.length < (signup ? newPasswordMinimum : 1)) { passwordInput.current?.focus(); return; }
    if (signup && confirm !== password) { confirmationInput.current?.focus(); return; }

    inFlight.current = true;
    setPending("submit");
    try {
      const supabase = await merchantSupabase();
      if (!supabase) throw new Error();
      if (recovery) {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: merchantCallbackUrl("/admin", true) });
        if (result.error && (result.error.status ?? 0) >= 500) throw new Error();
        setNotice(recoveryNotice);
        return;
      }

      const credentials = { email: email.trim(), password };
      const result = signup
        ? await supabase.auth.signUp({
          ...credentials,
          options: { data: { name: name.trim() }, emailRedirectTo: merchantCallbackUrl("/onboarding") },
        })
        : await supabase.auth.signInWithPassword(credentials);
      if (result.error) {
        setError(friendlyAuthError(result.error, signup));
        return;
      }
      if (result.data.session) router.replace(target);
      else if (signup) { setSentTo(credentials.email); setCooldown(30); }
      else setError("We couldn’t sign you in. Try again.");
    } catch {
      setError(recovery ? "We couldn’t request a reset link. Check your connection and try again." : "We couldn’t connect. Try again.");
    } finally {
      setPending("");
      inFlight.current = false;
    }
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resendConfirmation() {
    if (inFlight.current || cooldown > 0) return;
    inFlight.current = true;
    setPending("submit");
    setError("");
    setNotice("");
    try {
      const supabase = await merchantSupabase();
      if (!supabase) throw new Error();
      const result = await supabase.auth.resend({ type: "signup", email: sentTo, options: { emailRedirectTo: merchantCallbackUrl("/onboarding") } });
      if (result.error) setError(friendlyAuthError(result.error, true));
      else { setNotice("We’ve sent a new confirmation email."); setCooldown(30); }
    } catch {
      setError("We couldn’t send another email. Check your connection and try again.");
    } finally {
      setPending("");
      inFlight.current = false;
    }
  }

  async function signInWithGoogle() {
    if (inFlight.current || unavailable) return;
    inFlight.current = true;
    setPending("google");
    setNotice("");
    setError("");
    try {
      const supabase = await merchantSupabase();
      if (!supabase) throw new Error();
      const result = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: merchantCallbackUrl(target) } });
      if (result.error || !result.data.url) throw new Error();
    } catch {
      setError("We couldn’t open Google sign-in. Try again or use your email.");
      setPending("");
      inFlight.current = false;
    }
  }

  if (sentTo) {
    return (
      <MerchantAuthShell title="Check your email" eyebrow="One last step" subtitle="Confirm your email address to finish creating your account.">
        <div className={styles.verify}>
          <span className={styles.verifyIcon} aria-hidden="true"><MailCheck size={24} strokeWidth={1.5} /></span>
          <p>We sent a confirmation link to <span className={styles.verifyEmail}>{sentTo}</span>.</p>
          <ol className={styles.verifySteps}>
            <li>Open the email from Jelly Shop.</li>
            <li>Select <strong>Confirm your email</strong>. Use this browser if you can.</li>
            <li>You’ll come straight back here to set up your store.</li>
          </ol>
          {error && <p className={styles.alert} role="alert">{error}</p>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}
          <div className={styles.verifyActions}>
            <button type="button" className={styles.primary} onClick={() => void resendConfirmation()} disabled={busy || cooldown > 0}>
              {pending === "submit" && <LoaderCircle className="motion-safe:animate-spin" size={17} aria-hidden="true" />}
              {pending === "submit" ? "Sending…" : cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend confirmation email"}
            </button>
            <button type="button" className={styles.secondary} onClick={() => { setSentTo(""); setNotice(""); setError(""); setSubmitted(false); }} disabled={busy}>Use a different email</button>
          </div>
          <p className={styles.hint}>Can’t find it? Check your spam or promotions folder. The link expires after 24 hours.</p>
        </div>
        <p className={styles.switch}>Already confirmed? <Link className={styles.textLink} href="/login">Sign in</Link></p>
      </MerchantAuthShell>
    );
  }

  const title = recovery ? "Reset your password" : signup ? "Create your store account" : "Welcome back";
  const subtitle = recovery ? "Enter the email you sign in with and we’ll send you a reset link."
    : signup ? "Start free. No card needed. Your store can be live in minutes."
      : "Sign in to manage your store, products and orders.";

  return (
    <MerchantAuthShell title={title} eyebrow={signup ? "Start free" : recovery ? "Password help" : "Log in"} subtitle={subtitle}>
      {!configured ? <p className={styles.alert} role="alert">Merchant sign-in is temporarily unavailable. Try again later.</p> : (
        <>
          {!recovery && googleEnabled && (
            <>
              <button className={styles.secondary} type="button" disabled={busy || unavailable} onClick={() => void signInWithGoogle()}>
                {pending === "google" ? <LoaderCircle className="motion-safe:animate-spin" size={17} aria-hidden="true" /> : <GoogleMark />}
                {pending === "google" ? "Opening Google…" : signup ? "Sign up with Google" : "Continue with Google"}
              </button>
              <div className={styles.divider} aria-hidden="true">or use email</div>
            </>
          )}
          <form className={styles.form} onSubmit={submit} noValidate aria-busy={pending === "submit"}>
            {error && <p className={styles.alert} role="alert">{error}</p>}
            {notice && <p className={styles.notice} role="status">{notice}</p>}
            {signup && checksPolicies && <p className={styles.hint} role="status">Loading account policies…</p>}
            {signup && unavailable && !checksPolicies && <p className={styles.alert} role="alert">New accounts are temporarily unavailable. Please try again later.</p>}
            {signup && <div>
              <label className={styles.label} htmlFor={`${formId}-name`}>Your name</label>
              <input className={styles.input} id={`${formId}-name`} name="name" ref={nameInput} value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" autoComplete="name" maxLength={120} required disabled={busy} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? `${formId}-name-error` : undefined} />
              {nameError && <p className={styles.fieldError} id={`${formId}-name-error`}>{nameError}</p>}
            </div>}
            <div>
              <label className={styles.label} htmlFor={`${formId}-email`}>Email</label>
              <input className={styles.input} id={`${formId}-email`} name="email" ref={emailInput} type="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={busy} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? `${formId}-email-error` : undefined} />
              {emailError && <p className={styles.fieldError} id={`${formId}-email-error`}>{emailError}</p>}
            </div>
            {!recovery && <>
              <div>
                <MerchantPasswordField
                  id={`${formId}-password`} label="Password" name="password" ref={passwordInput}
                  value={password} onChange={(event) => setPassword(event.target.value)}
                  placeholder={signup ? "At least 6 characters" : "Your password"}
                  autoComplete={signup ? "new-password" : "current-password"} disabled={busy} required
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? `${formId}-password-error` : signup ? "signup-strength" : undefined}
                  sideAction={!signup && <button type="button" className={`${styles.textLink} ${styles.inlineLink}`} onClick={() => openRecovery(true)} disabled={busy}>Forgot password?</button>}
                />
                {passwordError && <p className={styles.fieldError} id={`${formId}-password-error`}>{passwordError}</p>}
                {signup && <PasswordStrength password={password} />}
              </div>
              {signup && <div>
                <MerchantPasswordField id="signup-confirm-password" name="confirmPassword" label="Confirm password" ref={confirmationInput} value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Enter your password again" autoComplete="new-password" disabled={busy} required aria-invalid={Boolean(mismatch)} aria-describedby={mismatch ? "signup-match" : undefined} />
                {mismatch && <p className={styles.fieldError} id="signup-match" aria-live="polite">{mismatch}</p>}
              </div>}
            </>}
            {signup && policies && (
              <p className={styles.policy}>After verifying your identity, review and accept the <a className={styles.textLink} href={policies.termsUrl} target="_blank" rel="noreferrer">Terms of Service</a>. See our <a className={styles.textLink} href={policies.privacyUrl} target="_blank" rel="noreferrer">Privacy Policy</a> for how we use your information.</p>
            )}
            <button className={styles.primary} type="submit" disabled={busy || unavailable}>
              {pending === "submit" && <LoaderCircle className="motion-safe:animate-spin" size={17} aria-hidden="true" />}
              {pending === "submit" ? recovery ? "Requesting link…" : signup ? "Creating account…" : "Signing in…" : recovery ? "Send reset link" : signup ? "Create account" : "Sign in"}
            </button>
          </form>
        </>
      )}
      <p className={styles.switch}>
        {recovery ? <button className={styles.textLink} type="button" onClick={() => openRecovery(false)} disabled={busy}>Back to sign in</button> : <>
          {signup ? "Already have an account?" : "New to Jelly Shop?"}{" "}
          <Link className={styles.textLink} href={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Start free"}</Link>
        </>}
      </p>
    </MerchantAuthShell>
  );
}
