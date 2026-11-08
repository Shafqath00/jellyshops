import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { createStorefrontRuntimeContext } from "./runtime-context";
import { ProductSpecificationsSection } from "./sections/product-extras";
import { mapHref, StoreVisitSection } from "./sections/store-visit";
import type { StorefrontPageContext } from "./types";

const block = (id: string, type: string, settings: Record<string, unknown>, enabled = true) => ({ id, type, enabled, settings });
const section = (type: string, settings: Record<string, unknown>, blocks: SectionNode["blocks"] = []): SectionNode => ({ id: `${type}-1`, type, enabled: true, settings, blocks });
const productPage = (specifications: unknown) => ({ pageType: "product", resource: { id: "p", handle: "p", data: { productPresentation: { product: { title: "Oak bed", specifications } } } } }) as unknown as StorefrontPageContext;
const contextFor = (page?: StorefrontPageContext) => createStorefrontRuntimeContext({ mode: "published", region: "template", commerce: { async getProducts() { return []; } }, page });
const rows = (container: HTMLElement) => [...container.querySelectorAll(".jelly-specifications-list > div")].map((row) => [row.querySelector("dt")?.textContent, row.querySelector("dd")?.textContent]);

describe("specifications", () => {
  const fixed = [
    block("w", "spec-row", { label: "Warranty", value: "10 years" }),
    block("t", "spec-row", { label: "Size", value: "Ignored: the product has its own size" }),
    block("off", "spec-row", { label: "Trial", value: "100 nights" }, false),
    block("blank", "spec-row", { label: "Empty", value: "  " }),
  ];

  it("lists the product's own specifications first, then fixed rows, without duplicate names", () => {
    const { container } = render(<ProductSpecificationsSection section={section("product-specifications", { heading: "Bed details" }, fixed)} context={contextFor(productPage({ Size: "King, 150 × 200 cm", Firmness: "Medium", "": "skipped", Height: 42 }))} />);

    expect(screen.getByRole("heading", { name: "Bed details" })).toBeInTheDocument();
    expect(rows(container)).toEqual([["Size", "King, 150 × 200 cm"], ["Firmness", "Medium"], ["Warranty", "10 years"]]);
  });

  it("can leave out the product's own rows and show the list in an expandable panel", () => {
    const { container } = render(<ProductSpecificationsSection section={section("product-specifications", { showProductSpecifications: false, layout: "expandable" }, fixed)} context={contextFor(productPage({ Size: "King" }))} />);
    const panel = container.querySelector("details")!;

    expect(within(panel).getByText("Specifications")).toBeInTheDocument();
    expect(panel.open).toBe(false);
    expect(rows(container)).toEqual([["Warranty", "10 years"], ["Size", "Ignored: the product has its own size"]]);
  });

  it("renders nothing when there is nothing to list or the page is not a product", () => {
    const { container, rerender } = render(<ProductSpecificationsSection section={section("product-specifications", {})} context={contextFor(productPage({}))} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ProductSpecificationsSection section={section("product-specifications", {})} context={contextFor()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("hides the heading when the merchant clears it", () => {
    render(<ProductSpecificationsSection section={section("product-specifications", { heading: "" }, fixed)} context={contextFor()} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("store visit", () => {
  const visit = (settings: Record<string, unknown>, blocks: SectionNode["blocks"] = []) => section("contact-store-info", settings, blocks);

  it("shows the address, opening hours and one-tap contact buttons", () => {
    render(<StoreVisitSection section={visit({
      heading: "Visit our showroom",
      address: "12 High Street\nLeeds LS1 4AB",
      hours: "Mon–Fri: 10am–7pm\nSun: closed\nBank holidays by appointment",
      phone: "+44 113 496 0000",
      whatsapp: "+44 7700 900123",
      email: "hello@example.com",
    }, [block("c", "contact-item", { label: "Parking", value: "Free at the rear" })])} />);

    expect(screen.getByRole("heading", { name: "Visit our showroom" })).toBeInTheDocument();
    expect(screen.getByText("Leeds LS1 4AB")).toBeInTheDocument();
    expect(screen.getByText("Mon–Fri").nextSibling).toHaveTextContent("10am–7pm");
    expect(screen.getByText("Bank holidays by appointment")).toBeInTheDocument();
    expect(screen.getByText("Free at the rear")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=12%20High%20Street%20Leeds%20LS1%204AB");
    expect(screen.getByRole("link", { name: "Call +44 113 496 0000" })).toHaveAttribute("href", "tel:+441134960000");
    expect(screen.getByRole("link", { name: "Message on WhatsApp" })).toHaveAttribute("href", "https://wa.me/447700900123");
    expect(screen.getByRole("link", { name: "Email hello@example.com" })).toHaveAttribute("href", "mailto:hello@example.com");
  });

  it("leaves out anything the merchant hasn't filled in", () => {
    render(<StoreVisitSection section={visit({ hours: "Every day: 9am–5pm", email: "not an email" })} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByText("Every day")).toBeInTheDocument();
  });

  it("renders nothing when every detail is empty", () => {
    const { container } = render(<StoreVisitSection section={visit({ heading: "Visit us" })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses the merchant's own map link only when it is a web address", () => {
    expect(mapHref("https://maps.app.goo.gl/abc", "12 High Street")).toBe("https://maps.app.goo.gl/abc");
    expect(mapHref("javascript:alert(1)", "12 High Street")).toBe("https://www.google.com/maps/search/?api=1&query=12%20High%20Street");
    expect(mapHref("", "")).toBeUndefined();
  });
});
