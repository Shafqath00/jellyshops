import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TemplateHierarchy } from "./template-hierarchy";

const template = {
  id: "product-featured",
  type: "product" as const,
  handle: "featured",
  name: "Featured product",
  layout: {
    sections: [
      {
        kind: "inline",
        section: {
          id: "hero-1",
          type: "hero",
          enabled: true,
          settings: {},
          blocks: [],
        },
      },
      { kind: "global", globalSectionId: "global-promo" },
    ],
  },
};

describe("TemplateHierarchy", () => {
  it("renders only placements from the active template", () => {
    render(
      <TemplateHierarchy
        template={template}
        globalSections={{ "global-promo": { id: "global-promo", name: "Summer promo" } }}
        selection={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Hero")).toBeVisible();
    expect(screen.getByText("Summer promo")).toBeVisible();
    expect(screen.getByText("Global")).toBeVisible();
  });

  it("selects a section from the active template without page-level mutation", async () => {
    const onSelect = vi.fn();
    render(
      <TemplateHierarchy
        template={template}
        globalSections={{ "global-promo": { id: "global-promo", name: "Summer promo" } }}
        selection={null}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Hero" }));

    expect(onSelect).toHaveBeenCalledWith({ kind: "section", region: "template", sectionId: "hero-1" });
  });
});
