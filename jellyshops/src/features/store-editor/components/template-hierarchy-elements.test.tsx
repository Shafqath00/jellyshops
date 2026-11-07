import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TemplateHierarchy } from "./template-hierarchy";

const template = {
  id: "home",
  name: "Home page",
  layout: { sections: [{ kind: "inline", section: { id: "grid-1", type: "product-grid", enabled: true, settings: { heading: "New in", text: "", viewAllLabel: "" }, blocks: [] } }] },
};

describe("TemplateHierarchy section parts", () => {
  it("lists the parts that have content, selects one, and marks it as current", async () => {
    const onSelect = vi.fn();
    const view = render(<TemplateHierarchy template={template} globalSections={{}} selection={{ kind: "section", region: "template", sectionId: "grid-1", elementId: "heading" }} onSelect={onSelect} />);
    // Heading has text and product cards always show; the empty intro and View all link are left out.
    expect(screen.getByRole("button", { name: /^Heading \(part of/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /^Product card \(part of/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Text \(part of/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^View all link/ })).toBeNull();
    // The section row itself is not current while one of its parts is selected.
    expect(view.container.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /^Product card \(part of/ }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "section", region: "template", sectionId: "grid-1", elementId: "productCard" });
  });
});
