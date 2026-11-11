"use client";

import { LazyMotion, MotionConfig, m, useReducedMotion } from "framer-motion";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import "./product-surface.css";

const loadFeatures = () => import("./motion-features").then(module => module.default);
const ProductMotion = createContext(false);
export const useProductMotion = () => useContext(ProductMotion);
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Styling and animation are local to product pages, never the dashboard shell. */
export function ProductSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const animated = mounted && typeof window.matchMedia === "function" && !reduced;
  return <LazyMotion features={loadFeatures} strict>
    <MotionConfig reducedMotion="user" transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}>
      <ProductMotion.Provider value={animated}>
        <m.div className={`product-surface ${className}`} initial={animated ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }}>{children}</m.div>
      </ProductMotion.Provider>
    </MotionConfig>
  </LazyMotion>;
}
