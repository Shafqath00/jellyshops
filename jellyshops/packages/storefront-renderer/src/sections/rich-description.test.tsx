import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RichTextDocument } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { ProductDescriptionSection } from "./product-sections";
import { renderBlocks } from "./rich-text";

const text = (value: string, marks?: Array<{ type: "bold" | "underline" }>) => ({ type: "text" as const, text: value, ...(marks ? { marks } : {}) });

const document: RichTextDocument = { type: "doc", content: [
  { type: "heading", attrs: { level: 2, textAlign: "center" }, content: [text("Fabric")] },
  { type: "paragraph", attrs: { textAlign: "right" }, content: [text("Soft", [{ type: "underline" }]), text(" cotton", [{ type: "bold" }])] },
  { type: "table", content: [
    { type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [text("Size")] }] }, { type: "tableHeader", content: [{ type: "paragraph", content: [text("Chest")] }] }] },
    { type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [text("M")] }] }, { type: "tableCell", content: [{ type: "paragraph", content: [text("40 in")] }] }] },
  ] },
] };

function productContext(product: Record<string, unknown>): StorefrontRuntimeContext {
  return { page: { pageType: "product", resource: { data: { productPresentation: { product: { title: "Tee", ...product }, addToCart: () => undefined } } } } } as unknown as StorefrontRuntimeContext;
}

describe("rich description rendering", () => {
  it("renders underline, alignment and tables as real elements", () => {
    const { container } = render(<div>{renderBlocks(document.content)}</div>);
    expect(container.querySelector("h2")).toHaveStyle({ textAlign: "center" });
    expect(container.querySelector("p")).toHaveStyle({ textAlign: "right" });
    expect(container.querySelector("u")).toHaveTextContent("Soft");
    expect(container.querySelector("strong")).toHaveTextContent("cotton");
    expect(container.querySelectorAll("th")).toHaveLength(2);
    expect(container.querySelector("th")).toHaveAttribute("scope", "col");
    expect(container.querySelectorAll("td")).toHaveLength(2);
  });

  it("shows the formatted description on the product page, and never as raw markup", () => {
    const hostile = { type: "doc", content: [{ type: "paragraph", content: [text("<img src=x onerror=alert(1)>")] }, { type: "script", content: [] }] };
    const { container } = render(<ProductDescriptionSection context={productContext({ description: "plain", descriptionDoc: hostile })} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container).toHaveTextContent("<img src=x onerror=alert(1)>");
  });

  it("renders the document when there is one", () => {
    render(<ProductDescriptionSection context={productContext({ description: "Fabric\n\nSoft cotton", descriptionDoc: document })} />);
    expect(screen.getByRole("heading", { name: "Fabric" })).toBeVisible();
    expect(screen.getByRole("table")).toBeVisible();
  });

  it("falls back to the plain description for products without rich text", () => {
    const { container } = render(<ProductDescriptionSection context={productContext({ description: "First\n\nSecond", descriptionDoc: null })} />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("renders nothing when there is no description at all", () => {
    const { container } = render(<ProductDescriptionSection context={productContext({ description: "", descriptionDoc: null })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
