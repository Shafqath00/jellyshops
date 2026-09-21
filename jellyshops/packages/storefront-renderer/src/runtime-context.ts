import type { CommerceDataProvider, RendererMode, StorefrontPageContext } from "./types";

export type RuntimeRegion = "header" | "template" | "footer";

export interface StorefrontRuntimeContext {
  mode: RendererMode;
  region?: RuntimeRegion;
  commerce: CommerceDataProvider;
  page?: StorefrontPageContext;
}

export function createStorefrontRuntimeContext(input: StorefrontRuntimeContext): StorefrontRuntimeContext {
  return Object.freeze({ ...input });
}
