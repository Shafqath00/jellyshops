"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ShopState } from "@/lib/domain";
import { createRepository, memoryStorage, type ShopRepository } from "@/lib/repository";

interface ShopContextValue {
  state: ShopState;
  repository: ShopRepository;
  resetDemo: () => void;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [repository, setRepository] = useState<ShopRepository>(() => createRepository(memoryStorage()));
  const state = useSyncExternalStore(repository.subscribe, repository.getState, repository.getState);

  useEffect(() => {
    const persistedRepository = createRepository(window.localStorage);
    queueMicrotask(() => setRepository(persistedRepository));
  }, []);

  const value = useMemo<ShopContextValue>(() => ({
    state,
    repository,
    resetDemo: () => repository.reset()
  }), [repository, state]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const context = useContext(ShopContext);
  if (!context) throw new Error("useShop must be used inside ShopProvider");
  return context;
}
