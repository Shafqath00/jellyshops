"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { merchantSupabase } from "@/features/auth/lib/supabase-clients";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { configured } = useAuth();
  const router = useRouter();
  const query = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isSignup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const supabase = await merchantSupabase();
    if (!supabase) return;
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    setPending(true);
    setError("");
    setNotice("");

    const result = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: String(data.get("name") ?? "") }, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding")}` },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    setPending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (!result.data.session) {
      setNotice(
        "Check your inbox to confirm your email, then return here to sign in.",
      );
      return;
    }

    router.replace(isSignup ? "/onboarding" : query.get("next") || "/admin");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link href="/" className="auth-brand"><span aria-hidden="true">J</span>jelly shop</Link>
        <div className="auth-intro">
          <p>{isSignup ? "Start selling" : "Merchant sign in"}</p>
          <h1>{isSignup ? "Create your merchant account" : "Welcome back"}</h1>
          <span className="auth-lede">{isSignup
            ? "Start your store and manage products, orders, and your storefront."
            : "Sign in to manage your Jelly Shop workspace."}</span>
          <div className="auth-orbit" aria-hidden="true"><i /><i /><i /></div>
        </div>
        {!configured ? (
          <div className="auth-message" role="alert">
            <strong>Authentication is not configured.</strong>
            <p>Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable merchant access.</p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {isSignup && <label htmlFor="name"><span>Your name</span><input id="name" name="name" autoComplete="name" required /></label>}
            <label htmlFor="email"><span>Email</span><input id="email" name="email" type="email" autoComplete="email" required /></label>
            <label htmlFor="password"><span>Password</span><input id="password" name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={6} required /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <button className="auth-submit" disabled={pending} type="submit">
              {pending ? "Working…" : isSignup ? "Create account" : "Sign in"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
        )}
        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "New to Jelly Shop?"}{" "}
          <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</Link>
        </p>
      </section>
    </main>
  );
}
