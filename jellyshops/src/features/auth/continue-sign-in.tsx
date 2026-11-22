"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MerchantAuthShell } from "./components/auth-shell";
import styles from "./components/merchant-auth.module.css";
import { merchantReturnPath } from "./lib/auth-navigation";
import { merchantSupabase, supabaseConfigured } from "./lib/supabase-clients";

const expired = "This sign-in link has expired or was already used. Sign in again to open your dashboard.";

/** Reads `#token_hash=…&next=…` once and removes it from the address straight away. */
function takeHandoff(): { tokenHash: string; next: string } {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  return { tokenHash: hash.get("token_hash") ?? "", next: merchantReturnPath(hash.get("next")) };
}

/**
 * The admin host's end of the sign-in hand-off (see `lib/admin-handoff.ts`): exchanges the one-time token for this
 * site's own session, then opens the page the merchant was going to. The token is single use.
 */
export function ContinueSignIn({ go = (url: string) => window.location.replace(url) }: { go?: (url: string) => void }) {
  // Set when signing in failed: where the merchant was going, for the "Sign in" link.
  const [failed, setFailed] = useState<{ next: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const handoff = takeHandoff();
    void (async () => {
      try {
        const client = supabaseConfigured ? await merchantSupabase() : null;
        if (!client || !handoff.tokenHash) throw new Error("nothing to sign in with");
        const result = await client.auth.verifyOtp({ token_hash: handoff.tokenHash, type: "email" });
        if (result.error || !result.data.session) throw result.error ?? new Error("no session");
        go(handoff.next);
      } catch {
        setFailed({ next: handoff.next });
      }
    })();
  }, [go]);

  return (
    <MerchantAuthShell title={failed ? "Sign in to your dashboard" : "Opening your dashboard"} subtitle={failed ? expired : "Signing you in…"}>
      {failed && <p className={styles.switch}><Link className={styles.textLink} href={`/login?next=${encodeURIComponent(failed.next)}`}>Sign in</Link></p>}
    </MerchantAuthShell>
  );
}
