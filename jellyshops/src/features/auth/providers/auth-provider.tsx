"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadMerchant, type MerchantStore } from "../api/merchant-api";
import { createSessionTokenReader } from "../lib/session-token";
import { merchantSupabase, supabaseConfigured } from "../lib/supabase-clients";

export type { MerchantStore };
interface AuthContextValue {
  configured: boolean; loading: boolean; merchantLoading: boolean;
  merchantStatus: "loading" | "ready" | "error"; merchantError: string | null;
  session: Session | null; stores: MerchantStore[]; activeStore: MerchantStore | null;
  setActiveStoreId: (storeId: string) => void;
  refreshMerchant: () => Promise<void>; signOut: () => Promise<void>;
  getAccessToken: (refresh?: boolean) => Promise<string>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
const apiOrigin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

type MerchantState = { userId: string; stores: MerchantStore[]; status: "ready" | "error"; error: string | null };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [merchant, setMerchant] = useState<MerchantState | null>(null);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  // The sign-in client arrives after the page is up (its library is loaded on demand).
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const getAccessToken = useMemo(() => client && session?.user.id
    ? createSessionTokenReader(client.auth, session.user.id)
    : async () => { throw new Error("Sign in again to continue."); }, [client, session?.user.id]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    let unsubscribe: () => void = () => undefined;
    const accept = (next: Session | null) => {
      if (!active) return;
      generation.current += 1;
      setSession(next); setLoading(false); setRefreshing(false);
      if (!next) { setMerchant(null); setActiveStoreId(null); }
    };
    void merchantSupabase().then((supabase) => {
      if (!active) return;
      if (!supabase) { setLoading(false); return; }
      setClient(supabase);
      void supabase.auth.getSession().then(({ data }) => accept(data.session)).catch(() => accept(null));
      const { data } = supabase.auth.onAuthStateChange((_event, next) => accept(next));
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch(() => accept(null));
    return () => { active = false; generation.current += 1; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const requestGeneration = ++generation.current;
    void loadMerchant(apiOrigin, session.access_token, controller.signal).then((stores) => {
      if (generation.current === requestGeneration) setMerchant({ userId: session.user.id, stores, status: "ready", error: null });
    }).catch((error: unknown) => {
      if (controller.signal.aborted || generation.current !== requestGeneration) return;
      setMerchant((previous) => ({ userId: session.user.id, stores: previous?.userId === session.user.id ? previous.stores : [], status: "error", error: error instanceof Error ? error.message : "Could not load your stores." }));
    });
    return () => controller.abort();
  }, [session]);

  const refreshMerchant = useCallback(async () => {
    if (!session) return;
    const requestGeneration = ++generation.current;
    setRefreshing(true);
    try {
      const stores = await loadMerchant(apiOrigin, session.access_token);
      if (generation.current === requestGeneration) setMerchant({ userId: session.user.id, stores, status: "ready", error: null });
    } catch (error) {
      if (generation.current === requestGeneration) setMerchant((previous) => ({ userId: session.user.id, stores: previous?.userId === session.user.id ? previous.stores : [], status: "error", error: error instanceof Error ? error.message : "Could not load your stores." }));
      throw error;
    } finally { if (generation.current === requestGeneration) setRefreshing(false); }
  }, [session]);

  const value = useMemo<AuthContextValue>(() => {
    const current = session && merchant?.userId === session.user.id ? merchant : null;
    const stores = current?.stores ?? [];
    return {
      configured: supabaseConfigured, loading, session, stores, getAccessToken,
      merchantLoading: Boolean(session) && (refreshing || !current),
      merchantStatus: refreshing ? "loading" : current?.status ?? "loading",
      merchantError: current?.error ?? null,
      activeStore: stores.find((store) => store.id === activeStoreId) ?? stores[0] ?? null,
      setActiveStoreId: (storeId) => {
        const commit = () => setActiveStoreId(storeId);
        const event = new CustomEvent("jelly:before-store-change", { cancelable: true, detail: { commit } });
        if (window.dispatchEvent(event)) commit();
      }, refreshMerchant,
      signOut: async () => { await (await merchantSupabase())?.auth.signOut(); },
    };
  }, [activeStoreId, getAccessToken, loading, merchant, refreshMerchant, refreshing, session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
export function authApiOrigin() { return apiOrigin; }
