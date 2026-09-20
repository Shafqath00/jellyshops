import type { ComponentType } from "react";
import { DEFAULT_THEME_ID } from "./theme-resolver.js";
import { getThemeDefinition } from "./theme-registry.js";
import type { StorefrontCartPageProps, StorefrontCartProps, StorefrontCheckoutProps, StorefrontCollectionProps, StorefrontContentPageProps, StorefrontFooterProps, StorefrontHeaderProps, StorefrontLayoutProps, StorefrontOrderProps, StorefrontProductProps, StorefrontSearchProps, ThemeShellComponents } from "./types.js";

type ShellKey = keyof ThemeShellComponents;
type ShellProps = StorefrontLayoutProps | StorefrontHeaderProps | StorefrontFooterProps | StorefrontCartProps | StorefrontCollectionProps | StorefrontProductProps | StorefrontSearchProps | StorefrontCartPageProps | StorefrontCheckoutProps | StorefrontOrderProps | StorefrontContentPageProps;

function componentFor(key: ShellKey, themeId: string): ComponentType<ShellProps> | undefined {
  try { return getThemeDefinition(themeId).components?.[key] as ComponentType<ShellProps> | undefined; }
  catch { return undefined; }
}

/** Resolves one presentation extension with active → base → shared fallback. */
export function resolveThemeShellComponent<P extends ShellProps>(themeId: string | null | undefined, key: ShellKey, shared: ComponentType<P>): ComponentType<P> {
  return (componentFor(key, themeId ?? DEFAULT_THEME_ID) ?? componentFor(key, DEFAULT_THEME_ID) ?? shared) as ComponentType<P>;
}

export function resolveThemeShell(themeId: string | null | undefined, shared: Required<ThemeShellComponents>): Required<ThemeShellComponents> {
  return {
    Layout: resolveThemeShellComponent(themeId, "Layout", shared.Layout),
    Header: resolveThemeShellComponent(themeId, "Header", shared.Header),
    Footer: resolveThemeShellComponent(themeId, "Footer", shared.Footer),
    CartPanel: resolveThemeShellComponent(themeId, "CartPanel", shared.CartPanel),
    CollectionPage: resolveThemeShellComponent(themeId, "CollectionPage", shared.CollectionPage),
    ProductPage: resolveThemeShellComponent(themeId, "ProductPage", shared.ProductPage),
    SearchPage: resolveThemeShellComponent(themeId, "SearchPage", shared.SearchPage),
    CartPage: resolveThemeShellComponent(themeId, "CartPage", shared.CartPage),
    CheckoutPage: resolveThemeShellComponent(themeId, "CheckoutPage", shared.CheckoutPage),
    OrderPage: resolveThemeShellComponent(themeId, "OrderPage", shared.OrderPage),
    ContentPage: resolveThemeShellComponent(themeId, "ContentPage", shared.ContentPage),
  };
}
