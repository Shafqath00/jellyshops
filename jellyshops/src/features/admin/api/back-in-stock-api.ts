"use client";

import { useEffect, useState } from "react";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";

/** How many shoppers wait for each sold-out variant of the active store; empty until loaded or if it fails. */
export function useBackInStockWaiting(revision = 0): Record<string, number> {
  const { activeStore, session } = useAuth();
  const storeId = activeStore?.id, token = session?.access_token;
  const [state, setState] = useState<{ key: string; counts: Record<string, number> }>({ key: "", counts: {} });
  const key = `${storeId}:${revision}`;
  useEffect(() => {
    if (!storeId || !token) return;
    let active = true;
    fetch(`${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/back-in-stock`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : { variants: [] })
      .then((body: { variants?: Array<{ variantId: string; waiting: number }> }) => { if (active) setState({ key, counts: Object.fromEntries((body.variants ?? []).map((row) => [row.variantId, row.waiting])) }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [storeId, token, key]);
  return state.key === key ? state.counts : {};
}
