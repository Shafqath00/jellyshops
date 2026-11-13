"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { merchantSupabase, supabaseConfigured } from "./lib/supabase-clients";

export function MerchantAuthCallback({ code, nextPath }: { code: string; nextPath: string }) {
  const router = useRouter(); const [error, setError] = useState("");
  const confirmationError = !supabaseConfigured || !code ? "This confirmation link is incomplete or expired. Please sign in and request a new link." : error;
  useEffect(() => {
    let active = true;
    if (!supabaseConfigured || !code) return () => { active = false; };
    void merchantSupabase().then(async (supabase) => supabase ? (await supabase.auth.exchangeCodeForSession(code)).error : new Error("Sign-in is not set up.")).then((exchangeError) => {
      if (!active) return;
      if (exchangeError) { setError("This confirmation link has expired or was already used. Please sign in and request a new link."); return; }
      const target = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/admin";
      router.replace(target);
    });
    return () => { active = false; };
  }, [code, nextPath, router]);
  return <main className="grid min-h-dvh place-items-center p-6 text-center"><div><h1 className="text-2xl font-semibold">{confirmationError ? "We couldn’t confirm that link" : "Confirming your account…"}</h1>{confirmationError && <><p className="mt-3 max-w-md text-sm">{confirmationError}</p><Link className="mt-5 inline-block underline" href="/login">Return to sign in</Link></>}</div></main>;
}
