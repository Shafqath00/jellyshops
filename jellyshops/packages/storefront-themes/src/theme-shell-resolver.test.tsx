import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveThemeShellComponent } from "./theme-shell-resolver";
import type { StorefrontHeaderProps } from "./types";

const SharedHeader = (props: StorefrontHeaderProps) => <p data-store={props.store.slug}>Shared header</p>;

describe("theme shell resolver", () => {
  it("uses an active theme shell component when available", () => {
    const Header = resolveThemeShellComponent("example-boutique", "Header", SharedHeader);
    render(<Header store={{ name: "Boutique", slug: "boutique" }} navigation={[]} cartCount={0} settings={{ header: { announcement: "Draft announcement" } }} onCartOpen={() => undefined} />);
    expect(screen.getByText("Boutique")).toBeVisible();
    expect(screen.getByText("Draft announcement")).toBeVisible();
  });

  it("falls through base and shared components for partial or invalid themes", () => {
    const Header = resolveThemeShellComponent("minimal", "Header", SharedHeader);
    const InvalidHeader = resolveThemeShellComponent("deleted-theme", "Header", SharedHeader);
    render(<><Header store={{ name: "Base", slug: "base" }} navigation={[]} cartCount={0} settings={{}} onCartOpen={() => undefined} /><InvalidHeader store={{ name: "Invalid", slug: "invalid" }} navigation={[]} cartCount={0} settings={{}} onCartOpen={() => undefined} /></>);
    expect(screen.getAllByText("Shared header")).toHaveLength(2);
  });

  it("resolves theme-owned product and collection templates through the same contract", () => {
    const Product = resolveThemeShellComponent("example-boutique", "ProductPage", () => <p>Boutique product</p>);
    const Collection = resolveThemeShellComponent("example-boutique", "CollectionPage", () => <p>Boutique collection</p>);
    render(<><Product store={{ name: "Boutique", slug: "boutique" }} settings={{}} product={{ name: "Tea", category: "Goods", description: "A tea", imageUrl: "/tea.jpg" }} price="$10" availableText="Available" options={[]} backHref="#" variantAvailable onSelectOption={() => undefined} onAddToCart={() => undefined} /><Collection store={{ name: "Boutique", slug: "boutique" }} settings={{}} products={[]} categories={[]} allHref="#" categoryHref={() => "#"} /></>);
    expect(screen.getByText("Objects with a story.")).toBeVisible();
    expect(screen.getByText("The seasonal edit")).toBeVisible();
  });

  it("resolves theme-owned search and cart templates", () => {
    const Search = resolveThemeShellComponent("example-boutique", "SearchPage", () => <p>Shared search</p>);
    const Cart = resolveThemeShellComponent("example-boutique", "CartPage", () => <p>Shared cart</p>);
    render(<><Search store={{ name: "Boutique", slug: "boutique" }} settings={{}} query="tea" results={[]} shopHref="#" /><Cart store={{ name: "Boutique", slug: "boutique" }} settings={{}} lines={[]} subtotal="$0.00" shopHref="#" checkoutHref="#" onDecrease={() => undefined} onIncrease={() => undefined} /></>);
    expect(screen.getByText("A considered search")).toBeVisible();
    expect(screen.getByText("Your edit")).toBeVisible();
  });

  it("resolves checkout and order presentation boundaries", () => {
    const Checkout = resolveThemeShellComponent("example-boutique", "CheckoutPage", () => <p>Shared checkout</p>);
    const Order = resolveThemeShellComponent("example-boutique", "OrderPage", () => <p>Shared order</p>);
    render(<><Checkout store={{ name: "Boutique", slug: "boutique" }} settings={{}}>Checkout body</Checkout><Order store={{ name: "Boutique", slug: "boutique" }} settings={{}}>Order body</Order></>);
    expect(screen.getByText("A considered checkout")).toBeVisible();
    expect(screen.getByText("Order body")).toBeVisible();
  });

  it("resolves custom content page presentation", () => {
    const Content = resolveThemeShellComponent("example-boutique", "ContentPage", () => <p>Shared content</p>);
    render(<Content store={{ name: "Boutique", slug: "boutique" }} settings={{}} pageSlug="about">Page body</Content>);
    expect(screen.getByText("Page body")).toBeVisible();
  });
});
