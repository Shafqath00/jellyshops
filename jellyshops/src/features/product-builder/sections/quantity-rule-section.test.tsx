import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuantityRuleSection } from "./quantity-rule-section";

describe("QuantityRuleSection", () => {
  it("says there are no rules until the merchant sets one", () => {
    render(<QuantityRuleSection rule={null} onChange={vi.fn()} />);
    expect(screen.getByText("No rules. Shoppers can buy any quantity.")).toBeInTheDocument();
  });

  it("sets steps and clears the rule when everything is back to 1", () => {
    const onChange = vi.fn();
    const { rerender } = render(<QuantityRuleSection rule={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Sold in steps of"), { target: { value: "6" } });
    expect(onChange).toHaveBeenLastCalledWith({ min: 1, step: 6 });
    rerender(<QuantityRuleSection rule={{ min: 6, step: 6 }} onChange={onChange} />);
    expect(screen.getByText("Shoppers see: Sold in steps of 6.")).toBeInTheDocument();
    rerender(<QuantityRuleSection rule={{ min: 1, step: 6 }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Sold in steps of"), { target: { value: "1" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("explains a minimum that does not fit the steps", () => {
    render(<QuantityRuleSection rule={{ min: 4, step: 6 }} onChange={vi.fn()} />);
    expect(screen.getByText("The minimum must be a multiple of the step (6).")).toBeInTheDocument();
    expect(screen.getByLabelText("Minimum order")).toHaveAttribute("aria-invalid", "true");
  });
});
