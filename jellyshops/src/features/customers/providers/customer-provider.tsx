"use client";
import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useShop } from "@/contexts/shop-context";
import { mergeWishlistIds, readGuestWishlist, writeGuestWishlist } from "../lib/wishlist";

import { customerSupabase, supabaseConfigured } from "@/features/auth/lib/supabase-clients";

/** The customer sign-in client (loaded on first use; null when sign-in is not set up). */
export const customerAuth = customerSupabase;
export const customerApiOrigin = () => (process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
export function customerRequest<T>(storeId: string, path: string, session: Session | null, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  return fetch(`${customerApiOrigin()}/api/public/stores/${encodeURIComponent(storeId)}/customer${path}`, { method, signal, cache: "no-store", headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async (response) => {
    if (response.status === 204) return undefined as T;
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? "Unable to complete this request.");
    return data as T;
  });
}
const Context = createContext<{ session: Session | null; loading: boolean; error: string | null }>({ session: null, loading: true, error: null });
export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const params = useParams<{ storeSlug?: string }>();
  const { repository } = useShop();
  const store = params.storeSlug ? repository.getStoreBySlug(params.storeSlug) : undefined;
  const lastMerged = useRef("");
  const [state, setState] = useState<{ session: Session | null; loading: boolean; error: string | null }>({ session: null, loading: supabaseConfigured, error: null });
  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true; let changed = false; let unsubscribe: () => void = () => undefined;
    void customerSupabase().then((client) => {
      if (!active) return;
      if (!client) { setState({ session: null, loading: false, error: null }); return; }
      const { data } = client.auth.onAuthStateChange((_event, session) => { changed = true; if (active) setState({ session, loading: false, error: null }); });
      unsubscribe = () => data.subscription.unsubscribe();
      const callbackCode = new URL(window.location.href).searchParams.get("code");
      if (callbackCode) void client.auth.exchangeCodeForSession(callbackCode).then(({ error }) => {
        const nextUrl = new URL(window.location.href); nextUrl.searchParams.delete("code"); window.history.replaceState({}, "", nextUrl.toString());
        if (active && error) setState((value) => ({ ...value, loading: false, error: "This sign-in link has expired or was already used. Request a new link." }));
      });
      void client.auth.getSession().then(({ data: current, error }) => { if (active && !changed) setState({ session: current.session, loading: false, error: error?.message ?? null }); }).catch(() => { if (active && !changed) setState({ session: null, loading: false, error: "Unable to load your customer session. Reload to retry." }); });
    }).catch(() => { if (active) setState({ session: null, loading: false, error: "Unable to load your customer session. Reload to retry." }); });
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    const session = state.session;
    if (!store || !session?.user.email_confirmed_at) { lastMerged.current = ""; return; }
    const guestIds = readGuestWishlist(store.id);
    if (!guestIds.length) return;
    const key = `${store.id}:${session.user.id}:${guestIds.join(",")}`;
    if (lastMerged.current === key) return;
    lastMerged.current = key;
    void customerRequest<{ items: unknown[] }>(store.id, "/wishlist/merge", session, "POST", { productIds: mergeWishlistIds(guestIds) })
      .then(() => writeGuestWishlist(store.id, []))
      .catch((error: unknown) => { lastMerged.current = ""; setState((value) => ({ ...value, error: error instanceof Error ? `Your saved items are still on this device. ${error.message}` : "Your saved items are still on this device." })); });
  }, [state.session, store]);
  const value = useMemo(() => state, [state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useCustomer = () => useContext(Context);
