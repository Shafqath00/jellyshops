import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ThemeLibraryPanel, type ThemeLookItem } from "./theme-library-panel";

const look: ThemeLookItem = { id: "look-1", name: "Winter sale", themeId: "jelly-avenue", themeVersion: "1.0.0", settings: { colors: { primary: "#112233" } } };
const handlers = () => ({ onSave: vi.fn(), onApply: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() });
const show = (looks: ThemeLookItem[], extra = {}) => {
  const fns = handlers();
  render(<ThemeLibraryPanel looks={looks} currentThemeName="Jelly Minimal" themeName={(id) => id === "jelly-avenue" ? "Jelly Avenue" : id} {...fns} {...extra} />);
  return fns;
};

it("saves the current look under a name, and explains an empty library", async () => {
  const fns = show([]);
  expect(screen.getByText("No saved looks yet.")).toBeInTheDocument();
  const save = screen.getByRole("button", { name: "Save current look" });
  expect(save).toBeDisabled();
  await userEvent.type(screen.getByLabelText("Name for this look"), "  Spring  ");
  await userEvent.click(save);
  expect(fns.onSave).toHaveBeenCalledWith("Spring");
  expect(screen.getByLabelText("Name for this look")).toHaveValue("");
});

it("applies and deletes a look only after confirming, and renames it inline", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
  const fns = show([look]);
  expect(screen.getByText("Jelly Avenue")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Apply Winter sale" }));
  expect(fns.onApply).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Apply Winter sale" }));
  expect(fns.onApply).toHaveBeenCalledWith(look);
  await userEvent.click(screen.getByRole("button", { name: "Delete Winter sale" }));
  expect(fns.onDelete).toHaveBeenCalledWith(look);
  await userEvent.click(screen.getByRole("button", { name: "Rename Winter sale" }));
  const box = screen.getByLabelText("New name for Winter sale");
  await userEvent.clear(box);
  await userEvent.type(box, "Winter");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(fns.onRename).toHaveBeenCalledWith(look, "Winter");
  confirm.mockRestore();
});

it("shows an error and locks the buttons while busy", () => {
  show([look], { error: "You can keep up to 20 saved looks.", busy: true });
  expect(screen.getByRole("alert")).toHaveTextContent("up to 20");
  expect(screen.getByRole("button", { name: "Apply Winter sale" })).toBeDisabled();
});
