"use client";
import { useEffect, useState } from "react";
import { customerApiOrigin } from "./customer-provider";

export function NewsletterUnsubscribe({ storeId, token }: { storeId: string; token: string }) {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  useEffect(() => {
    let active = true;
    void fetch(`${customerApiOrigin()}/api/public/stores/${encodeURIComponent(storeId)}/engagement/newsletter/unsubscribe`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((response) => { if (!response.ok) throw new Error(); if (active) setState("done"); })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [storeId, token]);
  return <section className="signature-panel"><h1>{state === "loading" ? "Updating your preferences…" : state === "done" ? "You’re unsubscribed" : "This link couldn’t be used"}</h1><p>{state === "done" ? "You won’t receive further newsletter updates from this store." : state === "error" ? "Please contact the store if you need help with your subscription." : "Please wait a moment."}</p></section>;
}
