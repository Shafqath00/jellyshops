import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "./runtime-context";
import type { RendererMode } from "./types";
import { FooterSection } from "./sections/footer";
import { FaqSection } from "./sections/home-sections";
import { ProductSpecificationsSection, ProductTabsSection } from "./sections/product-extras";
import { ProductGridSection } from "./sections/product-grid";
import { StoreVisitSection } from "./sections/store-visit";

const context = (mode: RendererMode): StorefrontRuntimeContext => ({ mode, commerce: { getProducts: async () => [] }, storeSlug: "demo" });
const section = (type: string, blocks: Array<[string, string, Record<string, unknown>]>, settings: Record<string, unknown> = {}): SectionNode =>
  ({ id: type, type, enabled: true, settings, blocks: blocks.map(([id, blockType, blockSettings]) => ({ id, type: blockType, enabled: true, settings: blockSettings })) });
const selectable = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>("[data-editor-block-id]")].map((element) => element.dataset.editorBlockId);

const footer = section("footer", [
  ["heading", "link-heading", { text: "Help" }],
  ["link", "link", { label: "Contact", link: "/contact" }],
  ["contact", "contact-item", { label: "Email", value: "hi@shop.test" }],
  ["social", "social-link", { label: "Instagram", href: "https://instagram.com/shop" }],
]);
const cases: Array<[string, (mode: RendererMode) => ReactElement, string[]]> = [
  ["footer", (mode) => <FooterSection section={footer} context={context(mode)} mode={mode} />, ["heading", "link", "contact", "social"]],
  ["FAQ", (mode) => <FaqSection section={section("faq", [["q", "faq-item", { question: "Delivery?", answer: "Two days." }]])} editor={mode === "editor"} />, ["q"]],
  ["product info tabs", (mode) => <ProductTabsSection section={section("product-tabs", [["tab", "info-tab", { title: "Care", text: "Wash cold." }]])} editor={mode === "editor"} />, ["tab"]],
  ["specifications", (mode) => <ProductSpecificationsSection section={section("product-specifications", [["row", "spec-row", { label: "Warranty", value: "10 years" }]], { showProductSpecifications: false })} context={context(mode)} />, ["row"]],
  ["product list tabs", (mode) => <ProductGridSection commerce={{ getProducts: async () => [] }} section={section("product-grid", [["new", "product-tab", { label: "New" }], ["best", "product-tab", { label: "Best" }]])} editor={mode === "editor"} />, ["new", "best"]],
  ["store visit", (mode) => <StoreVisitSection section={section("contact-store-info", [["detail", "contact-item", { label: "Parking", value: "Free" }]], { address: "1 High St" })} editor={mode === "editor"} />, ["detail"]],
];

describe("blocks can be picked in the editor preview", () => {
  it.each(cases)("%s", (_name, view, ids) => {
    const editor = render(view("editor"));
    expect(selectable(editor.container)).toEqual(ids);
    editor.unmount();
    // Shoppers never see editor attributes.
    expect(selectable(render(view("published")).container)).toEqual([]);
  });
});
