import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { RegistrySectionRenderer } from "./registry-section-renderer";

const commerce = { getProducts: async () => [] };
const section = (customCss?: string): SectionNode => ({ id: "story-1", type: "rich-text", enabled: true, settings: customCss === undefined ? {} : { customCss }, blocks: [{ id: "h", type: "heading", enabled: true, settings: { text: "Our story" } }] });

it("adds the section's custom CSS, limited to that section, in the preview and on the live store", () => {
  for (const mode of ["published", "editor"] as const) {
    const { container, unmount } = render(<RegistrySectionRenderer section={section("h2 { letter-spacing: 0.1em } & { border: 1px solid }")} mode={mode} commerce={commerce} />);
    const wrapper = container.querySelector("[data-section-css='story-1']");
    expect(wrapper).not.toBeNull();
    expect(wrapper!.querySelector("style")!.innerHTML).toBe('[data-section-css="story-1"] h2{letter-spacing: 0.1em}\n[data-section-css="story-1"]{border: 1px solid}');
    unmount();
  }
});

it("adds nothing for sections without custom CSS or with CSS that isn't allowed", () => {
  for (const css of [undefined, "", "p { color: red } </style><script>alert(1)</script>"]) {
    const { container, unmount } = render(<RegistrySectionRenderer section={section(css)} mode="published" commerce={commerce} />);
    expect(container.querySelector("style")).toBeNull();
    expect(container.querySelector("[data-section-css]")).toBeNull();
    unmount();
  }
});

it("adds the theme's custom CSS, and the footer falls back to the theme's social links", async () => {
  const { ThemeCustomCss } = await import("./section-custom-css");
  const { withStoreIdentity } = await import("./store-identity");
  const css = render(<ThemeCustomCss settings={{ advanced: { customCss: "body { margin: 0 }" } }} />);
  expect(css.container.querySelector("style[data-theme-css]")!.innerHTML).toBe("[data-jelly-theme] body{margin: 0}");
  css.unmount();
  const socialLinks = [{ id: "instagram", label: "Instagram", href: "https://instagram.com/shop" }];
  const footer: SectionNode = { id: "f", type: "footer", enabled: true, settings: {}, blocks: [] };
  const plain = render(<RegistrySectionRenderer section={withStoreIdentity(footer, { name: "Shop", socialLinks })} mode="published" commerce={commerce} region="footer" />);
  expect(plain.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/shop");
  plain.unmount();
  const own: SectionNode = { ...footer, blocks: [{ id: "s", type: "social-link", enabled: true, settings: { label: "TikTok", href: "https://tiktok.com/@shop" } }] };
  const withBlocks = render(<RegistrySectionRenderer section={withStoreIdentity(own, { name: "Shop", socialLinks })} mode="published" commerce={commerce} region="footer" />);
  expect(withBlocks.queryByRole("link", { name: "Instagram" })).toBeNull();
  expect(withBlocks.getByRole("link", { name: "TikTok" })).toBeInTheDocument();
});
