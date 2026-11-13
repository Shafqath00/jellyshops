"use client";

import { useMemo } from "react";
import type { ListAddress } from "@jelly/storefront-renderer";

/**
 * The live store's page address for product lists: the query the server saw (so the server draws the same filtered
 * list), and an update that rewrites the query in place (history.replaceState, which Next's router follows), so
 * choosing filters does not fill the Back button with every tick.
 */
export function useListAddress(search: string | undefined): ListAddress | undefined {
  return useMemo(() => search === undefined ? undefined : {
    search,
    update(next) {
      if (typeof window === "undefined") return;
      const current = window.location.search;
      const updated = next(current);
      if (updated !== current) window.history.replaceState(window.history.state, "", `${window.location.pathname}${updated}${window.location.hash}`);
    },
  }, [search]);
}
