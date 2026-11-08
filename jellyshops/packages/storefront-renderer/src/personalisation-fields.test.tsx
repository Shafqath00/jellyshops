import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { PersonalisationFields } from "./sections/personalisation-fields";

const noViolations = async (container: HTMLElement) => (await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => violation.id);

describe("personalisation fields", () => {
  it("labels each field, counts characters, shows problems and passes typing on", async () => {
    const setValue = vi.fn();
    const { container } = render(<PersonalisationFields personalisation={{
      fields: [{ id: "engraving", label: "Engraving", required: true, maxLength: 12, helpText: "Capital letters only", priceAdjustment: "£5.00" }, { id: "note", label: "Gift message", required: false, maxLength: 200, multiline: true }],
      values: { engraving: "SAM" }, setValue, problems: { engraving: "Engraving can be at most 12 characters." },
    }} />);
    const engraving = screen.getByLabelText(/Engraving/);
    expect(engraving).toHaveAttribute("maxlength", "12");
    expect(engraving).toHaveAttribute("aria-invalid", "true");
    expect(container).toHaveTextContent("+£5.00");
    expect(container).toHaveTextContent("3/12");
    expect(screen.getByRole("alert")).toHaveTextContent("at most 12");
    expect(screen.getByLabelText(/Gift message/).tagName).toBe("TEXTAREA");
    fireEvent.change(engraving, { target: { value: "SAMI" } });
    expect(setValue).toHaveBeenCalledWith("engraving", "SAMI");
    expect(await noViolations(container)).toEqual([]);
  });
});
