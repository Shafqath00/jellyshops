import { authApiOrigin } from "@/features/auth/providers/auth-provider";

/** `GET /api/stores/:storeId/billing` (backend/src/billing/routes.ts). */
export interface BillingSummary {
  status: "trialing" | "active" | "past_due" | "paused" | "canceled" | "exempt" | "none";
  plan: string;
  planName: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  pauseReason: "trial-ended" | "payment-stopped" | "canceled" | null;
  paused: boolean;
  exempt: boolean;
  /** Whether shops are closed when their plan ends (BILLING_ENFORCED); off until shops can pay. */
  enforced: boolean;
  /** Whether paying is set up on the server (Stripe Billing). */
  checkoutAvailable?: boolean;
  /** Whether the shop has a Stripe subscription it can manage. */
  hasSubscription?: boolean;
  /** Whether a yearly price can be chosen as well as monthly. */
  annualAvailable?: boolean;
  usage: Array<{ kind: "products" | "photoBytes" | "files"; used: number; limit: number | null }>;
}

const cache = new Map<string, { at: number; value: Promise<BillingSummary | null> }>();
const CACHE_MS = 60_000;

/**
 * The shop's plan and usage. Null when the person can't see billing (staff without settings access) or the backend
 * has no billing yet; banners then show nothing. Kept for a minute so moving between admin pages doesn't refetch.
 */
export function loadBillingSummary(storeId: string, token: string, fetcher: typeof fetch = fetch, fresh = false): Promise<BillingSummary | null> {
  const key = `${storeId}:${token}`;
  const known = cache.get(key);
  if (!fresh && known && Date.now() - known.at < CACHE_MS) return known.value;
  const value = fetcher(`${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/billing`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async (response) => (response.ok ? (await response.json()) as BillingSummary : null))
    .catch(() => null);
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** For tests: forget cached summaries. */
export function resetBillingCache() { cache.clear(); }

const DAY = 24 * 60 * 60 * 1000;

/** Whole days left in the trial, rounded up (a trial ending later today has 1 day left); 0 once it has ended. */
export function trialDaysLeft(summary: Pick<BillingSummary, "trialEndsAt">, now: Date): number | null {
  if (!summary.trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(summary.trialEndsAt).getTime() - now.getTime()) / DAY));
}

export function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Bytes as people read them: "9.8 GB", "750 MB". Same rules as the backend's limit messages. */
export function formatBytes(bytes: number): string {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return unit === 0 ? `${value} bytes` : `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}

const number = new Intl.NumberFormat("en-GB");

/** "74 of 5,000 products", "72 MB of 10 GB", or without a limit for shops that have none. */
export function usageText(item: BillingSummary["usage"][number]): string {
  const amount = (value: number) => (item.kind === "photoBytes" ? formatBytes(value) : number.format(value));
  const noun = item.kind === "products" ? (item.used === 1 && item.limit === null ? " product" : " products") : item.kind === "files" ? (item.used === 1 && item.limit === null ? " file" : " files") : "";
  if (item.limit === null) return `${amount(item.used)}${noun}, no limit on this shop`;
  return `${amount(item.used)} of ${amount(item.limit)}${noun}`;
}

export const usageLabel = (kind: BillingSummary["usage"][number]["kind"]) => (kind === "products" ? "Products" : kind === "files" ? "Files" : "Photo storage");

export interface BillingNotice {
  tone: "critical" | "warning" | "info";
  title: string;
  text: string;
}

/** Share of a limit at which the admin starts warning. */
export const NEARLY_FULL = 0.8;

/**
 * What the admin should tell the owner on every page, most urgent first. Nothing while billing is not enforced
 * except limits (which are), so testers never see trial warnings that would not happen.
 */
export function billingNotices(summary: BillingSummary | null, now: Date): BillingNotice[] {
  if (!summary) return [];
  const notices: BillingNotice[] = [];
  if (summary.paused) {
    notices.push({
      tone: "critical",
      title: "Your shop is closed to shoppers",
      text: summary.pauseReason === "trial-ended"
        ? "Your free trial has ended. Choose a plan to open your shop again; nothing has been deleted."
        : "Your plan has ended. Choose a plan to open your shop again; nothing has been deleted.",
    });
  } else if (summary.enforced && summary.status === "past_due") {
    notices.push({ tone: "warning", title: "We couldn't take your last payment", text: "Update your payment details so your shop stays open." });
  } else if (summary.enforced && summary.status === "trialing") {
    const days = trialDaysLeft(summary, now);
    if (days !== null && days <= 7) {
      notices.push({ tone: "info", title: `${days} ${days === 1 ? "day" : "days"} left in your free trial`, text: "Choose a plan to keep your shop open after the trial." });
    }
  }
  for (const item of summary.usage) {
    if (item.limit === null || item.limit === 0) continue;
    const share = item.used / item.limit;
    if (share >= 1) notices.push({ tone: "critical", title: `${usageLabel(item.kind)} is full`, text: `${usageText(item)}. ${item.kind === "products" ? "Archive products you no longer sell" : item.kind === "files" ? "Delete files you no longer use" : "Delete photos you no longer use"} to add more.` });
    else if (share >= NEARLY_FULL) notices.push({ tone: "warning", title: `${usageLabel(item.kind)} is nearly full`, text: `${usageText(item)} used.` });
  }
  return notices;
}

/** Starts paying (Stripe Checkout) or opens Stripe's billing portal; resolves to the Stripe page to open. */
export type BillingInterval = "month" | "year";

/** The plan's prices as merchants see them; they must match the Stripe prices (STRIPE_BILLING_PRICE_ID / _ANNUAL_). */
export const PLAN_PRICES: Record<BillingInterval, { label: string; price: string; note?: string }> = {
  month: { label: "Monthly", price: "£15 a month" },
  year: { label: "Yearly", price: "£150 a year", note: "2 months free" },
};

export async function openBillingPage(kind: "checkout" | "portal", storeId: string, token: string, returnUrl: string, fetcher: typeof fetch = fetch, interval?: BillingInterval): Promise<string> {
  const response = await fetcher(`${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/billing/${kind}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(interval ? { returnUrl, interval } : { returnUrl }),
  });
  const body = await response.json().catch(() => ({})) as { url?: string; error?: { message?: string } };
  if (!response.ok || !body.url) throw new Error(body.error?.message ?? "Stripe couldn't be opened. Try again in a moment.");
  return body.url;
}
