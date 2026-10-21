"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { createMerchantCommerceApi } from "../api/client";
import type { StripeMerchantStatus } from "../api/types";

const API_URL =
  process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

interface MerchantPaymentsPanelProps {
  redirect?: (url: string) => void;
}

function getDueRequirements(
  requirements?: Record<string, unknown>
): string[] {
  if (!requirements) return [];

  const nested = requirements.requirements;
  const source =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : requirements;

  return Array.isArray(source.currently_due)
    ? source.currently_due.filter(
        (item): item is string => typeof item === "string"
      )
    : [];
}

function label(value?: string | null) {
  if (!value) return "Unknown";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function requirementLabel(value: string) {
  return value
    .replaceAll(".", " · ")
    .replaceAll("_", " ");
}

function StatusTile({
  title,
  value,
}: {
  title: string;
  value?: string | null;
}) {
  const active = value === "active";

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-muted/50 p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground">
        {title}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={`size-2 rounded-full ${
            active ? "bg-success/15" : "bg-[var(--warn-bg)]"
          }`}
        />
        <p className="text-[13px] font-black text-foreground">
          {label(value)}
        </p>
      </div>
    </div>
  );
}

export function MerchantPaymentsPanel({
  redirect = (url) => window.location.assign(url),
}: MerchantPaymentsPanelProps) {
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id;
  const token = session?.access_token;

  const api = useMemo(() => {
    if (!storeId || !token) return null;

    return createMerchantCommerceApi({
      baseUrl: API_URL,
      token,
    });
  }, [storeId, token]);

  const [status, setStatus] = useState<StripeMerchantStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!api || !storeId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await api.getStripeStatus(storeId);

        if (!cancelled) {
          setStatus(result);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load Stripe status"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, [api, storeId]);

  async function openStripeOnboarding() {
    if (!api || !storeId) return;

    setOpening(true);
    setError("");

    try {
      const currentUrl = window.location.href;
      const { url } = await api.createOnboardingLink(storeId, {
        returnUrl: currentUrl,
        refreshUrl: currentUrl,
      });

      redirect(url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to start Stripe onboarding"
      );
      setOpening(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <div className="flex items-center gap-2.5 text-[12px] font-bold text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Loading payment status…
        </div>
      </div>
    );
  }

  if (!api) {
    return (
      <div className="p-2">
        <h2 className="text-[15px] font-black text-foreground">
          Payments unavailable
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
          Sign in as a merchant to manage Stripe payments.
        </p>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-tint-border bg-muted/50 p-4 text-[12px] font-semibold text-tint-foreground"
      >
        {error}
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="p-2">
        <span className="grid size-11 place-items-center rounded-2xl bg-muted text-tint-foreground">
          <ExternalLink size={18} strokeWidth={1.8} />
        </span>

        <h2 className="mt-4 text-[17px] font-black tracking-[-0.025em] text-foreground">
          Connect Stripe
        </h2>

        <p className="mt-2 max-w-md text-[12px] leading-5 text-muted-foreground">
          Complete Stripe onboarding before customers can make payments and
          payouts can begin.
        </p>

        <button
          type="button"
          onClick={openStripeOnboarding}
          disabled={opening}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-[11px] font-black text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary disabled:pointer-events-none disabled:opacity-60"
        >
          {opening ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ExternalLink size={14} />
          )}
          {opening ? "Opening Stripe…" : "Start onboarding"}
        </button>
      </div>
    );
  }

  if (status.closed) {
    return (
      <div className="rounded-2xl border border-tint-border bg-muted/50 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-tint-foreground">
            <AlertCircle size={18} />
          </span>

          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-tint-foreground">
              Stripe account
            </p>
            <h2 className="mt-1 text-[15px] font-black text-foreground">
              Payments unavailable
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-tint-foreground">
              This Stripe account is closed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const requirements = getDueRequirements(status.requirements);
  const cardsActive = status.cardPaymentsStatus === "active";

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-tint-border bg-muted/50 p-4 text-[12px] font-semibold text-tint-foreground"
        >
          {error}
        </div>
      )}

      <section className="rounded-[18px] border border-black/[0.06] bg-card p-1">
        <div className="flex items-start justify-between gap-4 p-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-tint-foreground">
              Stripe account
            </p>
            <h2 className="mt-1 text-[16px] font-black tracking-[-0.025em] text-foreground">
              Payment readiness
            </h2>
          </div>

          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${
              status.checkoutReady
                ? "bg-[var(--warn-bg)] text-success"
                : "bg-[var(--warn-bg)] text-[var(--warn-fg)]"
            }`}
          >
            {status.checkoutReady ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
          </span>
        </div>

        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
          <StatusTile
            title="Card payments"
            value={status.cardPaymentsStatus}
          />
          <StatusTile title="Payouts" value={status.payoutsStatus} />
        </div>

        {requirements.length > 0 && (
          <div className="border-t border-black/[0.06] px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">
              Still required
            </p>

            <ul className="mt-3 space-y-2">
              {requirements.map((requirement) => (
                <li
                  key={requirement}
                  className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--warn-bg)]" />
                  <span>{requirementLabel(requirement)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-black/[0.06] px-4 py-4">
          {cardsActive ? (
            <div className="flex items-start gap-2.5 text-[11px] leading-5 text-success">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              <p>
                Customers can pay. Stripe manages payment processing and
                payouts for this connected account.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[11px] leading-5 text-muted-foreground">
                Card payments are not active yet. Finish the remaining Stripe
                requirements to start accepting payments.
              </p>

              <button
                type="button"
                onClick={openStripeOnboarding}
                disabled={opening}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3.5 text-[10px] font-black text-primary-foreground transition hover:bg-primary disabled:pointer-events-none disabled:opacity-60"
              >
                {opening ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ExternalLink size={13} />
                )}
                {opening ? "Opening Stripe…" : "Continue onboarding"}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[18px] border border-black/[0.06] bg-muted/50 p-5">
        <h2 className="text-[14px] font-black text-foreground">
          Stripe Dashboard
        </h2>

        <p className="mt-2 max-w-xl text-[11px] leading-5 text-muted-foreground">
          Manage verification, payouts, disputes, and Stripe reporting from
          the connected account dashboard.
        </p>

        {status.dashboardUrl && (
          <a
            href={status.dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-black/[0.08] bg-card px-3.5 text-[10px] font-black text-foreground transition hover:bg-muted/50"
          >
            Open Stripe Dashboard
            <ExternalLink size={13} />
          </a>
        )}
      </section>
    </div>
  );
}
