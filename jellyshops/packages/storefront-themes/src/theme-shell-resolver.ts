import type { ComponentType } from "react";
import { DEFAULT_THEME_ID } from "./theme-resolver.js";
import { getThemeDefinition } from "./theme-registry.js";
import type { StorefrontCartPageProps, StorefrontCartProps, StorefrontCheckoutProps, StorefrontCollectionProps, StorefrontContentPageProps, StorefrontFooterProps, StorefrontHeaderProps, StorefrontLayoutProps, StorefrontOrderProps, StorefrontProductProps, StorefrontSearchProps, ThemeShellComponents } from "./types.js";

type ShellKey = keyof ThemeShellComponents;
type ShellProps = StorefrontLayoutProps | StorefrontHeaderProps | StorefrontFooterProps | StorefrontCartProps | StorefrontCollectionProps | StorefrontProductProps | StorefrontSearchProps | StorefrontCartPageProps | StorefrontCheckoutProps | StorefrontOrderProps | StorefrontContentPageProps;

function componentFor(key: ShellKey, themeId: string, version?: string): ComponentType<ShellProps> | undefined {
  try { return getThemeDefinition(themeId, version).components?.[key] as ComponentType<ShellProps> | undefined; }
  catch { return undefined; }
}

/** Resolves one presentation extension with active → base → shared fallback. */
export function resolveThemeShellComponent<P extends ShellProps>(themeId: string | null | undefined, key: ShellKey, shared: ComponentType<P>, version?: string): ComponentType<P> {
  return (componentFor(key, themeId ?? DEFAULT_THEME_ID, version) ?? componentFor(key, DEFAULT_THEME_ID) ?? shared) as ComponentType<P>;
}

export function resolveThemeShell(themeId: string | null | undefined, shared: Required<ThemeShellComponents>, version?: string): Required<ThemeShellComponents> {
  const resolve = <P extends ShellProps>(id: typeof themeId, key: ShellKey, component: ComponentType<P>) => resolveThemeShellComponent(id, key, component, version);
  return {
    Layout: resolve(themeId, "Layout", shared.Layout),
    Header: resolve(themeId, "Header", shared.Header),
    Footer: resolve(themeId, "Footer", shared.Footer),
    CartPanel: resolve(themeId, "CartPanel", shared.CartPanel),
    CollectionPage: resolve(themeId, "CollectionPage", shared.CollectionPage),
    ProductPage: resolve(themeId, "ProductPage", shared.ProductPage),
    SearchPage: resolve(themeId, "SearchPage", shared.SearchPage),
    CartPage: resolve(themeId, "CartPage", shared.CartPage),
    CheckoutPage: resolve(themeId, "CheckoutPage", shared.CheckoutPage),
    OrderPage: resolve(themeId, "OrderPage", shared.OrderPage),
    ContentPage: resolve(themeId, "ContentPage", shared.ContentPage),
  };
}
