"use client";

import { useEffect, useState } from "react";
import { Banner, Card, CardSkeleton } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { StorefrontAccessSettings } from "@/features/storefront-access/access-settings";
import { PREFERENCE_LIMITS } from "@jelly/storefront-schema";
import { PrefCheck, PrefSelect, PrefText, valueAt } from "../fields";
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

function TrackingField({ form, path, kind, label, tip, example, where }: { form: PreferencesForm; path: string; kind: "ga" | "gtm" | "pixel"; label: string; tip: string; example: string; where: string }) {
  return <div onPaste={(event) => {
    const target = event.target as HTMLInputElement;
    if (target.tagName !== "INPUT") return;
    const pasted = event.clipboardData.getData("text");
    const id = extractTrackingId(kind, pasted);
    if (id !== pasted.trim()) { event.preventDefault(); form.set(path, id); }
  }}>
    <PrefText form={form} path={path} label={label} tip={tip} help={where} example={example} />
  </div>;
}

export function TrackingCard({ form }: { form: PreferencesForm }) {
  const any = ["googleAnalyticsId", "googleTagManagerId", "metaPixelId"].some((key) => valueAt<string>(form, `tracking.${key}`));
  const banner = valueAt<string>(form, "privacy.cookieBanner");
  return <Card title="Tracking and analytics" description="Connect Google and Meta to see how shoppers find and use your store. Paste an ID: we add the code for you.">
    <div className="jk-stack-sm" id="tracking">
      <TrackingField form={form} path="tracking.googleAnalyticsId" kind="ga" label="Google Analytics 4 measurement ID" example="G-AB12CD34EF"
        tip="In Google Analytics, open Admin › Data streams › your web stream. The measurement ID starts with G-."
        where="Shows visits, traffic sources and sales in Google Analytics." />
      <TrackingField form={form} path="tracking.googleTagManagerId" kind="gtm" label="Google Tag Manager container ID" example="GTM-AB12CD3"
        tip="In Google Tag Manager, the container ID is at the top of your workspace and starts with GTM-."
        where="For advanced set-ups. If you use Tag Manager for Analytics, you don't need the Analytics ID above too." />
      <TrackingField form={form} path="tracking.metaPixelId" kind="pixel" label="Meta Pixel ID" example="123456789012345"
        tip="In Meta Events Manager, open Data sources and choose your pixel. The ID is a long number."
        where="Measures results from Facebook and Instagram ads." />
      <p className="jk-muted">You can paste the whole snippet from Google or Meta: we keep only the ID. For safety, we never add code you paste yourself.</p>
      {any && banner === "off" && <Banner tone="warning" title="Check your cookie banner">These tools set cookies. In the UK, EU and many other places you need shoppers&apos; consent first. Turn the cookie banner on below, or make sure you have another way to ask.</Banner>}
      {any && banner !== "off" && <Banner tone="info">These tools load only after a shopper accepts cookies in the cookie banner (where consent is required).</Banner>}
    </div>
  </Card>;
}

export function PrivacyCard({ form }: { form: PreferencesForm }) {
  return <Card title="Customer privacy" description="How your store asks shoppers before using cookies for analytics and ads.">
    <div className="jk-stack-sm" id="privacy">
      <PrefSelect form={form} path="privacy.cookieBanner" label="Cookie banner"
        tip="Cookies the store needs to work (your bag, sign-in) never need consent. Analytics and ad cookies do in many countries."
        options={[
          { value: "required-regions", label: "Show where the law requires it (UK, EU and similar) · Recommended" },
          { value: "everywhere", label: "Show to every shopper" },
          { value: "off", label: "Don't show a cookie banner" },
        ]}
        help="Shoppers can accept or reject. Tracking tools wait for their answer." />
      <PrefText form={form} path="privacy.cookieMessage" label="Banner message" multiline max={PREFERENCE_LIMITS.cookieMessage}
        placeholder="We use cookies to improve your experience and measure our marketing. You can accept or reject non-essential cookies."
        tip="Leave it empty to use the standard message. A link to your privacy policy is added automatically." />
    </div>
  </Card>;
}

export function SpamCard({ form }: { form: PreferencesForm }) {
  return <Card title="Spam protection" description="Stops bots filling in your store's forms. Shoppers don't see puzzles: checks run quietly in the background.">
    <div className="jk-stack-sm" id="spam">
      <p className="jk-muted">Every form already has hidden bot traps and limits on how often it can be sent. The choices below add an extra invisible check (Cloudflare Turnstile) once it is switched on for Jellyshop.</p>
      <PrefCheck form={form} path="spam.contactForm" label="Contact form" help="Blocks automated messages to your inbox." />
      <PrefCheck form={form} path="spam.newsletter" label="Email sign-up forms" help="Stops fake addresses joining your mailing list." />
      <PrefCheck form={form} path="spam.accountForms" label="Sign-in, create account and password reset" help="Slows down attempts to guess passwords or create fake accounts." />
    </div>
  </Card>;
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
