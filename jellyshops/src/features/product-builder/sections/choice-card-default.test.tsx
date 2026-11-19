import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProductOption } from "@/lib/domain";
import { ChoiceCard } from "./choice-card";

const size: ProductOption = {
  id: "size", name: "Size", type: "variant", display: "buttons", required: true, position: 0,
  values: ["Single", "Double", "King"].map((label, position) => ({ id: label.toLowerCase(), label, position, priceAdjustmentMinor: 0 })),
};

describe("Selected when the page opens", () => {
  it("marks one value as the default and clears it again", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<ChoiceCard option={size} index={0} count={1} onChange={onChange} onRemove={() => undefined} onMove={() => undefined} />);
    await user.selectOptions(screen.getByLabelText("Selected when the page opens"), "double");
    const marked = onChange.mock.calls.at(-1)![0] as ProductOption;
    expect(marked.values.filter((value) => value.isDefault).map((value) => value.id)).toEqual(["double"]);
    rerender(<ChoiceCard option={marked} index={0} count={1} onChange={onChange} onRemove={() => undefined} onMove={() => undefined} />);
    await user.selectOptions(screen.getByLabelText("Selected when the page opens"), "");
    expect((onChange.mock.calls.at(-1)![0] as ProductOption).values.some((value) => value.isDefault)).toBe(false);
  });

  it("is not offered for extras shoppers can pick several of", () => {
    render(<ChoiceCard option={{ ...size, type: "addon", required: false, multiple: true }} index={0} count={1} onChange={() => undefined} onRemove={() => undefined} onMove={() => undefined} />);
    expect(screen.queryByLabelText("Selected when the page opens")).toBeNull();
  });
});
