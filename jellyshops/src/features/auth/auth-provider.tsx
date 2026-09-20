"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface MerchantStore {
  id: string;
  name: string;
  slug: string;
  currency: string;
  country: string;
  role: string;
}

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  merchantLoading: boolean;
  session: Session | null;
  stores: MerchantStore[];
  activeStore: MerchantStore | null;
  setActiveStoreId: (storeId: string) => void;
  refreshMerchant: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
const apiOrigin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

async function loadMerchant(session: Session): Promise<MerchantStore[]> {
  const response = await fetch(`${apiOrigin}/api/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("Could not load your stores");
  const body = await response.json() as { stores?: MerchantStore[] };
  return body.stores ?? [];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [stores, setStores] = useState<MerchantStore[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [merchantLoading, setMerchantLoading] = useState(false);

  const refreshMerchant = useCallback(async () => {
    if (!session) {
      setStores([]);
      return;
    }
    setMerchantLoading(true);
    try { setStores(await loadMerchant(session)); }
    finally { setMerchantLoading(false); }
  }, [session]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setStores([]);
        setActiveStoreId(null);
      }
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    setMerchantLoading(true);
    void loadMerchant(session).then(setStores).catch(() => setStores([])).finally(() => setMerchantLoading(false));
  }, [session]);

  useEffect(() => {
    if (!stores.length) {
      setActiveStoreId(null);
      return;
    }
    setActiveStoreId((current) => stores.some((store) => store.id === current) ? current : stores[0].id);
  }, [stores]);

  const activeStore = stores.find((store) => store.id === activeStoreId) ?? null;

  const value = useMemo<AuthContextValue>(() => ({
    configured: Boolean(supabase),
    loading,
    merchantLoading,
    session,
    stores,
    activeStore,
    setActiveStoreId,
    refreshMerchant,
    signOut: async () => { await supabase?.auth.signOut(); },
  }), [activeStore, loading, merchantLoading, refreshMerchant, session, stores]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function authApiOrigin() {
  return apiOrigin;
}
