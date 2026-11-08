import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductOption, ProductVariant } from "@/lib/domain";
import { VariantsSection } from "../sections/variants-section";
import type { MetafieldDefinition } from "./api";
import type { OwnerKey, ProductMetafields } from "./use-product-metafields";

afterEach(cleanup);

const options: ProductOption[] = [{ id: "size", name: "Size", type: "variant", required: true, position: 0, values: [{ id: "s", label: "S", position: 0 }, { id: "m", label: "M", position: 1 }] } as never];
const variants: ProductVariant[] = [{ id: "v-s", name: "S", sku: "", priceMinor: 1000, stock: 5, options: { size: "s" } }, { id: "v-m", name: "M", sku: "", priceMinor: 1000, stock: 5, options: { size: "m" } }];
const weave: MetafieldDefinition = { id: "def-weave", ownerType: "variant", namespace: "custom", key: "weave", name: "Weave", type: "string", storefrontVisible: false };

/** A stand-in for the saved-state hook that keeps values in plain state and records what was set. */
function Harness({ definitions, setValue }: { definitions: MetafieldDefinition[]; setValue: (owner: OwnerKey, id: string, value: unknown) => void }) {
  const [values, setValues] = useState<Record<string, unknown>>({ "variant:v-s|def-weave": "Twill" });
  const custom = {
    loading: false, loadError: "", productDefinitions: [], variantDefinitions: definitions, dirty: false, reset() {}, clear() {}, saveAll: async () => ({ ok: true }), createDefinition: async () => weave,
    valueOf: (owner: OwnerKey, id: string) => values[`${owner}|${id}`],
    problemFor: (owner: OwnerKey, id: string) => owner === "variant:v-m" && id === "def-weave" ? "Weave: Choose one of the allowed values." : undefined,
    setValue: (owner: OwnerKey, id: string, value: unknown) => { setValue(owner, id, value); setValues((current) => ({ ...current, [`${owner}|${id}`]: value })); },
  } as unknown as ProductMetafields;
  return <VariantsSection options={options} variants={variants} currency="GBP" onChange={() => {}} custom={custom} customContext={{ storeId: "store-a", currency: "GBP", lookups: null }} />;
}

describe("custom data for a combination", () => {
  it("shows the combination's own values in its details", async () => {
    const user = userEvent.setup();
    render(<Harness definitions={[weave]} setValue={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Show details for S" }));
    expect(screen.getByText("Custom data for S")).toBeVisible();
    expect(screen.getByLabelText("Weave")).toHaveValue("Twill");
    await user.click(screen.getByRole("button", { name: "Hide details for S" }));
    await user.click(screen.getByRole("button", { name: "Show details for M" }));
    expect(screen.getByLabelText("Weave")).toHaveValue("");
  });

  it("sets a value for that combination only", async () => {
    const user = userEvent.setup();
    const setValue = vi.fn();
    render(<Harness definitions={[weave]} setValue={setValue} />);
    await user.click(screen.getByRole("button", { name: "Show details for M" }));
    await user.type(screen.getByLabelText("Weave"), "Plain");
    expect(setValue).toHaveBeenLastCalledWith("variant:v-m", "def-weave", "Plain");
    expect(setValue.mock.calls.every(([owner]) => owner === "variant:v-m")).toBe(true);
  });

  it("shows the reason a value was refused next to the field", async () => {
    const user = userEvent.setup();
    render(<Harness definitions={[weave]} setValue={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Show details for M" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Weave: Choose one of the allowed values.");
    expect(screen.getByLabelText("Weave")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows nothing extra when the store has no combination fields", async () => {
    const user = userEvent.setup();
    render(<Harness definitions={[]} setValue={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Show details for S" }));
    expect(screen.queryByText(/Custom data for/)).not.toBeInTheDocument();
  });
});
