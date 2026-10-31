import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { createSectionFromDefinition, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";
import { LogoListSection } from "./sections/logo-list";
import type { StorefrontRuntimeContext } from "./runtime-context";
import { defaultSectionRenderRegistry } from "./render-registry";

const context = (storeSlug?: string): StorefrontRuntimeContext => ({ mode: "published", commerce: { getProducts: async () => [] }, storeSlug });
const logo = (id: string, settings: Record<string, unknown>, enabled = true) => ({ id, type: "logo", enabled, settings });
const section = (blocks: SectionNode["blocks"], settings: Record<string, unknown> = {}): SectionNode => ({ id: "logos", type: "logo-list", enabled: true, settings: { heading: "As featured in", logoHeight: 64, ...settings }, blocks });

it("shows logo images with their names, links inside the store and text for logos without an image", () => {
  render(<LogoListSection section={section([
    logo("a", { image: { url: "https://cdn.test/acme.png" }, label: "Acme", link: "/pages/press" }),
    logo("b", { label: "Globex" }),
    logo("c", { label: "Hidden" }, false),
    logo("d", {}),
  ], { grayscale: true })} context={context("demo")} />);
  expect(screen.getByRole("heading", { name: "As featured in" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Acme" })).toHaveAttribute("src", "https://cdn.test/acme.png");
  expect(screen.getByRole("link", { name: "Acme" })).toHaveAttribute("href", "/demo/pages/press");
  expect(screen.getByText("Globex")).toBeInTheDocument();
  expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  const wrapper = document.querySelector(".jelly-logo-list") as HTMLElement;
  expect(wrapper).toHaveAttribute("data-grayscale", "true");
  expect(wrapper.style.getPropertyValue("--logo-height")).toBe("64px");
});

it("stays hidden on the live store without logos and shows a hint in the editor", () => {
  const { container, rerender } = render(<LogoListSection section={section([])} context={context()} />);
  expect(container).toBeEmptyDOMElement();
  rerender(<LogoListSection section={section([])} context={context()} mode="editor" />);
  expect(screen.getByText(/Add a logo block/)).toBeInTheDocument();
});

it("makes logos selectable in the editor", () => {
  render(<LogoListSection section={section([logo("a", { label: "Acme" })])} context={context()} mode="editor" selectedBlockId="a" />);
  expect(screen.getByText("Acme").closest("li")).toHaveAttribute("data-editor-block-selected", "true");
});

it("is registered, and a new Logo list section with a logo passes validation", () => {
  expect(defaultSectionRenderRegistry.has("logo-list")).toBe(true);
  let next = 0;
  const created = createSectionFromDefinition("logo-list", () => `id-${next++}`);
  const withLogo = { ...created, blocks: [logo("a", { label: "Acme", image: { url: "https://cdn.test/acme.png" }, link: "/shop" })] };
  expect(validateSectionAgainstRegistry(withLogo, "home")).toEqual([]);
});
