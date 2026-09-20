"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Store } from "lucide-react";
import { supabase, useAuth } from "@/features/auth/auth-provider";

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
    if (!supabase) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    setPending(true); setError(""); setNotice("");
    const result = isSignup
      ? await supabase.auth.signUp({ email, password, options: { data: { name: String(data.get("name") ?? "") } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (result.error) { setError(result.error.message); return; }
    if (!result.data.session) { setNotice("Check your inbox to confirm your email, then return here to sign in."); return; }
    router.replace(isSignup ? "/onboarding" : query.get("next") || "/admin");
  }

  return <main className="auth-page"><section className="auth-panel"><Link href="/" className="auth-brand"><span><Store size={17} /></span> Jelly Shop</Link><div className="auth-intro"><p>{isSignup ? "Start selling" : "Merchant sign in"}</p><h1>{isSignup ? "Make room for your next good idea." : "Welcome back to your shop."}</h1><div className="auth-orbit" aria-hidden="true"><i /><i /><i /></div></div>{!configured ? <div className="auth-message" role="alert"><strong>Authentication is not configured.</strong><p>Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable merchant access.</p></div> : <form className="auth-form" onSubmit={submit}>{isSignup && <label><span>Your name</span><input name="name" autoComplete="name" required /></label>}<label><span>Email</span><input name="email" type="email" autoComplete="email" required /></label><label><span>Password</span><input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={6} required /></label>{error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="auth-notice" role="status">{notice}</p>}<button className="auth-submit" disabled={pending} type="submit">{pending ? "Working…" : isSignup ? "Create account" : "Sign in"}<ArrowRight size={16} /></button></form>}<p className="auth-switch">{isSignup ? "Already have an account?" : "New to Jelly Shop?"} <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</Link></p></section></main>;
}
