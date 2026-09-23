import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders the same configured Rich text section in preview, editor, and published modes across compatible pages", () => {
    const richText: SectionNode = {
      id: "story",
      type: "rich-text",
      enabled: true,
      settings: { alignment: "center" },
      blocks: [{ id: "story-copy", type: "text", enabled: true, settings: { text: "Independent story content" } }],
    };
    const compatiblePages = ["home", "product", "collection", "page", "blog", "article"] as const;

    for (const pageType of compatiblePages) {
      const page = pageType === "home"
        ? { pageType, resource: null }
        : { pageType, resource: { id: `${pageType}-1`, handle: pageType, data: { unrelated: "Live resource data" } } };
      for (const mode of ["preview", "editor", "published"] as const) {
        const view = render(<RegistrySectionRenderer section={richText} mode={mode} commerce={commerce} page={page} />);
        expect(view.getByText("Independent story content")).toBeInTheDocument();
        expect(view.queryByText("Live resource data")).not.toBeInTheDocument();
        view.unmount();
      }
    }
  });

  it("renders the same structured document in preview and published modes", () => {
    const structured: SectionNode = { id: "story", type: "rich-text", enabled: true, blocks: [], settings: { document: {
      type: "doc", content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Our story", marks: [{ type: "bold" }] }] },
        { type: "paragraph", content: [{ type: "text", text: "Learn more", marks: [{ type: "link", attrs: { href: "/pages/about" } }] }, { type: "hardBreak" }, { type: "text", text: "Today", marks: [{ type: "italic" }] }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Carefully made" }] }] }] },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "For every day" }] }] },
      ],
    } } };
    for (const mode of ["preview", "published"] as const) {
      const view = render(<RegistrySectionRenderer section={structured} mode={mode} commerce={commerce} page={{ pageType: "article", resource: { id: "article-1", handle: "story", data: {} } }} />);
      expect(view.getByRole("heading", { level: 2, name: "Our story" }).querySelector("strong")).not.toBeNull();
      expect(view.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", "/pages/about");
      expect(view.getByText("Today").closest("em")).not.toBeNull();
      expect(view.getByRole("listitem")).toHaveTextContent("Carefully made");
      expect(view.getByText("For every day").closest("blockquote")).not.toBeNull();
      view.unmount();
    }
  });

  it("escapes text and ignores unsupported nodes and unsafe links in public output", () => {
    const untrusted: SectionNode = { id: "story", type: "rich-text", enabled: true, blocks: [], settings: { document: {
      type: "doc", content: [
        { type: "script", attrs: { src: "https://example.com/evil.js" } },
        { type: "paragraph", content: [
          { type: "text", text: "<script>alert(1)</script>" },
          { type: "text", text: "Click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
        ] },
      ],
    } } };
    const view = render(<RegistrySectionRenderer section={untrusted} mode="published" commerce={commerce} />);
    expect(view.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(view.container.querySelector("script")).toBeNull();
    expect(view.queryByRole("link", { name: "Click" })).toBeNull();
    expect(view.getByText("Click")).toBeInTheDocument();
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

  it("renders Product merchandising sections from live context and delegates purchase", async () => {
    const addToCart = vi.fn(async () => ({ ok: true }));
    const selectOption = vi.fn();
    const setQuantity = vi.fn();
    const page = {
      pageType: "product" as const,
      resource: {
        id: "cake", handle: "cake", data: {
          productPresentation: {
            product: { id: "cake", title: "Celebration cake", description: "Vanilla sponge", imageUrl: "/cake.jpg", sku: "CAKE-S", vendor: "Jelly", options: [{ id: "size", name: "Size", required: true, values: [{ id: "small", label: "Small", selected: true, available: true }] }] },
            selection: [{ optionId: "size", valueId: "small" }], quantity: 1, pricing: { price: "$12.00", compareAtPrice: "$15.00" }, availability: { state: "available" as const, message: "2 available", maxQuantity: 2 }, canAddToCart: true,
            selectOption, setQuantity, addToCart, relatedProducts: [{ id: "related", name: "Related cake", href: "/products/related", imageUrl: "", price: "$10.00" }],
          },
        },
      },
    };
    render(<>
      <RegistrySectionRenderer section={section("product-gallery")} mode="published" commerce={commerce} page={page} />
      <RegistrySectionRenderer section={section("product-information")} mode="published" commerce={commerce} page={page} />
      <RegistrySectionRenderer section={section("product-options")} mode="published" commerce={commerce} page={page} />
      <RegistrySectionRenderer section={section("product-purchase")} mode="published" commerce={commerce} page={page} />
      <RegistrySectionRenderer section={section("product-description")} mode="published" commerce={commerce} page={page} />
      <RegistrySectionRenderer section={section("related-products")} mode="published" commerce={commerce} page={page} />
    </>);

    expect(screen.getByRole("img", { name: "Celebration cake" })).toBeInTheDocument();
    expect(screen.getByText("$15.00")).toBeInTheDocument();
    expect(screen.getByText("Vanilla sponge")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(addToCart).toHaveBeenCalledOnce();
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

  it("renders Collection merchandising from live detail with section presentation settings", () => {
    const page = { pageType: "collection" as const, resource: { id: "collection-a", handle: "cakes", data: {
      collectionPresentation: { collection: { id: "collection-a", title: "Fresh cakes", description: "Baked today", imageUrl: "/cakes.jpg" }, products: [
        { id: "one", name: "One", href: "/products/one", imageUrl: "", price: "$10.00" },
        { id: "two", name: "Two", href: "/products/two", imageUrl: "", price: "$20.00" },
      ], totalProducts: 2 },
    } } };
    render(<>
      <RegistrySectionRenderer section={{ ...section("collection-header"), settings: { showTitle: true, showDescription: false, showImage: true } }} mode="published" commerce={commerce} page={page} />
      <RegistrySectionRenderer section={{ ...section("collection-product-grid"), settings: { columns: 2, limit: 1 } }} mode="published" commerce={commerce} page={page} />
      <RegistrySectionRenderer section={{ ...section("collection-description"), settings: { spacing: "compact" } }} mode="published" commerce={commerce} page={page} />
    </>);

    expect(screen.getByRole("heading", { name: "Fresh cakes" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Fresh cakes" })).toHaveAttribute("src", "/cakes.jpg");
    expect(screen.getByText("Baked today")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /one/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /two/i })).toBeNull();
    expect(screen.getByTestId("collection-product-grid-items")).toHaveAttribute("data-columns", "2");
  });

  it("renders configured empty copy without inventing missing Collection content", () => {
    const page = { pageType: "collection" as const, resource: { id: "empty", handle: "empty", data: { collectionPresentation: { collection: { id: "empty", title: "Empty", description: "" }, products: [], totalProducts: 0 } } } };
    render(<>
      <RegistrySectionRenderer section={section("collection-header")} mode="published" commerce={commerce} page={page} />
      <RegistrySectionRenderer section={{ ...section("collection-product-grid"), settings: { emptyMessage: "Coming soon" } }} mode="published" commerce={commerce} page={page} />
      <RegistrySectionRenderer section={section("collection-description")} mode="published" commerce={commerce} page={page} />
    </>);

    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText("undefined")).toBeNull();
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

  it("renders Blog title and live Article links from runtime context", () => {
    render(<>
      <RegistrySectionRenderer section={section("blog-header")} mode="published" commerce={commerce} page={{ pageType: "blog", resource: { id: "blog-a", handle: "news", data: { storeSlug: "store-a", blog: { id: "blog-a", title: "News", handle: "news" }, articles: [{ id: "article-a", title: "Opening day", handle: "opening-day", excerpt: "We opened", publishedAt: "2026-09-20T00:00:00.000Z" }] } } }} />
      <RegistrySectionRenderer section={section("article-list")} mode="published" commerce={commerce} page={{ pageType: "blog", resource: { id: "blog-a", handle: "news", data: { storeSlug: "store-a", blog: { id: "blog-a", title: "News", handle: "news" }, articles: [{ id: "article-a", title: "Opening day", handle: "opening-day", excerpt: "We opened", publishedAt: "2026-09-20T00:00:00.000Z" }] } } }} />
    </>);
    expect(screen.getByRole("heading", { name: "News" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /opening day/i })).toHaveAttribute("href", "/store-a/blogs/news/opening-day");
  });

  it("renders Article identity and safe live content without raw HTML", () => {
    const page = { pageType: "article" as const, resource: { id: "article-a", handle: "opening", data: { blog: { id: "blog-a", handle: "news", title: "News" }, article: { id: "article-a", title: "Opening day", excerpt: "We opened", publishedAt: "2026-09-20T00:00:00.000Z", content: { text: "Welcome to our shop.", html: "<script>unsafe</script>" } } } } };
    render(<><RegistrySectionRenderer section={section("article-header")} mode="published" commerce={commerce} page={page} /><RegistrySectionRenderer section={section("article-content")} mode="published" commerce={commerce} page={page} /></>);
    expect(screen.getByRole("heading", { name: "Opening day" })).toBeInTheDocument();
    expect(screen.getByText("We opened")).toBeInTheDocument();
    expect(screen.getByText("Welcome to our shop.")).toBeInTheDocument();
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
