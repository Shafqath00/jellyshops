"use client";

import { useEffect, useMemo, useState } from "react";
import type { SectionNode } from "@jelly/storefront-schema";
import { createBindingValueLoader, type BindingValuesRequest } from "@/features/storefront/binding-values-api";
import { applyBindingValues, bindingKey, collectLayoutBindings, type BindingValues } from "@/features/storefront/dynamic-settings";

type PreviewLayout = Record<"announcement" | "header" | "template" | "footer", SectionNode[]>;

/**
 * The editor preview with custom-field values filled in, using the signed-in
 * lookup so a draft product or page still shows its values. Until the values
 * arrive, or if the lookup fails, settings show their fallback.
 */
export function usePreviewBindingValues(layout: PreviewLayout, options: {
  baseUrl: string;
  token?: string;
  storeId: string;
  resource?: BindingValuesRequest["resource"];
}): PreviewLayout {
  const { baseUrl, token, storeId, resource } = options;
  const bindings = useMemo(() => collectLayoutBindings(layout), [layout]);
  const request = JSON.stringify({ storeId, resource, keys: bindings.map(bindingKey).sort() });
  const [loaded, setLoaded] = useState<{ request: string; values: BindingValues }>();

  useEffect(() => {
    if (!token || !storeId || !bindings.length) return;
    let active = true;
    const load = createBindingValueLoader({
      origin: baseUrl,
      path: (id) => `/api/stores/${encodeURIComponent(id)}/storefront/binding-values`,
      headers: () => ({ Authorization: `Bearer ${token}` }),
    });
    load({ storeId, bindings, ...(resource ? { resource } : {}) })
      .then((values) => { if (active) setLoaded({ request, values }); })
      .catch(() => { if (active) setLoaded({ request, values: new Map() }); });
    return () => { active = false; };
    // `request` captures every input that changes the answer; `bindings` and `resource` are read through it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, baseUrl, token]);

  return useMemo(() => applyBindingValues(layout, loaded?.request === request ? loaded.values : new Map()), [layout, loaded, request]);
}
