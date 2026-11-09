"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { Banner, Card, CardSkeleton, EmptyState, StatusBadge } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
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

function StatusTile({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="jk-metric">
      <span className="jk-muted">{title}</span>
      <span><StatusBadge tone={value === "active" ? "success" : "warning"}>{label(value)}</StatusBadge></span>
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
    return <CardSkeleton lines={4} label="Loading payment status" />;
  }

  if (!api) {
    return <Banner tone="warning" title="Payments unavailable">Sign in as a merchant to manage Stripe payments.</Banner>;
  }

  if (error && !status) {
    return <Banner tone="critical" title="Payment status did not load">{error}</Banner>;
  }

  if (!status?.connected) {
    return (
      <Card>
        <EmptyState
          icon={CreditCard}
          title="Connect Stripe"
          description="Complete Stripe onboarding before customers can make payments and payouts can begin."
          action={<button type="button" onClick={openStripeOnboarding} disabled={opening} className="jk-button jk-button-primary">
            {opening ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ExternalLink size={14} aria-hidden="true" />}
            {opening ? "Opening Stripe…" : "Start onboarding"}
          </button>}
        />
      </Card>
    );
  }

  if (status.closed) {
    return <Banner tone="critical" title="Payments unavailable">This Stripe account is closed.</Banner>;
  }

  const requirements = getDueRequirements(status.requirements);
  const cardsActive = status.cardPaymentsStatus === "active";

  return (
    <div className="jk-form">
      {error && <Banner tone="critical">{error}</Banner>}

      <Card
        title="Payment readiness"
        description="Your Stripe account, which takes card payments and sends payouts."
        actions={<StatusBadge tone={status.checkoutReady ? "success" : "warning"}>{status.checkoutReady ? "Ready for checkout" : "Not ready yet"}</StatusBadge>}
      >
        <div className="jk-stack-sm">
          <div className="jk-grid-2">
            <StatusTile title="Card payments" value={status.cardPaymentsStatus} />
            <StatusTile title="Payouts" value={status.payoutsStatus} />
          </div>

          {requirements.length > 0 && (
            <div>
              <h3 className="jk-subheading">Still required</h3>
              <ul className="jk-bullets">
                {requirements.map((requirement) => <li key={requirement}>{requirementLabel(requirement)}</li>)}
              </ul>
            </div>
          )}

          {cardsActive ? (
            <Banner tone="success">Customers can pay. Stripe manages payment processing and payouts for this connected account.</Banner>
          ) : (
            <Banner tone="warning" action={<button type="button" onClick={openStripeOnboarding} disabled={opening} className="jk-button">
              {opening ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <ExternalLink size={13} aria-hidden="true" />}
              {opening ? "Opening Stripe…" : "Continue onboarding"}
            </button>}>
              Card payments are not active yet. Finish the remaining Stripe requirements to start accepting payments.
            </Banner>
          )}
        </div>
      </Card>

      <Card
        title="Stripe Dashboard"
        description="Manage verification, payouts, disputes, and Stripe reporting from the connected account dashboard."
        actions={status.dashboardUrl ? <a href={status.dashboardUrl} target="_blank" rel="noreferrer" className="jk-button">Open Stripe Dashboard<ExternalLink size={13} aria-hidden="true" /></a> : undefined}
      >
        <p className="jk-muted">{status.dashboardUrl ? "The dashboard opens in a new tab." : "The dashboard link appears here once Stripe provides it."}</p>
      </Card>
    </div>
  );
}
