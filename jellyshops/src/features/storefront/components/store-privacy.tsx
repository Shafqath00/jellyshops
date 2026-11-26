"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GA_ID, GTM_ID, PIXEL_ID, type CookieBannerMode } from "@jelly/storefront-schema";

/**
 * The shopper's cookie choice and the merchant's tracking tools (Settings > Store preferences > Tracking and Customer
 * privacy). Nothing from Google or Meta loads until the choice allows it; where the law doesn't ask for consent (or the
 * banner is off) the tools load straight away. Only IDs in their exact shape ever reach a script address.
 */
export interface StoreTracking { googleAnalyticsId: string; googleTagManagerId: string; metaPixelId: string }
export type ConsentChoice = "accepted" | "rejected";

const STORAGE = (storeId: string) => `jelly-consent:${storeId}`;
export const OPEN_COOKIE_SETTINGS = "jelly:cookie-settings";

export function readConsent(storeId: string): ConsentChoice | null {
  try {
    const raw = window.localStorage.getItem(STORAGE(storeId));
    const parsed = raw ? JSON.parse(raw) as { choice?: unknown } : null;
    return parsed?.choice === "accepted" || parsed?.choice === "rejected" ? parsed.choice : null;
  } catch { return null; }
}
function saveConsent(storeId: string, choice: ConsentChoice) {
  try { window.localStorage.setItem(STORAGE(storeId), JSON.stringify({ choice, at: new Date().toISOString() })); } catch { /* private mode: the choice lasts for this visit */ }
}

/** Only tracking IDs in their exact shape are used. */
export function safeTracking(tracking: StoreTracking): StoreTracking {
  return {
    googleAnalyticsId: GA_ID.test(tracking.googleAnalyticsId) ? tracking.googleAnalyticsId : "",
    googleTagManagerId: GTM_ID.test(tracking.googleTagManagerId) ? tracking.googleTagManagerId : "",
    metaPixelId: PIXEL_ID.test(tracking.metaPixelId) ? tracking.metaPixelId : "",
  };
}
export const hasTracking = (tracking: StoreTracking) => Boolean(tracking.googleAnalyticsId || tracking.googleTagManagerId || tracking.metaPixelId);

type TrackingWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...args: unknown[]) => void; push?: unknown } ; _fbq?: unknown };

function addScript(src: string, id: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id; script.async = true; script.src = src;
  document.head.appendChild(script);
}

/** Starts the tools. Each helper is safe to call twice. */
export function startTracking(tracking: StoreTracking) {
  const w = window as TrackingWindow;
  const safe = safeTracking(tracking);
  if (safe.googleAnalyticsId || safe.googleTagManagerId) {
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = w.gtag ?? function gtag() { w.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
  }
  if (safe.googleAnalyticsId && !document.getElementById("jelly-ga")) {
    w.gtag!("js", new Date());
    w.gtag!("config", safe.googleAnalyticsId, { anonymize_ip: true });
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(safe.googleAnalyticsId)}`, "jelly-ga");
  }
  if (safe.googleTagManagerId && !document.getElementById("jelly-gtm")) {
    w.dataLayer!.push({ "gtm.start": Date.now(), event: "gtm.js" });
    addScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(safe.googleTagManagerId)}`, "jelly-gtm");
  }
  if (safe.metaPixelId && !document.getElementById("jelly-pixel")) {
    if (!w.fbq) {
      const fbq = function (...args: unknown[]) { if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue!.push(args); } as NonNullable<TrackingWindow["fbq"]>;
      fbq.queue = []; fbq.loaded = true; fbq.version = "2.0"; fbq.push = fbq;
      w.fbq = fbq; w._fbq = fbq;
    }
    w.fbq("init", safe.metaPixelId);
    w.fbq("track", "PageView");
    addScript("https://connect.facebook.net/en_US/fbevents.js", "jelly-pixel");
  }
}

/** Tells the tools about a page change in the browser (the first page is counted when they start). */
function trackPageView(tracking: StoreTracking) {
  const w = window as TrackingWindow;
  const safe = safeTracking(tracking);
  if (safe.googleAnalyticsId && w.gtag) w.gtag("event", "page_view", { page_location: window.location.href, page_title: document.title });
  if (safe.metaPixelId && w.fbq) w.fbq("track", "PageView");
}

async function consentRequiredHere(): Promise<boolean> {
  try {
    const response = await fetch("/api/storefront-geo", { cache: "no-store" });
    const body = await response.json() as { consentRequired?: unknown };
    return body.consentRequired !== false;
  } catch { return true; }
}

const DEFAULT_MESSAGE = "We use cookies to improve your experience and measure our marketing. You can accept or reject non-essential cookies.";

export function StorePrivacy({ storeId, mode, message, tracking, privacyHref }: { storeId: string; mode: CookieBannerMode; message: string; tracking: StoreTracking; privacyHref: string | null }) {
  const [askNow, setAskNow] = useState(false);
  const started = useRef(false);
  const pathname = usePathname();
  const firstPath = useRef(pathname);
  const tools = hasTracking(safeTracking(tracking));

  const start = useCallback(() => { if (tools) { startTracking(tracking); started.current = true; } }, [tools, tracking]);

  // Work out on load whether to ask, start straight away, or do nothing. A store with no tracking tools sets no
  // cookies that need consent, so shoppers aren't asked anything.
  useEffect(() => {
    let live = true;
    if (!tools) return;
    const choice = readConsent(storeId);
    if (choice === "accepted") { start(); return; }
    if (choice === "rejected") return;
    if (mode === "off") { start(); return; }
    const decide = mode === "everywhere" ? Promise.resolve(true) : consentRequiredHere();
    void decide.then((required) => {
      if (!live) return;
      if (required) setAskNow(true); else start();
    });
    return () => { live = false; };
  }, [storeId, mode, start, tools]);

  // "Cookie settings" links anywhere on the page reopen the banner.
  useEffect(() => {
    const open = () => setAskNow(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, open);
  }, []);

  useEffect(() => {
    if (!started.current || pathname === firstPath.current) return;
    firstPath.current = pathname;
    trackPageView(tracking);
  }, [pathname, tracking]);

  if (!askNow || mode === "off" || !tools) return null;
  const choose = (choice: ConsentChoice) => {
    saveConsent(storeId, choice);
    setAskNow(false);
    if (choice === "accepted") start();
    // Rejecting after accepting: scripts already running stay until the next page load, which then skips them.
  };
  return <section className="jelly-cookie-banner" role="region" aria-label="Cookie choices">
    <p>{message || DEFAULT_MESSAGE}{privacyHref && <> <Link href={privacyHref}>Privacy policy</Link></>}</p>
    <div className="jelly-cookie-banner-actions">
      <button type="button" className="jelly-button jelly-button--secondary" onClick={() => choose("rejected")}>Reject</button>
      <button type="button" className="jelly-button" onClick={() => choose("accepted")}>Accept</button>
    </div>
  </section>;
}

/** A link that reopens the cookie banner (for footers and policy pages). */
export function CookieSettingsLink({ className }: { className?: string }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))}>Cookie settings</button>;
}
