import type { GlobalSettings, ThemeId } from "@jelly/storefront-schema";
import type { ComponentType, ReactNode } from "react";
import type { ThemeSectionProps } from "./themes/example-boutique/hero.js";

export interface ThemeTokens {
  colors: { primary: string; background: string; text: string; surface: string; accent: string };
  typography: { display: string; body: string };
  radii: { button: string; card: string };
  spacing: { section: string; container: string };
  cardShadow: string;
}
export interface ThemeAsset { id: string; path: string }
export interface ThemeFontAsset { id: string; family: string; path?: string; weight?: string | number; style?: string; format?: string }
export interface ThemePreviewAsset { path: string; alt?: string }
export interface ThemeAssetManifest { stylesheets: ThemeAsset[]; scripts: ThemeAsset[]; fonts: ThemeFontAsset[]; icons: ThemeAsset[]; assets: ThemeAsset[]; preview?: ThemePreviewAsset }
export interface StorefrontShellStore { name: string; slug: string; tagline?: string; logoUrl?: string }
export interface StorefrontNavigationItem { label: string; href: string }
export interface StorefrontHeaderProps { store: StorefrontShellStore; navigation: StorefrontNavigationItem[]; cartCount: number; settings: Record<string, unknown>; onCartOpen(): void }
export interface StorefrontFooterProps { store: StorefrontShellStore; settings: Record<string, unknown> }
export interface StorefrontCartProps { open: boolean; itemCount: number; settings: Record<string, unknown>; children: ReactNode; onClose(): void }
export interface StorefrontLayoutProps { store: StorefrontShellStore; settings: Record<string, unknown>; header: ReactNode; footer: ReactNode; cart: ReactNode; children: ReactNode }
export interface StorefrontProductCardView { id: string; name: string; slug: string; category: string; imageUrl: string; price: string; soldOut: boolean; lowStock: boolean; href: string }
export interface StorefrontCollectionProps { store: StorefrontShellStore; settings: Record<string, unknown>; products: StorefrontProductCardView[]; categories: string[]; selectedCategory?: string; allHref: string; categoryHref(category: string): string }
export interface StorefrontProductOptionValue { id: string; label: string; priceAdjustment?: string; selected: boolean }
export interface StorefrontProductOption { id: string; name: string; required: boolean; values: StorefrontProductOptionValue[] }
export interface StorefrontProductProps { store: StorefrontShellStore; settings: Record<string, unknown>; product: { name: string; category: string; description: string; imageUrl: string }; price: string; availableText: string; options: StorefrontProductOption[]; backHref: string; variantAvailable: boolean; requiredMissing: boolean; added: boolean; onSelectOption(optionId: string, valueId: string): void; onAddToCart(): void }
export interface StorefrontSearchResultView extends StorefrontProductCardView { }
export interface StorefrontSearchProps { store: StorefrontShellStore; settings: Record<string, unknown>; query: string; results: StorefrontSearchResultView[]; shopHref: string }
export interface StorefrontCartLineView { id: string; productName: string; variantName: string; imageUrl: string; quantity: number; unitPrice: string; lineTotal: string; canIncrease: boolean; options: string[] }
export interface StorefrontCartPageProps { store: StorefrontShellStore; settings: Record<string, unknown>; lines: StorefrontCartLineView[]; subtotal: string; shopHref: string; checkoutHref: string; onDecrease(id: string): void; onIncrease(id: string): void }
export interface StorefrontCheckoutProps { store: StorefrontShellStore; settings: Record<string, unknown>; children: ReactNode }
export interface StorefrontOrderProps { store: StorefrontShellStore; settings: Record<string, unknown>; children: ReactNode }
export interface StorefrontContentPageProps { store: StorefrontShellStore; settings: Record<string, unknown>; pageSlug: string; children: ReactNode }
export interface ThemeShellComponents { Layout?: ComponentType<StorefrontLayoutProps>; Header?: ComponentType<StorefrontHeaderProps>; Footer?: ComponentType<StorefrontFooterProps>; CartPanel?: ComponentType<StorefrontCartProps>; CollectionPage?: ComponentType<StorefrontCollectionProps>; ProductPage?: ComponentType<StorefrontProductProps>; SearchPage?: ComponentType<StorefrontSearchProps>; CartPage?: ComponentType<StorefrontCartPageProps>; CheckoutPage?: ComponentType<StorefrontCheckoutProps>; OrderPage?: ComponentType<StorefrontOrderProps>; ContentPage?: ComponentType<StorefrontContentPageProps> }
export interface ThemeDefinition { id: ThemeId; label: string; tokens: ThemeTokens; sectionVariants: Record<string, string>; manifest: unknown; sectionOverrides: Record<string, ComponentType<ThemeSectionProps>>; components?: ThemeShellComponents }
export type ResolvedDesignTokens = Record<string, string>;
export type { GlobalSettings };
