import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { draftToPayload, effectiveHandle, emptyDraft, handleProblem, productToDraft, validateSimpleDraft, type ProductDraft } from "../draft";
import { SeoSection } from "./seo-section";

afterEach(cleanup);

let latest: ProductDraft = emptyDraft;
function Harness({ initial, saved = false }: { initial: ProductDraft; saved?: boolean }) {
  const [draft, setDraft] = useState(initial);
  return <SeoSection draft={draft} errors={validateSimpleDraft(draft)} storeName="Hemp & Co" storeSlug="hemp" saved={saved} onChange={(field, value) => setDraft((current) => { const next = { ...current, [field]: value }; latest = next; return next; })} />;
}
const preview = () => within(screen.getByRole("img", { name: "Preview of the search result" }));
const saved = (extra: Record<string, unknown> = {}) => productToDraft({ id: "p", slug: "linen-shirt", name: "Linen shirt", description: "A soft, breathable linen shirt.", imageUrl: "", category: "", published: true, featured: false, variants: [{ id: "v", name: "Standard", sku: "", priceMinor: 4900, stock: 3 }], ...extra } as never).draft;

describe("search result preview", () => {
  it("shows what search engines will show when nothing is set: the name, the store and the description", () => {
    render(<Harness initial={{ ...emptyDraft, title: "Linen shirt", description: "A soft, breathable linen shirt." }} />);
    expect(preview().getByText("Linen shirt · Hemp & Co")).toBeVisible();
    expect(preview().getByText("A soft, breathable linen shirt.")).toBeVisible();
    expect(preview().getByText(/\/hemp\/products\/linen-shirt$/)).toBeVisible();
  });

  it("follows the seller's title and description as they type", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyDraft, title: "Linen shirt" }} />);
    await user.click(screen.getByText("Edit search engine listing"));
    await user.type(screen.getByLabelText("Page title"), "Organic linen shirt");
    await user.type(screen.getByLabelText("Meta description"), "Breathable organic linen.");
    expect(preview().getByText("Organic linen shirt")).toBeVisible();
    expect(preview().getByText("Breathable organic linen.")).toBeVisible();
  });

  it("cuts a long product description down for the preview, like the storefront does", () => {
    render(<Harness initial={{ ...emptyDraft, title: "Shirt", description: "word ".repeat(80) }} />);
    const text = preview().getByText(/word/).textContent ?? "";
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("guidance", () => {
  it("counts characters and warns when search engines would cut the text off, without blocking", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyDraft, title: "Shirt" }} />);
    await user.click(screen.getByText("Edit search engine listing"));
    await user.type(screen.getByLabelText("Page title"), "x".repeat(61));
    expect(screen.getByText("61 of 60 recommended (255 maximum)")).toBeVisible();
    expect(screen.getByText(/cut titles off after about 60/)).toBeVisible();
    await user.type(screen.getByLabelText("Meta description"), "Short");
    expect(screen.getByText(/at least 70 characters/)).toBeVisible();
    expect(validateSimpleDraft({ ...latest, price: "10" })).toEqual({});
  });

  it("does not let more be typed than can be stored", () => {
    render(<Harness initial={emptyDraft} />);
    expect(screen.getByLabelText("Page title")).toHaveAttribute("maxLength", "255");
    expect(screen.getByLabelText("Meta description")).toHaveAttribute("maxLength", "500");
  });

  it("opens the fields when the product already has some", () => {
    render(<Harness initial={saved({ seoTitle: "Organic linen shirt" })} />);
    expect(screen.getByText("Edit search engine listing").closest("details")).toHaveAttribute("open");
  });
});

describe("URL handle", () => {
  it("follows the product name until the seller edits it", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyDraft, title: "Linen shirt" }} />);
    await user.click(screen.getByText("Edit search engine listing"));
    expect(screen.getByLabelText("URL handle")).toHaveValue("linen-shirt");
    await user.clear(screen.getByLabelText("URL handle"));
    await user.type(screen.getByLabelText("URL handle"), "Organic Linen");
    expect(screen.getByLabelText("URL handle")).toHaveValue("organic-linen");
    expect(latest.handleManual).toBe(true);
  });

  it("explains a handle that cannot be used", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyDraft, title: "Linen shirt" }} />);
    await user.click(screen.getByText("Edit search engine listing"));
    await user.clear(screen.getByLabelText("URL handle"));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a URL handle");
    await user.type(screen.getByLabelText("URL handle"), "linen--shirt!");
    expect(screen.getByRole("alert")).toHaveTextContent(/lowercase letters, numbers and single hyphens/);
  });

  it("warns that changing a live product's handle breaks old links", async () => {
    const user = userEvent.setup();
    render(<Harness initial={saved()} saved />);
    await user.click(screen.getByText("Edit search engine listing"));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("URL handle"), "-v2");
    expect(screen.getByRole("note")).toHaveTextContent(/old links to it, including ones in search results, will stop working/);
  });
});

describe("handle and listing in the draft", () => {
  it("keeps a saved product's handle when its name changes", () => {
    const draft = { ...saved(), title: "Renamed shirt" };
    expect(effectiveHandle(draft)).toBe("linen-shirt");
    expect(draftToPayload(draft, undefined).handle).toBe("linen-shirt");
  });

  it("makes the handle from the name for a new product", () => {
    expect(draftToPayload({ ...emptyDraft, title: "Linen Shirt!", price: "10" }, undefined).handle).toBe("linen-shirt");
  });

  it("leaves a legacy handle alone until it is changed", () => {
    const legacy = saved({ slug: "Linen_Shirt" });
    expect(handleProblem(legacy)).toBeUndefined();
    expect(handleProblem({ ...legacy, handle: "Linen_Shirt2" })).toMatch(/lowercase/);
  });

  it("sends the title and description, and null when they are empty", () => {
    const sent = draftToPayload({ ...saved(), seoTitle: "  Organic linen shirt ", seoDescription: "Breathable." }, undefined);
    expect(sent).toMatchObject({ seoTitle: "Organic linen shirt", seoDescription: "Breathable." });
    expect(draftToPayload(saved(), undefined)).toMatchObject({ seoTitle: null, seoDescription: null });
  });

  it("restores saved values", () => {
    expect(saved({ seoTitle: "Organic linen shirt", seoDescription: "Breathable." })).toMatchObject({ seoTitle: "Organic linen shirt", seoDescription: "Breathable.", handle: "linen-shirt", handleManual: true, initialHandle: "linen-shirt" });
  });
});
