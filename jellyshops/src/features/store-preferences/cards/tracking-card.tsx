"use client";

import { useEffect, useState } from "react";
import { Card, CardSkeleton } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { StorefrontAccessSettings } from "@/features/storefront-access/access-settings";
import type { PreferenceChange } from "../api";
import type { PreferencesForm } from "../use-preferences-form";

/** Pull an id out of whatever the owner pasted (a whole snippet, an address, or the id itself). */
export function extractTrackingId(kind: "ga" | "gtm" | "pixel", pasted: string): string {
  const value = pasted.trim();
  const pattern = kind === "ga" ? /\bG-[A-Z0-9]{4,12}\b/i : kind === "gtm" ? /\bGTM-[A-Z0-9]{4,10}\b/i : /(?:fbq\(\s*['"]init['"]\s*,\s*['"]|\bid=)?(\d{8,20})\b/;
  const match = pattern.exec(value);
  if (!match) return value;
  return kind === "pixel" ? match[1] ?? match[0] : match[0].toUpperCase();
}

export function PasswordCard() {
  const { activeStore, session } = useAuth();
  return <Card title="Store password" description="Keep your store private while you get it ready. This saves on its own.">
    <div id="password">
      {activeStore && session ? <StorefrontAccessSettings key={activeStore.id} storeId={activeStore.id} token={session.access_token} /> : <CardSkeleton label="Loading" />}
    </div>
  </Card>;
}

const SECTION_NAMES: Record<string, string> = { seo: "Search and sharing", business: "Business details", social: "Social media", policies: "Policies", tracking: "Tracking", privacy: "Cookie banner", spam: "Spam protection" };
const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function HistoryCard({ form, bare = false }: { form: PreferencesForm; bare?: boolean }) {
  const [changes, setChanges] = useState<PreferenceChange[] | null>(null);
  const [error, setError] = useState("");
  const revision = form.stored?.revision ?? 0;
  const { history } = form.api;
  useEffect(() => {
    let live = true;
    history().then((items) => { if (live) setChanges(items); }).catch((failure: unknown) => { if (live) setError(failure instanceof Error ? failure.message : "Could not load the history."); });
    return () => { live = false; };
  }, [history, revision]);
  const body = <div id="history">
      {error ? <p className="jk-muted">{error}</p> : !changes ? <CardSkeleton lines={2} label="Loading history" /> : !changes.length ? <p className="jk-muted">No changes saved yet.</p> :
        <ol className="jk-rows">{changes.slice(0, 10).map((change) => <li key={change.id} className="jk-rows-item">
          <span><span className="jk-strong">{change.actorName ?? "Someone"}</span> changed {change.sections.map((section) => SECTION_NAMES[section] ?? section).join(", ") || "settings"}</span>
          <time className="jk-muted" dateTime={change.at}>{change.at ? when.format(new Date(change.at)) : ""}</time>
        </li>)}</ol>}
    </div>;
  return bare ? body : <Card title="Change history" description="The last 50 saves on this page: who changed what, and when.">{body}</Card>;
}
