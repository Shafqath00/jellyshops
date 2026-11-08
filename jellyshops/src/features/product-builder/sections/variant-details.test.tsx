import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ProductMediaLike } from "@jelly/storefront-schema";
import type { ProductOption, ProductVariant } from "@/lib/domain";
import { draftToPayload, emptyDraft } from "../draft";
import { VariantsSection } from "./variants-section";

afterEach(cleanup);
beforeEach(() => { probe.variants = []; });

const options: ProductOption[] = [{ id: "size", name: "Size", type: "variant", required: true, position: 0, values: [{ id: "s", label: "S", position: 0 }, { id: "m", label: "M", position: 1 }] } as never];
const variant = (id: string, name: string, size: string, extra: Partial<ProductVariant> = {}): ProductVariant => ({ id, name, sku: "", priceMinor: 1000, stock: 5, options: { size }, ...extra });
const photos: ProductMediaLike[] = [{ id: "front", url: "https://x/front.jpg", altText: "Front view" }, { id: "back", url: "https://x/back.jpg" }];

/** The combinations as last reported by the section, for the tests to read. */
const probe: { variants: ProductVariant[] } = { variants: [] };
function Harness({ initial, physical = true, withPhotos = photos }: { initial: ProductVariant[]; physical?: boolean; withPhotos?: ProductMediaLike[] }) {
  const [variants, setVariants] = useState(initial);
  return <VariantsSection options={options} variants={variants} currency="GBP" photos={withPhotos} physical={physical} onChange={(next) => { probe.variants = next; setVariants(next); }} />;
}
const two = () => [variant("v-s", "S", "s"), variant("v-m", "M", "m")];

describe("combination details", () => {
  it("opens one combination's details at a time and closes them again", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} />);
    expect(screen.queryByLabelText("Barcode for S")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show details for S" }));
    expect(screen.getByLabelText("Barcode for S")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show details for M" }));
    expect(screen.getByLabelText("Barcode for M")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Hide details for M" }));
    expect(screen.queryByLabelText("Barcode for M")).not.toBeInTheDocument();
  });

  it("saves barcode, cost and low stock warning for that combination only, and clears them when emptied", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} />);
    await user.click(screen.getByRole("button", { name: "Show details for S" }));
    await user.type(screen.getByLabelText("Barcode for S"), "5012345678900");
    await user.type(screen.getByLabelText(/Cost per item for S/), "4.50");
    await user.type(screen.getByLabelText("Low stock warning for S"), "8");
    expect(probe.variants[0]).toMatchObject({ barcode: "5012345678900", costMinor: 450, lowStockThreshold: 8 });
    expect(probe.variants[1]).not.toHaveProperty("barcode");
    await user.clear(screen.getByLabelText(/Cost per item for S/));
    await user.clear(screen.getByLabelText("Low stock warning for S"));
    await user.clear(screen.getByLabelText("Barcode for S"));
    expect(probe.variants[0].costMinor).toBeUndefined();
    expect(probe.variants[0].lowStockThreshold).toBeUndefined();
    expect(probe.variants[0].barcode).toBeUndefined();
  });

  it("converts weight and size to the stored units and explains mistakes without saving them", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} />);
    await user.click(screen.getByRole("button", { name: "Show details for M" }));
    await user.type(screen.getByLabelText("Weight of M"), "1.5");
    expect(probe.variants[1].weightGrams).toBe(1500);
    await user.selectOptions(screen.getByLabelText("Weight unit for M"), "g");
    expect(probe.variants[1].weightGrams).toBe(2);
    // A mistake is explained and the last good value stays.
    await user.type(screen.getByLabelText("Weight of M"), "x");
    expect(within(screen.getByLabelText("Weight of M").parentElement!.parentElement!).getByRole("alert")).toHaveTextContent(/Enter a number/);
    expect(probe.variants[1].weightGrams).toBe(2);
    // Emptying the field clears the weight.
    await user.clear(screen.getByLabelText("Weight of M"));
    expect(probe.variants[1].weightGrams).toBeUndefined();

    await user.type(screen.getByLabelText("Length of M"), "30");
    expect(screen.getByText(/together/)).toBeVisible();
    await user.type(screen.getByLabelText("Width of M"), "20");
    await user.type(screen.getByLabelText("Height of M"), "5");
    expect(probe.variants[1]).toMatchObject({ lengthMm: 300, widthMm: 200, heightMm: 50 });
  });

  it("saves origin and HS code, and refuses an invalid HS code", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} />);
    await user.click(screen.getByRole("button", { name: "Show details for S" }));
    await user.selectOptions(screen.getByLabelText("Country or region of origin for S"), "IN");
    await user.type(screen.getByLabelText("HS code for S"), "6109.10");
    expect(probe.variants[0]).toMatchObject({ countryOfOrigin: "IN", hsCode: "610910" });
    await user.clear(screen.getByLabelText("HS code for S"));
    await user.type(screen.getByLabelText("HS code for S"), "12");
    expect(screen.getByText(/6 to 10 digits/)).toBeVisible();
    expect(probe.variants[0].hsCode).toBeUndefined();
  });

  it("hides shipping details for digital products but keeps the rest", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} physical={false} />);
    await user.click(screen.getByRole("button", { name: "Show details for S" }));
    expect(screen.getByLabelText("Barcode for S")).toBeVisible();
    expect(screen.queryByLabelText("Weight of S")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("HS code for S")).not.toBeInTheDocument();
  });
});

describe("combination photo", () => {
  it("offers the product's photos by name and saves the choice", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} />);
    await user.click(screen.getByRole("button", { name: "Show details for M" }));
    const select = screen.getByLabelText("Photo for M");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["Chosen from the choices", "Front view", "Photo 2"]);
    await user.selectOptions(select, "back");
    expect(probe.variants[1].mediaId).toBe("back");
    await user.selectOptions(select, "");
    expect(probe.variants[1].mediaId).toBeUndefined();
  });

  it("asks for photos first when the product has none", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} withPhotos={[]} />);
    await user.click(screen.getByRole("button", { name: "Show details for S" }));
    expect(screen.getByLabelText("Photo for S")).toBeDisabled();
    expect(screen.getByText("Add photos to the product first")).toBeVisible();
  });
});

describe("selling a combination", () => {
  it("marks a combination as not sold and sells it again", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} />);
    expect(screen.queryByText("Not sold")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Sell M"));
    expect(probe.variants[1].sellable).toBe(false);
    expect(screen.getByText("Not sold")).toBeVisible();
    await user.click(screen.getByLabelText("Sell M"));
    expect(probe.variants[1].sellable).toBe(true);
    expect(screen.queryByText("Not sold")).not.toBeInTheDocument();
  });

  it("stops and restarts selling a whole group at once", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} />);
    await user.click(screen.getByRole("button", { name: "Stop selling" }));
    expect(probe.variants.map((entry) => entry.sellable)).toEqual([false, false]);
    await user.selectOptions(screen.getByLabelText("Bulk scope"), "size|s");
    await user.click(screen.getByRole("button", { name: "Sell" }));
    expect(probe.variants.map((entry) => entry.sellable)).toEqual([true, false]);
  });
});

describe("bulk edit of the new fields", () => {
  it("sets cost, weight in the chosen unit and the low stock warning for a group", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} />);
    await user.selectOptions(screen.getByLabelText("Bulk scope"), "size|m");
    await user.selectOptions(screen.getByLabelText("Bulk field"), "cost");
    await user.type(screen.getByLabelText("Bulk value"), "3.25");
    await user.click(screen.getByRole("button", { name: /^Apply to/ }));
    expect(probe.variants.map((entry) => entry.costMinor)).toEqual([undefined, 325]);

    await user.selectOptions(screen.getByLabelText("Bulk field"), "weight");
    await user.selectOptions(screen.getByLabelText("Bulk weight unit"), "g");
    await user.type(screen.getByLabelText("Bulk value"), "250");
    await user.click(screen.getByRole("button", { name: /^Apply to/ }));
    expect(probe.variants.map((entry) => entry.weightGrams)).toEqual([undefined, 250]);

    await user.selectOptions(screen.getByLabelText("Bulk field"), "lowStock");
    await user.type(screen.getByLabelText("Bulk value"), "10");
    await user.click(screen.getByRole("button", { name: /^Apply to/ }));
    expect(probe.variants.map((entry) => entry.lowStockThreshold)).toEqual([undefined, 10]);
  });

  it("explains a bad bulk value and changes nothing", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} />);
    await user.selectOptions(screen.getByLabelText("Bulk field"), "weight");
    await user.type(screen.getByLabelText("Bulk value"), "abc");
    await user.click(screen.getByRole("button", { name: /^Apply to/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Enter a number/);
    // Nothing was reported, so nothing changed.
    expect(probe.variants).toEqual([]);
  });

  it("closes open details after a bulk change so they show the new values", async () => {
    const user = userEvent.setup();
    render(<Harness initial={two()} />);
    await user.click(screen.getByRole("button", { name: "Show details for S" }));
    await user.selectOptions(screen.getByLabelText("Bulk field"), "cost");
    await user.type(screen.getByLabelText("Bulk value"), "2");
    await user.click(screen.getByRole("button", { name: /^Apply to/ }));
    expect(screen.queryByLabelText("Barcode for S")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show details for S" }));
    expect(screen.getByLabelText(/Cost per item for S/)).toHaveValue("2.00");
  });
});

describe("saving combinations", () => {
  const draft = (variants: ProductVariant[], extra = {}) => ({ ...emptyDraft, title: "Tee", price: "10", options, variants, media: [{ id: "front", url: "https://x/front.jpg" }], ...extra });

  it("sends every new field for each combination, using null for what is empty", () => {
    const sent = draftToPayload(draft([
      variant("v-s", "S", "s", { costMinor: 450, barcode: " 123 ", lowStockThreshold: 6, weightGrams: 250, lengthMm: 300, widthMm: 200, heightMm: 50, countryOfOrigin: "IN", hsCode: "610910", sellable: false, mediaId: "front" }),
      variant("v-m", "M", "m"),
    ]), undefined, { variantIds: ["v-s", "v-m"], imageUrl: "" });
    expect(sent.variants[0]).toMatchObject({ costMinor: 450, barcode: "123", lowStockThreshold: 6, weightGrams: 250, lengthMm: 300, widthMm: 200, heightMm: 50, countryOfOrigin: "IN", hsCode: "610910", sellable: false, mediaId: "front" });
    expect(sent.variants[1]).toMatchObject({ costMinor: null, barcode: null, lowStockThreshold: null, weightGrams: null, lengthMm: null, countryOfOrigin: null, hsCode: null, sellable: true, mediaId: null });
  });

  it("drops a combination's photo that is no longer one of the product's photos", () => {
    const sent = draftToPayload(draft([variant("v-s", "S", "s", { mediaId: "deleted" })]), undefined, { variantIds: ["v-s"], imageUrl: "" });
    expect((sent.variants[0] as { mediaId?: string | null }).mediaId).toBeNull();
  });

  it("leaves shipping details alone for a digital product", () => {
    const sent = draftToPayload(draft([variant("v-s", "S", "s", { weightGrams: 250 })], { physical: false }), undefined, { variantIds: ["v-s"], imageUrl: "" });
    expect(sent.variants[0]).not.toHaveProperty("weightGrams");
    expect(sent.variants[0]).toMatchObject({ barcode: null, sellable: true });
  });
});
