import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeSettingsPanel } from "./theme-settings-panel";

const schema = [
  { id: "colors.accent", type: "color" as const, label: "Accent color", default: "#315e24", group: "Colors" },
  { id: "layout.containerWidth", type: "select" as const, label: "Page width", default: "standard", group: "Layout", options: [{ value: "standard", label: "Standard" }, { value: "wide", label: "Wide" }] },
];

describe("ThemeSettingsPanel", () => {
  it("renders manifest-defined controls and emits stable setting paths", async () => {
    const onChange = vi.fn();
    render(<ThemeSettingsPanel schema={schema} settings={{ colors: { accent: "#a75b38" }, layout: { containerWidth: "standard" } }} saving={false} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText("Page width"), "wide");
    expect(screen.getByLabelText("Accent color picker")).toHaveValue("#a75b38");
    expect(onChange).toHaveBeenCalledWith("layout.containerWidth", "wide");
  });
});
