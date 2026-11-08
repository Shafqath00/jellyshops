import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { EditorPanelNavigation } from "./editor-panel-navigation";
it("returns to the active editor panel after previewing", async () => {
  const onChange = vi.fn();
  const { rerender } = render(<EditorPanelNavigation value="settings" editPanel="settings" onChange={onChange} />);
  expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(onChange).toHaveBeenCalledWith("preview");
  rerender(<EditorPanelNavigation value="preview" editPanel="settings" onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  expect(onChange).toHaveBeenLastCalledWith("settings");
});
