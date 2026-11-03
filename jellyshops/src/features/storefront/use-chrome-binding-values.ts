"use client";

import { useEffect, useMemo, useState } from "react";
import type { RuntimeStorefrontSnapshotV4, RuntimeTemplateV4 } from "@jelly/storefront-schema";
import { loadPublicBindingValues, type BindingValueLoader, type BindingValuesRequest } from "./binding-values-api";
import { applyBindingValues, bindingKey, collectLayoutBindings, type BindingValues } from "./dynamic-settings";
import { expandRawRuntimeLayout, type ResolvedStorefrontLayout } from "./resource-loader";

const empty: BindingValues = new Map();

/**
 * The header, announcement and footer of a page with their custom-field values
 * filled in (store fields, or the product or collection being shown). They show
 * each setting's fallback until the values arrive, or if the lookup fails.
 */
export function useChromeBindingValues(
  snapshot: RuntimeStorefrontSnapshotV4 | null,
  template: RuntimeTemplateV4 | undefined,
  resource?: BindingValuesRequest["resource"],
  loadValues: BindingValueLoader = loadPublicBindingValues,
): ResolvedStorefrontLayout | null {
  const raw = useMemo(() => snapshot && template ? expandRawRuntimeLayout(snapshot, template) : null, [snapshot, template]);
  // Only the shared regions: the page body is resolved by resolveStorefrontRoute.
  const bindings = useMemo(() => raw ? collectLayoutBindings({ announcement: raw.announcement, header: raw.header, footer: raw.footer }) : [], [raw]);
  const requestKey = `${snapshot?.storeId ?? ""}|${resource?.type ?? ""}:${resource?.id ?? ""}|${bindings.map(bindingKey).join(",")}`;
  const [loaded, setLoaded] = useState<{ key: string; values: BindingValues } | null>(null);
  useEffect(() => {
    if (!snapshot || !bindings.length) return;
    let active = true;
    loadValues({ storeId: snapshot.storeId, bindings, ...(resource ? { resource } : {}) })
      .then((values) => { if (active) setLoaded({ key: requestKey, values }); })
      .catch(() => { if (active) setLoaded({ key: requestKey, values: empty }); });
    return () => { active = false; };
    // requestKey covers the store, resource and bindings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, loadValues]);
  return useMemo(() => raw ? applyBindingValues(raw, loaded?.key === requestKey ? loaded.values : empty, snapshot?.theme.version) : null, [raw, loaded, requestKey, snapshot?.theme.version]);
}
