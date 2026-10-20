"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadMerchant } from "./merchant-api";

export interface MerchantStore {
  id: string; name: string; slug: string; currency: string; country: string; role: string;
}
interface AuthContextValue {
  configured: boolean; loading: boolean; merchantLoading: boolean;
  merchantStatus: "loading" | "ready" | "error"; merchantError: string | null;
  session: Session | null; stores: MerchantStore[]; activeStore: MerchantStore | null;
  setActiveStoreId: (storeId: string) => void;
  refreshMerchant: () => Promise<void>; signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && anonKey ? createClient(url, anonKey, { auth: { detectSessionInUrl: false } }) : null;
const apiOrigin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

type MerchantState = { userId: string; stores: MerchantStore[]; status: "ready" | "error"; error: string | null };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [merchant, setMerchant] = useState<MerchantState | null>(null);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const accept = (next: Session | null) => {
      if (!active) return;
      generation.current += 1;
      setSession(next); setLoading(false); setRefreshing(false);
      if (!next) { setMerchant(null); setActiveStoreId(null); }
    };
    void supabase.auth.getSession().then(({ data }) => accept(data.session)).catch(() => accept(null));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => accept(next));
    return () => { active = false; generation.current += 1; data.subscription.unsubscribe(); };
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
      configured: Boolean(supabase), loading, session, stores,
      merchantLoading: Boolean(session) && (refreshing || !current),
      merchantStatus: refreshing ? "loading" : current?.status ?? "loading",
      merchantError: current?.error ?? null,
      activeStore: stores.find((store) => store.id === activeStoreId) ?? stores[0] ?? null,
      setActiveStoreId: (storeId) => {
        const commit = () => setActiveStoreId(storeId);
        const event = new CustomEvent("jelly:before-store-change", { cancelable: true, detail: { commit } });
        if (window.dispatchEvent(event)) commit();
      }, refreshMerchant,
      signOut: async () => { await supabase?.auth.signOut(); },
    };
  }, [activeStoreId, loading, merchant, refreshMerchant, refreshing, session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
export function authApiOrigin() { return apiOrigin; }
