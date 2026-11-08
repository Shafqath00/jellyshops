import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { draftToPayload, emptyDraft, productToDraft, validateSimpleDraft, type ProductDraft } from "../draft";
import { ShippingSection } from "./shipping-section";

function Harness({ initial, hasCombinations = false }: { initial: ProductDraft; hasCombinations?: boolean }) {
  const [draft, setDraft] = useState(initial);
  return <ShippingSection draft={draft} errors={validateSimpleDraft(draft)} hasCombinations={hasCombinations} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} />;
}
const product = (extra: Record<string, unknown> = {}, variant: Record<string, unknown> = {}) => ({ id: "p", slug: "tee", name: "Tee", description: "", imageUrl: "", category: "", published: true, featured: false, variants: [{ id: "v", name: "Standard", sku: "", priceMinor: 1000, stock: 3, ...variant }], ...extra }) as never;

describe("shipping section", () => {
  it("collects weight, size, origin and HS code", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyDraft, title: "Tee", price: "10" }} />);
    await user.type(screen.getByLabelText("Package weight"), "250");
    await user.selectOptions(screen.getByLabelText("Weight unit"), "g");
    await user.type(screen.getByLabelText("Length"), "30");
    await user.type(screen.getByLabelText("Width"), "20");
    await user.type(screen.getByLabelText("Height"), "5");
    await user.selectOptions(screen.getByLabelText("Country or region of origin"), "IN");
    await user.type(screen.getByLabelText("HS code"), "6109.10");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Country or region of origin")).toHaveValue("IN");
  });

  it("explains a mistake next to the field", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyDraft, title: "Tee", price: "10" }} />);
    await user.type(screen.getByLabelText("Package weight"), "heavy");
    await user.type(screen.getByLabelText("Length"), "30");
    await user.type(screen.getByLabelText("HS code"), "61");
    const alerts = screen.getAllByRole("alert").map((alert) => alert.textContent);
    expect(alerts).toEqual(expect.arrayContaining([expect.stringMatching(/Enter a number/), expect.stringMatching(/together/), expect.stringMatching(/6 to 10 digits/)]));
  });

  it("offers a list of countries by name", () => {
    render(<Harness initial={emptyDraft} />);
    const select = screen.getByLabelText("Country or region of origin");
    expect(within(select).getByRole("option", { name: "India" })).toHaveValue("IN");
    expect(within(select).getByRole("option", { name: "Not set" })).toHaveValue("");
  });

  it("hides the fields for a digital product and says why", async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyDraft} />);
    await user.click(screen.getByLabelText("This is a physical product that needs shipping"));
    expect(screen.queryByLabelText("Package weight")).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/never shipped/);
  });

  it("points to the combinations when the product has them", () => {
    render(<Harness initial={emptyDraft} hasCombinations />);
    expect(screen.queryByLabelText("Package weight")).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/for each combination/);
  });
});

describe("shipping in the draft", () => {
  const shipping = { weightGrams: 1250, lengthMm: 300, widthMm: 200, heightMm: 50, countryOfOrigin: "IN", hsCode: "610910" };

  it("restores saved details, choosing readable units", () => {
    const { draft } = productToDraft(product({}, shipping));
    expect(draft.physical).toBe(true);
    expect(draft.shipping).toMatchObject({ weight: "1.25", weightUnit: "kg", length: "30", width: "20", height: "5", dimensionUnit: "cm", countryOfOrigin: "IN", hsCode: "610910" });
  });

  it("sends the details and the fulfilment type, and clears blanks with null", () => {
    const { draft } = productToDraft(product({}, shipping));
    const sent = draftToPayload(draft, undefined);
    expect(sent.fulfillmentType).toBe("PHYSICAL");
    expect(sent.variants[0]).toMatchObject(shipping);
    const cleared = draftToPayload({ ...draft, shipping: { ...draft.shipping, weight: "", length: "", width: "", height: "", countryOfOrigin: "", hsCode: "" } }, undefined);
    expect(cleared.variants[0]).toMatchObject({ weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, countryOfOrigin: null, hsCode: null });
  });

  it("leaves shipping details alone for a digital product", () => {
    const { draft } = productToDraft(product({ fulfillmentType: "DIGITAL" }, shipping));
    expect(draft.physical).toBe(false);
    const sent = draftToPayload(draft, undefined);
    expect(sent.fulfillmentType).toBe("DIGITAL");
    expect(sent.variants[0]).not.toHaveProperty("weightGrams");
    expect(validateSimpleDraft({ ...draft, shipping: { ...draft.shipping, weight: "nonsense" } })).not.toHaveProperty("weight");
  });

  it("blocks saving a physical product with an impossible weight", () => {
    const { draft } = productToDraft(product());
    expect(validateSimpleDraft({ ...draft, shipping: { ...draft.shipping, weight: "-1", hsCode: "1" } })).toMatchObject({ weight: expect.any(String), hsCode: expect.any(String) });
  });

  it("sends each combination its own shipping details", () => {
    const { draft } = productToDraft(product({ options: [{ id: "size", name: "Size", type: "variant", required: true, values: [{ id: "s", label: "S" }] }], inventoryOptionIds: ["size"] }, { ...shipping, options: { size: "s" } }));
    const sent = draftToPayload(draft, undefined);
    expect(sent.variants[0]).toMatchObject(shipping);
    expect(sent.fulfillmentType).toBe("PHYSICAL");
  });
});
