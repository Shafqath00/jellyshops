"use client";

import { useEffect, useState } from "react";
import { storeUrl } from "@jelly/storefront-schema";
import styles from "@/features/auth/components/merchant-auth.module.css";

/**
 * Closed shops whose data is kept for a while before a person may delete it (backend `GET /api/platform/retention`,
 * docs/plans/2026-11-25-billing-trial-limits.md step 5). Nothing here deletes anything: it only says which shops
 * have been warned and which have reached their deletion date.
 */
export type ClosedShop = {
  storeId: string; name: string; slug: string; ownerEmail: string | null; status: string;
  closedSince: string; warnedAt: string | null; deleteFrom: string | null; due: boolean;
};
export type ClosedShopsResult = { status: number; body: { shops?: ClosedShop[]; retentionDays?: number; warningDays?: number; error?: { message?: string } } };

const day = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const WHY: Record<string, string> = { expired: "Trial ended", past_due: "Payment failed", canceled: "Cancelled", paused: "Paused", trialing: "Trial ended" };

function stateText(shop: ClosedShop): string {
  if (shop.due) return `Can be deleted (since ${day(shop.deleteFrom!)})`;
  if (shop.deleteFrom) return `Warned ${day(shop.warnedAt!)}; can be deleted from ${day(shop.deleteFrom)}`;
  return "Not warned yet (billing not enforced, or no email sender)";
}

export function ClosedShops({ load }: { load: () => Promise<ClosedShopsResult> }) {
  const [result, setResult] = useState<ClosedShopsResult | null>(null);
  useEffect(() => {
    let active = true;
    void load().then((value) => { if (active) setResult(value); });
    return () => { active = false; };
  }, [load]);

  if (!result) return null;
  if (result.status !== 200) return <p role="alert" className={styles.alert}>{result.body.error?.message ?? "Could not load closed shops."}</p>;
  const shops = result.body.shops ?? [];
  if (shops.length === 0) return null;
  const due = shops.filter((shop) => shop.due).length;
  return <section aria-labelledby="closed-shops-title" style={{ marginBottom: 32 }}>
    <h2 id="closed-shops-title" style={{ marginBottom: 4 }}>Closed shops</h2>
    <p style={{ marginTop: 0 }}>
      We keep a closed shop for {result.body.retentionDays ?? 90} days and warn the owner {result.body.warningDays ?? 14} days before it can be deleted.
      {" "}{due === 0 ? "None can be deleted yet." : `${due} ${due === 1 ? "shop can" : "shops can"} be deleted.`} Deleting is done by hand; nothing is deleted automatically.
    </p>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <caption className="sr-only">Closed shops, longest closed first</caption>
        <thead><tr>{["Shop", "Owner", "Why", "Closed since", "Deletion"].map((label) => <th key={label} scope="col" style={{ textAlign: "left", padding: "8px 12px" }}>{label}</th>)}</tr></thead>
        <tbody>{shops.map((shop) => <tr key={shop.storeId} style={{ borderTop: "1px solid color-mix(in srgb, currentColor 15%, transparent)" }}>
          <td style={{ padding: "8px 12px" }}>{shop.name} <a className={styles.inlineLink} href={storeUrl(shop.slug)} target="_blank" rel="noreferrer">{shop.slug}</a></td>
          <td style={{ padding: "8px 12px" }}>{shop.ownerEmail ?? "None"}</td>
          <td style={{ padding: "8px 12px" }}>{WHY[shop.status] ?? shop.status}</td>
          <td style={{ padding: "8px 12px" }}>{day(shop.closedSince)}</td>
          <td style={{ padding: "8px 12px", fontWeight: shop.due ? 600 : undefined }}>{stateText(shop)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
