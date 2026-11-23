"use client";

import { useEffect, useState } from "react";
import { Banner, buttonClass } from "@/components/admin";
import Link from "@/features/admin/admin-routing";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { billingNotices, loadBillingSummary, type BillingNotice } from "./billing-summary";

/**
 * Billing notices above every page of a shop's admin: shop closed, payment failed, trial ending (only once billing is
 * enforced) and a plan limit nearly or fully reached. Shows nothing for people who can't see billing.
 */
export function BillingNotices() {
  const { activeStore, session } = useAuth();
  const [notices, setNotices] = useState<BillingNotice[]>([]);
  const storeId = activeStore?.id;
  const token = session?.access_token;

  useEffect(() => {
    if (!storeId || !token) return;
    let cancelled = false;
    loadBillingSummary(storeId, token).then((summary) => { if (!cancelled) setNotices(billingNotices(summary, new Date())); });
    return () => { cancelled = true; };
  }, [storeId, token]);

  if (!notices.length) return null;
  return <div className="jk-billing-notices">
    {notices.map((notice) => <Banner key={notice.title} tone={notice.tone} title={notice.title} action={<Link className={buttonClass("secondary", "small")} href="/admin/settings/billing">Plan and billing</Link>}>{notice.text}</Banner>)}
  </div>;
}
