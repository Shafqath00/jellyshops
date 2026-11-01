import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MetafieldDefinition } from "./api";
import type { Lookups } from "./lookups";
import { MetafieldInput } from "./metafield-input";

afterEach(cleanup);

const definition = (type: string, extra: Partial<MetafieldDefinition> = {}): MetafieldDefinition => ({ id: "d1", ownerType: "product", namespace: "custom", key: "field", name: "Field", type, storefrontVisible: true, ...extra });
const lookups = (): Lookups => ({
  products: vi.fn(async () => [{ id: "p1", label: "Linen shirt" }, { id: "p2", label: "Wool scarf" }]),
  collections: vi.fn(async () => [{ id: "c1", label: "Summer" }]),
  media: vi.fn(async () => [{ id: "m1", label: "front.jpg", imageUrl: "https://x/front.jpg" }]),
});
const context = (overrides: Partial<{ lookups: Lookups | null }> = {}) => ({ storeId: "store-a", currency: "GBP", lookups: lookups(), ...overrides });

/** Holds the value like the editor does, and reports every change. */
function Harness({ type, initial, rules, ctx = context() }: { type: string; initial?: unknown; rules?: Record<string, unknown>; ctx?: ReturnType<typeof context> }) {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <>
      <MetafieldInput definition={definition(type, rules ? { validations: rules } : {})} id="f" value={value} onChange={(next) => { setValue(next); changes.push(next); }} context={ctx} />
      <output data-testid="value">{JSON.stringify(value ?? null)}</output>
    </>
  );
}
let changes: unknown[] = [];
const shown = () => JSON.parse(screen.getByTestId("value").textContent ?? "null");
const setup = (props: Parameters<typeof Harness>[0]) => { changes = []; return { user: userEvent.setup(), ...render(<Harness {...props} />) }; };

describe("text fields", () => {
  it("edits single-line and multi-line text, and clears with null when emptied", async () => {
    const { user } = setup({ type: "string" });
    await user.type(screen.getByLabelText("Field"), "Cotton");
    expect(shown()).toBe("Cotton");
    await user.clear(screen.getByLabelText("Field"));
    expect(shown()).toBeNull();
    cleanup();
    const multi = setup({ type: "text" });
    await multi.user.type(screen.getByLabelText("Field"), "Line one");
    expect(screen.getByLabelText("Field").tagName).toBe("TEXTAREA");
    expect(shown()).toBe("Line one");
  });

  it("offers a list of allowed values when the field has choices", async () => {
    const { user } = setup({ type: "string", rules: { choices: ["Cotton", "Linen"] } });
    const select = screen.getByLabelText("Field");
    expect(select.tagName).toBe("SELECT");
    await user.selectOptions(select, "Linen");
    expect(shown()).toBe("Linen");
    await user.selectOptions(select, "");
    expect(shown()).toBeNull();
  });
});

describe("true or false", () => {
  it("distinguishes not set from no", async () => {
    const { user } = setup({ type: "boolean" });
    const select = screen.getByLabelText("Field");
    expect(select).toHaveValue("");
    await user.selectOptions(select, "no");
    expect(shown()).toBe(false);
    await user.selectOptions(select, "yes");
    expect(shown()).toBe(true);
    await user.selectOptions(select, "");
    expect(shown()).toBeNull();
  });
});

describe("numbers", () => {
  it("accepts whole numbers only for an integer, and keeps the last good value while typing nonsense", async () => {
    const { user } = setup({ type: "integer" });
    const input = screen.getByLabelText("Field");
    await user.type(input, "42");
    expect(shown()).toBe(42);
    await user.type(input, ".5");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(shown()).toBe(42);
    await user.clear(input);
    expect(shown()).toBeNull();
  });

  it("accepts decimals, including a comma", async () => {
    const { user } = setup({ type: "decimal" });
    await user.type(screen.getByLabelText("Field"), "4,5");
    expect(shown()).toBe(4.5);
  });

  it("shows a saved number and follows it when it is replaced from outside", () => {
    const { rerender } = render(<MetafieldInput definition={definition("integer")} id="f" value={7} onChange={() => {}} context={context()} />);
    expect(screen.getByLabelText("Field")).toHaveValue("7");
    rerender(<MetafieldInput definition={definition("integer")} id="f" value={9} onChange={() => {}} context={context()} />);
    expect(screen.getByLabelText("Field")).toHaveValue("9");
    rerender(<MetafieldInput definition={definition("integer")} id="f" value={undefined} onChange={() => {}} context={context()} />);
    expect(screen.getByLabelText("Field")).toHaveValue("");
  });
});

describe("money, colour, link and dates", () => {
  it("stores money in minor units in the store's currency", async () => {
    const { user } = setup({ type: "money" });
    await user.type(screen.getByLabelText("Field"), "19.99");
    expect(shown()).toEqual({ amountMinor: 1999, currency: "GBP" });
    expect(screen.getByText("GBP")).toBeVisible();
    await user.clear(screen.getByLabelText("Field"));
    expect(shown()).toBeNull();
  });

  it("keeps the currency a saved amount was entered in", () => {
    render(<MetafieldInput definition={definition("money")} id="f" value={{ amountMinor: 500, currency: "EUR" }} onChange={() => {}} context={context()} />);
    expect(screen.getByText("EUR")).toBeVisible();
    expect(screen.getByLabelText("Field")).toHaveValue("5.00");
  });

  it("saves a colour only when it is a full hex code, and clears it when emptied", async () => {
    const { user } = setup({ type: "color" });
    const input = screen.getByLabelText("Field");
    await user.type(input, "#12ab");
    expect(shown()).toBeNull();
    expect(input).toHaveAttribute("aria-invalid", "true");
    await user.type(input, "ef");
    expect(shown()).toBe("#12abef");
    await user.clear(input);
    expect(shown()).toBeNull();
  });

  it("takes a web address and a date", async () => {
    const link = setup({ type: "url" });
    await link.user.type(screen.getByLabelText("Field"), "https://example.com/care");
    expect(shown()).toBe("https://example.com/care");
    cleanup();
    const date = setup({ type: "date" });
    expect(screen.getByLabelText("Field")).toHaveAttribute("type", "date");
    await date.user.type(screen.getByLabelText("Field"), "2026-10-28");
    expect(shown()).toBe("2026-10-28");
  });

  it("takes a date and time as an ISO time", async () => {
    const { user } = setup({ type: "datetime" });
    const input = screen.getByLabelText("Field");
    expect(input).toHaveAttribute("type", "datetime-local");
    await user.type(input, "2026-10-28T09:30");
    expect(shown()).toBe(new Date("2026-10-28T09:30").toISOString());
  });
});

describe("pickers", () => {
  it("chooses a product, a collection or a file from what the store has", async () => {
    const ctx = context();
    const product = setup({ type: "product_reference", ctx });
    await waitFor(() => expect(screen.getByRole("option", { name: "Linen shirt" })).toBeInTheDocument());
    await product.user.selectOptions(screen.getByLabelText("Field"), "p2");
    expect(shown()).toBe("p2");
    expect(ctx.lookups?.products).toHaveBeenCalledWith("store-a");
    cleanup();
    const collection = setup({ type: "collection_reference", ctx });
    await waitFor(() => expect(screen.getByRole("option", { name: "Summer" })).toBeInTheDocument());
    await collection.user.selectOptions(screen.getByLabelText("Field"), "c1");
    expect(shown()).toBe("c1");
    cleanup();
    const file = setup({ type: "image", ctx });
    await waitFor(() => expect(screen.getByRole("option", { name: "front.jpg" })).toBeInTheDocument());
    await file.user.selectOptions(screen.getByLabelText("Field"), "m1");
    expect(shown()).toBe("m1");
    expect(document.querySelector("img")).toHaveAttribute("src", "https://x/front.jpg");
  });

  it("keeps a saved choice visible when it no longer exists", async () => {
    setup({ type: "product_reference", initial: "gone" });
    expect(await screen.findByRole("option", { name: "gone (not found)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Field")).toHaveValue("gone");
  });

  it("says so when the choices cannot be loaded", async () => {
    const ctx = context({ lookups: { ...lookups(), products: vi.fn(async () => { throw new Error("Could not load the choices."); }) } });
    setup({ type: "product_reference", ctx });
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the choices.");
  });

  it("falls back to an id box for pages and custom objects", async () => {
    const { user } = setup({ type: "page_reference" });
    await user.type(screen.getByLabelText("Field"), "page-1");
    expect(shown()).toBe("page-1");
  });
});

describe("lists", () => {
  it("adds, edits and removes items, leaving blank ones out of the value", async () => {
    const { user } = setup({ type: "list:string" });
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.type(screen.getByLabelText("Field, item 1"), "Cold wash");
    expect(shown()).toEqual(["Cold wash"]);
    await user.click(screen.getByRole("button", { name: "Add item" }));
    expect(shown()).toEqual(["Cold wash"]);
    await user.type(screen.getByLabelText("Field, item 2"), "Line dry");
    expect(shown()).toEqual(["Cold wash", "Line dry"]);
    await user.click(screen.getByRole("button", { name: "Remove Field, item 1" }));
    expect(shown()).toEqual(["Line dry"]);
    await user.click(screen.getByRole("button", { name: "Remove Field, item 1" }));
    expect(shown()).toBeNull();
  });

  it("shows saved items and edits each like a single value", async () => {
    const { user } = setup({ type: "list:integer", initial: [1, 2] });
    expect(screen.getByLabelText("Field, item 1")).toHaveValue("1");
    await user.clear(screen.getByLabelText("Field, item 2"));
    await user.type(screen.getByLabelText("Field, item 2"), "5");
    expect(shown()).toEqual([1, 5]);
  });

  it("follows the saved value when it is replaced from outside", () => {
    const { rerender } = render(<MetafieldInput definition={definition("list:string")} id="f" value={["a"]} onChange={() => {}} context={context()} />);
    expect(screen.getByLabelText("Field, item 1")).toHaveValue("a");
    rerender(<MetafieldInput definition={definition("list:string")} id="f" value={["b", "c"]} onChange={() => {}} context={context()} />);
    expect(screen.getByLabelText("Field, item 2")).toHaveValue("c");
    rerender(<MetafieldInput definition={definition("list:string")} id="f" value={undefined} onChange={() => {}} context={context()} />);
    expect(screen.queryByLabelText("Field, item 1")).not.toBeInTheDocument();
  });
});
