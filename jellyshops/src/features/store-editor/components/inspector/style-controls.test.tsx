import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OptionalColorControl, SliderNumberControl } from "./style-controls";

describe("SliderNumberControl", () => {
  it("saves an exact number, keeps it in range and resets to the theme's value", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<SliderNumberControl label="Top" value={undefined} min={0} max={100} step={1} unit="px" onChange={onChange} />);
    expect(screen.getByLabelText("Top")).toHaveAttribute("placeholder", "Auto");
    await userEvent.setup().type(screen.getByLabelText("Top"), "250{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.change(screen.getByLabelText("Top slider"), { target: { value: "24" } });
    expect(onChange).toHaveBeenLastCalledWith(24);
    rerender(<SliderNumberControl label="Top" value={24} min={0} max={100} step={1} unit="px" onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Reset Top" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});

describe("OptionalColorControl", () => {
  it("shows Default when empty and clears back to it", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<OptionalColorControl label="Text colour" value={undefined} onChange={onChange} />);
    expect(screen.getByLabelText("Text colour")).toHaveValue("");
    expect(screen.getByLabelText("Text colour")).toHaveAttribute("placeholder", "Default");
    await userEvent.setup().type(screen.getByLabelText("Text colour"), "AA0000{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("#aa0000");
    rerender(<OptionalColorControl label="Text colour" value="#aa0000" onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Clear Text colour" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
