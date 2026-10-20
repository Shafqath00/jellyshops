"use client";
import { createClient, type Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useShop } from "@/contexts/shop-context";
import { mergeWishlistIds, readGuestWishlist, writeGuestWishlist } from "./wishlist";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// A customer session must never trigger the merchant provider's provisioning path.
export const customerAuth = url && key ? createClient(url, key, { auth: { storageKey: "jelly-customer-auth", flowType: "pkce", detectSessionInUrl: false } }) : null;
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
  const [state, setState] = useState<{ session: Session | null; loading: boolean; error: string | null }>({ session: null, loading: Boolean(customerAuth), error: null });
  useEffect(() => {
    if (!customerAuth) return;
    let active = true; let changed = false;
    const { data } = customerAuth.auth.onAuthStateChange((_event, session) => { changed = true; if (active) setState({ session, loading: false, error: null }); });
    const callbackCode = new URL(window.location.href).searchParams.get("code");
    if (callbackCode) void customerAuth.auth.exchangeCodeForSession(callbackCode).then(({ error }) => {
      const nextUrl = new URL(window.location.href); nextUrl.searchParams.delete("code"); window.history.replaceState({}, "", nextUrl.toString());
      if (active && error) setState((value) => ({ ...value, loading: false, error: "This sign-in link has expired or was already used. Request a new link." }));
    });
    void customerAuth.auth.getSession().then(({ data, error }) => { if (active && !changed) setState({ session: data.session, loading: false, error: error?.message ?? null }); }).catch(() => { if (active && !changed) setState({ session: null, loading: false, error: "Unable to load your customer session. Reload to retry." }); });
    return () => { active = false; data.subscription.unsubscribe(); };
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
