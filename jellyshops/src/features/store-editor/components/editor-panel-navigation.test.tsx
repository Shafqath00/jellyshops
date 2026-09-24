import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditorPanelNavigation } from "./editor-panel-navigation";

describe("EditorPanelNavigation", () => {
  it("offers one clearly selected Sections, Preview, or Settings panel", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<EditorPanelNavigation value="sections" onChange={onChange} />);

    expect(screen.getByRole("navigation", { name: "Editor panels" })).toHaveClass("bg-[var(--white)]", "border-[var(--line)]");
    expect(screen.getByRole("button", { name: "Sections" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Settings" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(onChange).toHaveBeenCalledWith("preview");
    rerender(<EditorPanelNavigation value="preview" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "true");
  });
});
