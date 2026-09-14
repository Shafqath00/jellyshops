import type { CommerceDataProvider, RendererMode } from "./types";

export type RuntimeRegion = "header" | "template" | "footer";

export interface StorefrontRuntimeContext {
  mode: RendererMode;
  region?: RuntimeRegion;
  commerce: CommerceDataProvider;
}

export function createStorefrontRuntimeContext(input: StorefrontRuntimeContext): StorefrontRuntimeContext {
  return Object.freeze({ ...input });
}
