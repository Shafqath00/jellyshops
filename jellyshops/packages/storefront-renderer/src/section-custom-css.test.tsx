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
