import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { SectionRenderRegistry } from "./render-registry";
import { RegistrySectionRenderer } from "./registry-section-renderer";

const commerce = { getProducts: vi.fn(async () => []) };

function section(type: string): SectionNode {
  return { id: `${type}-1`, type, enabled: true, settings: {}, blocks: [] };
}

describe("registry-driven section rendering", () => {
  it("renders a newly registered section without changing the renderer", () => {
    const registry = new SectionRenderRegistry();
    registry.register("brand-story", ({ section }) => <article>Rendered {section.type}</article>);

    render(<RegistrySectionRenderer section={section("brand-story")} mode="published" commerce={commerce} registry={registry} />);
    expect(screen.getByText("Rendered brand-story")).toBeInTheDocument();
  });

  it("passes a constrained runtime context to registered sections", () => {
    const registry = new SectionRenderRegistry();
    registry.register("runtime-aware", ({ context }) => (
      <span>{context.mode}:{context.region}:{String(context.commerce === commerce)}</span>
    ));

    render(
      <RegistrySectionRenderer
        section={section("runtime-aware")}
        mode="preview"
        region="template"
        commerce={commerce}
        registry={registry}
      />,
    );

    expect(screen.getByText("preview:template:true")).toBeInTheDocument();
  });

  it("passes live product page context to product sections", () => {
    const registry = new SectionRenderRegistry();
    registry.register("product-information", ({ context }) => <span>{context.page?.resource?.data.title as string}</span>);

    render(<RegistrySectionRenderer section={section("product-information")} mode="published" commerce={commerce} registry={registry} page={{ pageType: "product", resource: { id: "product-1", handle: "cake", data: { title: "Live cake" } } }} />);
    expect(screen.getByText("Live cake")).toBeInTheDocument();
  });

  it("renders product information from live page context", () => {
    render(<RegistrySectionRenderer section={section("product-information")} mode="published" commerce={commerce} page={{ pageType: "product", resource: { id: "product-1", handle: "cake", data: { title: "Live cake" } } }} />);
    expect(screen.getByRole("heading", { name: "Live cake" })).toBeInTheDocument();
  });

  it("renders Collection title, supplied live products, and a safe empty state", () => {
    const page = {
      pageType: "collection" as const,
      resource: {
        id: "collection-1",
        handle: "summer",
        data: {
          collection: { id: "collection-1", name: "Summer collection", slug: "summer" },
          products: [{ id: "product-1", name: "Lemon cake", href: "/shop/products/lemon-cake", imageUrl: "", price: "$10" }],
        },
      },
    };
    const { rerender } = render(<>
      <RegistrySectionRenderer section={section("collection-header")} mode="published" commerce={commerce} page={page} />
      <RegistrySectionRenderer section={section("collection-product-grid")} mode="published" commerce={commerce} page={page} />
    </>);

    expect(screen.getByRole("heading", { name: "Summer collection" })).toBeInTheDocument();
    expect(screen.getByText("Lemon cake")).toBeInTheDocument();

    rerender(<RegistrySectionRenderer section={section("collection-product-grid")} mode="published" commerce={commerce} page={{ ...page, resource: { ...page.resource, data: { ...page.resource.data, products: [] } } }} />);
    expect(screen.getByText("No products are available in this collection yet.")).toBeInTheDocument();
  });

  it("renders live Cart data and delegates quantity mutations to the runtime context", () => {
    const onDecrease = vi.fn();
    const onIncrease = vi.fn();
    render(<RegistrySectionRenderer section={section("cart-summary")} mode="published" commerce={commerce} page={{ pageType: "cart", resource: null, data: { lines: [{ id: "line-1", name: "Lemon cake · Default", quantity: 2, total: "$20", onDecrease, onIncrease }], subtotal: "$20", checkoutHref: "/shop/checkout" } }} />);

    expect(screen.getByText("Lemon cake · Default")).toBeInTheDocument();
    expect(screen.getByText("Subtotal: $20")).toBeInTheDocument();
    screen.getAllByRole("button")[0]?.click();
    screen.getAllByRole("button")[1]?.click();
    expect(onDecrease).toHaveBeenCalledOnce();
    expect(onIncrease).toHaveBeenCalledOnce();
  });

  it("renders search results from live context rather than section settings", () => {
    render(<RegistrySectionRenderer section={{ ...section("search-results"), settings: { heading: "Stale persisted heading" } }} mode="published" commerce={commerce} page={{ pageType: "search", resource: null, data: { query: "shoes", state: "results", resultCount: 1, searchHref: "/store/search", results: [{ id: "shoe", name: "Live Shoe", href: "/store/products/shoe", imageUrl: "shoe.jpg", price: "$12.00" }] } }} />);
    expect(screen.getByDisplayValue("shoes")).toBeInTheDocument();
    expect(screen.getByText("Live Shoe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /live shoe/i })).toHaveAttribute("href", "/store/products/shoe");
  });

  it("renders custom Page title and safe text content from live resource context", () => {
    render(<RegistrySectionRenderer section={section("page-content")} mode="published" commerce={commerce} page={{ pageType: "page", resource: { id: "about", handle: "about", data: { title: "About us", content: { text: "We make carefully chosen things.", html: "<script>unsafe</script>" } } } }} />);
    expect(screen.getByRole("heading", { name: "About us" })).toBeInTheDocument();
    expect(screen.getByText("We make carefully chosen things.")).toBeInTheDocument();
    expect(screen.queryByText(/unsafe/i)).toBeNull();
  });

  it("keeps unsupported-section diagnostics in editor/preview but not published", () => {
    const registry = new SectionRenderRegistry();
    const { rerender } = render(
      <RegistrySectionRenderer section={section("unknown-section")} mode="editor" commerce={commerce} registry={registry} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Unsupported section: unknown-section");

    rerender(<RegistrySectionRenderer section={section("unknown-section")} mode="published" commerce={commerce} registry={registry} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("preserves editor selection metadata around registry-rendered content", () => {
    const registry = new SectionRenderRegistry();
    registry.register("brand-story", () => <span>Story</span>);
    const onSelect = vi.fn();

    render(
      <RegistrySectionRenderer
        section={section("brand-story")}
        mode="editor"
        commerce={commerce}
        region="template"
        selected={{ kind: "section", region: "template", sectionId: "brand-story-1" }}
        onSelect={onSelect}
        registry={registry}
      />,
    );

    const wrapper = screen.getByTestId("section-brand-story");
    expect(wrapper).toHaveAttribute("data-editor-section-id", "brand-story-1");
    expect(wrapper).toHaveAttribute("data-editor-selected", "true");
    wrapper.click();
    expect(onSelect).toHaveBeenCalledWith({ kind: "section", region: "template", sectionId: "brand-story-1" });
  });
});
