import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  SharedCartPresentation,
  SharedStorefrontFooter,
  SharedStorefrontHeader,
  SharedStorefrontLayout,
} from "./storefront-shell";

const store = { name: "Fresh Market", slug: "fresh-market", tagline: "Good food, gathered well." };
const navigation = [
  { label: "Home", href: "/fresh-market" },
  { label: "Search", href: "/fresh-market/search" },
];

function shell(headerVariant: string, footerVariant: string) {
  return <SharedStorefrontLayout
    store={store}
    settings={{}}
    header={<SharedStorefrontHeader store={store} navigation={navigation} cartCount={2} settings={{ header: { variant: headerVariant, showSearch: false } }} onCartOpen={vi.fn()} />}
    footer={<SharedStorefrontFooter store={store} settings={{ footer: { variant: footerVariant } }} />}
    cart={null}
  >
    <main>Store content</main>
  </SharedStorefrontLayout>;
}

describe("shared storefront shell", () => {
  it("uses resolved theme variables on the shared layout and shell variants", () => {
    const { rerender } = render(shell("logo-centered", "simple"));

    expect(screen.getByText("Store content").parentElement).toHaveClass("bg-[var(--store-bg)]", "text-[var(--store-text)]");
    expect(screen.getByRole("banner")).toHaveClass("sticky", "grid");
    expect(screen.getByRole("banner").className).toContain("--store-bg");
    expect(screen.getByRole("link", { name: "Fresh Market" }).className).toContain("col-start-2");
    expect(screen.getByRole("link", { name: "Fresh Market" }).className).toContain("--store-display");
    expect(screen.getByRole("navigation", { name: "Store navigation" }).className).toContain("col-start-1");
    expect(screen.getByRole("navigation", { name: "Store navigation" })).not.toHaveTextContent("Search");
    expect(screen.getByRole("button", { name: "Open cart with 2 items" })).toBeVisible();
    expect(screen.getByRole("contentinfo")).toHaveClass("bg-[var(--store-text)]");
    expect(screen.getByRole("contentinfo").className).toContain("[&>div:nth-child(2)]:hidden");

    rerender(shell("compact", "newsletter"));
    expect(screen.getByRole("banner").className).toContain("h-[58px]");
    expect(screen.getByRole("contentinfo").className).toContain("grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]");
  });

  it("keeps the cart dialog theme-token driven and dismissible", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<SharedCartPresentation open itemCount={1} settings={{}} onClose={onClose}>
      <h2 id="cart-title">Your bag</h2>
    </SharedCartPresentation>);

    expect(screen.getByRole("dialog", { name: "Your bag" }).className).toContain("--store-surface");
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("focus-visible:ring-2", "focus-visible:ring-ring");
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();

    onClose.mockClear();
    const overlay = document.body.querySelector<HTMLElement>("[data-state='open'].fixed.inset-0");
    expect(overlay).not.toBeNull();
    await user.click(overlay!);
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<SharedCartPresentation open={false} itemCount={0} settings={{}} onClose={onClose}><h2 id="cart-title">Your bag</h2></SharedCartPresentation>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
