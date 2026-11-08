import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { PersonalisationField } from "@jelly/storefront-schema";
import { PersonalisationSection } from "./personalisation-section";

function Harness({ start = [] as PersonalisationField[] }) {
  const [fields, setFields] = useState(start);
  return <><PersonalisationSection fields={fields} onChange={setFields} /><output data-testid="state">{JSON.stringify(fields)}</output></>;
}

describe("personalisation section", () => {
  it("adds a field, asks for its name, and saves the settings", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText(/Shoppers buy this product as it is/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add a personalisation field" }));
    expect(screen.getByText("Give this field a name.")).toBeVisible();
    await user.type(screen.getByLabelText("What to ask for"), "Engraving");
    await user.click(screen.getByLabelText("Shoppers must fill this in"));
    await user.clear(screen.getByLabelText("Most characters"));
    await user.type(screen.getByLabelText("Most characters"), "12");
    await user.tab();
    await user.type(screen.getByLabelText("Extra price (optional)"), "5");
    await user.tab();
    const saved = JSON.parse(screen.getByTestId("state").textContent ?? "[]")[0];
    expect(saved).toMatchObject({ label: "Engraving", required: true, maxLength: 12, priceAdjustmentMinor: 500 });
    await user.click(screen.getByRole("button", { name: "Remove Engraving" }));
    expect(screen.getByTestId("state")).toHaveTextContent("[]");
  });

  it("stops at five fields", () => {
    render(<Harness start={Array.from({ length: 5 }, (_, index) => ({ id: `f${index}`, label: `Field ${index}`, required: false, maxLength: 10 }))} />);
    expect(screen.queryByRole("button", { name: "Add a personalisation field" })).toBeNull();
    expect(screen.getByText("Up to 5 fields per product.")).toBeVisible();
  });
});
