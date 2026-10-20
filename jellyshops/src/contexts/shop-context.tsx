"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ShopState, Store, Product, Collection } from "@/lib/domain";
import { createRepository, memoryStorage, type ShopRepository } from "@/lib/repository";

interface ShopContextValue {
  state: ShopState;
  repository: ShopRepository;
  resetDemo: () => void;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children, initialCatalog }: { children: React.ReactNode; initialCatalog?: { store: Store; products: Product[]; collections: Collection[] } }) {
  const [repository, setRepository] = useState<ShopRepository>(() => {
    const initial = createRepository(memoryStorage(), { runtime: true });
    if (initialCatalog) { initial.saveStore(initialCatalog.store); initial.replaceCatalog(initialCatalog.store.id, initialCatalog.products); initial.replaceCollections(initialCatalog.store.id, initialCatalog.collections); }
    return initial;
  });
  const state = useSyncExternalStore(repository.subscribe, repository.getState, repository.getState);

  useEffect(() => {
    const persistedRepository = createRepository(window.localStorage, { runtime: true });
    if (initialCatalog) { persistedRepository.saveStore(initialCatalog.store); persistedRepository.replaceCatalog(initialCatalog.store.id, initialCatalog.products); persistedRepository.replaceCollections(initialCatalog.store.id, initialCatalog.collections); }
    queueMicrotask(() => setRepository(persistedRepository));
  }, [initialCatalog]);

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
