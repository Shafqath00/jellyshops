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
