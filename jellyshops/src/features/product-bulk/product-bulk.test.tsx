import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/admin";
import type { CatalogAdminProduct } from "@/features/store-editor/api/types";
import { createProductBulkApi, exportPath, type CheckResult, type ImportDetail, type ImportView, type ProductBulkApi } from "./api";
import { BulkEditDialog } from "./bulk-edit-dialog";
import { ExportDialog } from "./export-dialog";
import { ImportWizard } from "./import-wizard";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
afterEach(cleanup);

async function violations(root: HTMLElement = document.body): Promise<string[]> {
  const results = await axe.run(root, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }, rules: { "color-contrast": { enabled: false }, region: { enabled: false }, "landmark-one-main": { enabled: false }, "page-has-heading-one": { enabled: false } } });
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`);
}

const view = (overrides: Partial<ImportView> = {}): ImportView => ({
  id: "import-1", fileName: "beds.csv", format: "csv", status: "uploaded", mode: "upsert", rowCount: 3, createdAt: "2026-11-13T10:00:00Z", finishedAt: null, undoneAt: null,
  progress: { done: 0, total: 0 }, counts: { created: 0, updated: 0, skipped: 0, failed: 0 }, summary: null, canUndo: false, ...overrides,
});
const COLUMNS = [
  { key: "handle", label: "Handle", help: "The last part of the web address.", level: "product" as const, imported: true },
  { key: "title", label: "Title", help: "The product's name.", level: "product" as const, imported: true },
  { key: "price", label: "Price", help: "What shoppers pay.", level: "variant" as const, imported: true },
  { key: "imageUrls", label: "Image URLs", help: "Not imported yet.", level: "product" as const, imported: false },
];
const detail = (overrides: Partial<ImportDetail> = {}): ImportDetail => ({ ...view(), headers: ["Handle", "Name", "Cost to buyer", "Notes"], mapping: { handle: 0, title: 1 }, sample: [["oak-bed", "Oak bed", "499", "x"]], columns: COLUMNS, ...overrides });
const checked = (): CheckResult => ({
  ...detail({ status: "checked", summary: { products: 3, create: 1, update: 1, skip: 0, problem: 1, rows: 3, problemRows: 1 } }),
  plans: [
    { handle: "oak-bed", title: "Oak bed", action: "create", rows: [2], variantCount: 1, columns: [], reasons: [] },
    { handle: "tote", title: "Tote", action: "update", rows: [3], variantCount: 1, columns: ["Price"], reasons: [] },
    { handle: "broken", title: "Broken", action: "problem", rows: [4], variantCount: 1, columns: [], reasons: [{ row: 4, column: "Price", message: "is not a price. Use a number such as 499 or 499.50." }] },
  ],
  problems: [{ row: 4, column: "Price", message: "is not a price. Use a number such as 499 or 499.50.", handle: "broken" }], morePlans: 0, moreProblems: 0,
});
function fakeApi(overrides: Partial<ProductBulkApi> = {}): ProductBulkApi {
  return {
    upload: vi.fn(async () => detail()), check: vi.fn(async () => checked()),
    run: vi.fn().mockResolvedValueOnce(view({ status: "running", progress: { done: 1, total: 3 }, counts: { created: 1, updated: 0, skipped: 0, failed: 0 } }))
      .mockResolvedValue(view({ status: "finished", finishedAt: "2026-11-13T10:01:00Z", progress: { done: 3, total: 3 }, counts: { created: 1, updated: 1, skipped: 0, failed: 1 }, canUndo: true })),
    get: vi.fn(async () => detail()), list: vi.fn(async () => []),
    undo: vi.fn(async () => ({ ...view({ status: "undone", counts: { created: 1, updated: 1, skipped: 0, failed: 1 } }), undone: { archived: 1, restored: 1, failed: 0 } })),
    download: vi.fn(async () => ({ truncated: false, products: 2 })),
    matchPhotos: vi.fn(async (names: string[]) => names.map((name) => ({ name, product: /oak/i.test(name) ? { id: "p1", title: "Oak bed frame", handle: "oak-bed-frame", photoCount: 2 } : null, matchedBy: /oak/i.test(name) ? "sku" as const : null }))),
    addPhoto: vi.fn(async (productId: string) => ({ productId, photoCount: 3, added: true })), ...overrides,
  };
}
const csvFile = () => new File(["Handle,Name\noak-bed,Oak bed\n"], "beds.csv", { type: "text/csv" });

describe("import wizard", () => {
  it("goes from upload to results, saving nothing before the merchant confirms", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<ToastProvider><ImportWizard api={api} /></ToastProvider>);
    expect(await screen.findByRole("heading", { name: "No imports yet" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Upload your file" })).toHaveFocus();
    expect(await violations()).toEqual([]);

    await user.upload(screen.getByLabelText("Choose a CSV or Excel file"), csvFile());
    expect(await screen.findByRole("heading", { name: "Match your columns" })).toHaveFocus();
    expect(screen.getByRole("list", { name: "Import steps" }).querySelector("[aria-current=step]")).toHaveTextContent("Match columns");
    // Suggested matches are filled in; a column we do not import is not offered.
    expect(screen.getByRole("combobox", { name: "Handle" })).toHaveValue("0");
    expect(screen.getByRole("combobox", { name: "Price" })).toHaveValue("");
    expect(screen.queryByRole("combobox", { name: "Image URLs" })).toBeNull();
    expect(screen.getByText(/Not used from your file: Cost to buyer, Notes/)).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: "Price" }), "Cost to buyer");
    await user.click(screen.getByRole("radio", { name: /Update only/ }));
    expect(await violations()).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Check file" }));
    expect(api.check).toHaveBeenCalledWith("import-1", { handle: 0, title: 1, price: 2 }, "update");
    expect(await screen.findByRole("heading", { name: "Check what will happen" })).toHaveFocus();
    expect(screen.getByText("Nothing has been saved yet.")).toBeVisible();
    expect(within(screen.getByRole("table", { name: "Problems" })).getByText(/Price is not a price/)).toBeVisible();
    expect(within(screen.getByRole("table", { name: "Preview of the import" })).getByText("Changes: Price")).toBeVisible();
    expect(api.run).not.toHaveBeenCalled();
    expect(await violations()).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Import 2 products" }));
    expect(await screen.findByRole("heading", { name: "Import finished" })).toHaveFocus();
    expect(api.run).toHaveBeenCalledTimes(2);
    expect(screen.getByText("1 product was not imported")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Download the report" }));
    expect(api.download).toHaveBeenCalledWith("/imports/import-1/report");
    expect(await violations()).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Undo this import…" }));
    const dialog = await screen.findByRole("dialog", { name: "Undo this import?" });
    expect(dialog).toHaveTextContent("Stock levels are not changed");
    await user.click(within(dialog).getByRole("button", { name: "Undo import" }));
    expect(await screen.findByRole("heading", { name: "This import was undone" })).toBeVisible();
    expect(api.undo).toHaveBeenCalledWith("import-1");
  }, 30000);

  it("refuses the wrong kind of file and a file that is too large before uploading", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const api = fakeApi();
    render(<ToastProvider><ImportWizard api={api} /></ToastProvider>);
    await user.upload(screen.getByLabelText("Choose a CSV or Excel file"), new File(["x"], "photo.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a CSV or Excel (.xlsx) file.");
    const big = new File(["x"], "big.csv", { type: "text/csv" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    await user.upload(screen.getByLabelText("Choose a CSV or Excel file"), big);
    expect(await screen.findByRole("alert")).toHaveTextContent("larger than 5 MB");
    expect(api.upload).not.toHaveBeenCalled();
  });

  it("shows the server's reason when a file cannot be read, and needs a key column before checking", async () => {
    const user = userEvent.setup();
    const api = fakeApi({ upload: vi.fn().mockRejectedValueOnce(new Error("This file has headings but no products. Add at least one row under the headings.")).mockResolvedValue(detail({ mapping: { price: 2 } })) });
    render(<ToastProvider><ImportWizard api={api} /></ToastProvider>);
    await user.upload(screen.getByLabelText("Choose a CSV or Excel file"), csvFile());
    expect(await screen.findByRole("alert")).toHaveTextContent("headings but no products");
    await user.upload(screen.getByLabelText("Choose a CSV or Excel file"), csvFile());
    expect(await screen.findByText(/Match at least one of Handle, Title or SKU/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Check file" })).toBeDisabled();
    // Choosing a file column that another of our columns used moves it.
    await user.selectOptions(screen.getByRole("combobox", { name: "Title" }), "Cost to buyer");
    expect(screen.getByRole("combobox", { name: "Price" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Check file" })).toBeEnabled();
  });

  it("lists earlier imports and carries on with one that did not finish", async () => {
    const user = userEvent.setup();
    const api = fakeApi({
      list: vi.fn(async () => [view({ id: "import-9", fileName: "half.csv", status: "running", progress: { done: 20, total: 45 } }), view({ id: "import-8", fileName: "old.csv", status: "finished", counts: { created: 4, updated: 0, skipped: 1, failed: 0 } })]),
      get: vi.fn(async () => detail({ id: "import-9", status: "running" })),
      run: vi.fn(async () => view({ id: "import-9", status: "finished", progress: { done: 45, total: 45 }, counts: { created: 45, updated: 0, skipped: 0, failed: 0 } })),
    });
    render(<ToastProvider><ImportWizard api={api} /></ToastProvider>);
    const list = await screen.findByRole("list", { name: "Earlier imports" });
    expect(list).toHaveTextContent("20 of 45 products done");
    expect(list).toHaveTextContent("4 created, 0 updated, 1 skipped, 0 not imported");
    await user.click(within(list).getByRole("button", { name: "Carry on with half.csv" }));
    expect(await screen.findByRole("heading", { name: "Import finished" })).toBeVisible();
    expect(api.run).toHaveBeenCalledWith("import-9");
  });

  it("pauses when a step fails and offers to carry on", async () => {
    const user = userEvent.setup();
    const api = fakeApi({ run: vi.fn().mockRejectedValueOnce(new Error("Another import is running for this store.")).mockResolvedValue(view({ status: "finished", progress: { done: 3, total: 3 }, counts: { created: 2, updated: 0, skipped: 0, failed: 0 } })) });
    render(<ToastProvider><ImportWizard api={api} /></ToastProvider>);
    await user.upload(screen.getByLabelText("Choose a CSV or Excel file"), csvFile());
    await user.click(await screen.findByRole("button", { name: "Check file" }));
    await user.click(await screen.findByRole("button", { name: "Import 2 products" }));
    expect(await screen.findByRole("heading", { name: "Import paused" })).toBeVisible();
    expect(screen.getByText("Another import is running for this store.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Carry on" }));
    expect(await screen.findByRole("heading", { name: "Import finished" })).toBeVisible();
  });
});

describe("export", () => {
  it("builds the address from the chosen rows or the filters", () => {
    expect(exportPath("csv", {})).toBe("/bulk/export?format=csv");
    expect(exportPath("xlsx", { ids: ["a", "b"], filters: { status: "ACTIVE" } })).toBe("/bulk/export?format=xlsx&ids=a%2Cb");
    expect(exportPath("csv", { filters: { query: "oak bed", status: "", productType: "Beds" } })).toBe("/bulk/export?format=csv&query=oak+bed&productType=Beds");
  });

  it("offers ticked rows, the filtered list or everything, and downloads the choice", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    const onOpenChange = vi.fn();
    render(<ToastProvider><ExportDialog open onOpenChange={onOpenChange} api={api} selectedIds={["p1", "p2"]} filters={{ status: "ACTIVE" }} /></ToastProvider>);
    const dialog = screen.getByRole("dialog", { name: "Export products" });
    expect(within(dialog).getByRole("radio", { name: /The 2 you ticked/ })).toBeChecked();
    expect(await violations(dialog)).toEqual([]);
    await user.click(within(dialog).getByRole("radio", { name: /The list as it is filtered now/ }));
    await user.click(within(dialog).getByRole("radio", { name: /^CSV/ }));
    await user.click(within(dialog).getByRole("button", { name: "Export products" }));
    await waitFor(() => expect(api.download).toHaveBeenCalledWith("/bulk/export?format=csv&status=ACTIVE"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(await screen.findByText("2 products exported")).toBeVisible();
  });

  it("with nothing ticked or filtered offers all products only, and keeps the dialog open on failure", async () => {
    const user = userEvent.setup();
    const api = fakeApi({ download: vi.fn().mockRejectedValue(new Error("The export did not finish. Try again.")) });
    render(<ToastProvider><ExportDialog open onOpenChange={vi.fn()} api={api} /></ToastProvider>);
    expect(screen.getAllByRole("radio", { name: /products|ticked|filtered/i }).map((radio) => radio.parentElement?.textContent)).toEqual([expect.stringContaining("All products")]);
    await user.click(screen.getByRole("button", { name: "Export products" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The export did not finish");
  });

  it("sends the sign-in with every request and reads the server's message on failure", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { message: "This file is larger than 5 MB.", code: "IMPORT_TOO_LARGE" } }), { status: 413 }));
    const api = createProductBulkApi("http://api.test", "store 1", "token", fetcher as never);
    await expect(api.upload(csvFile())).rejects.toMatchObject({ message: "This file is larger than 5 MB.", status: 413, code: "IMPORT_TOO_LARGE" });
    expect(fetcher).toHaveBeenCalledWith("http://api.test/api/stores/store%201/catalog/imports", expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer token" } }));
  });
});

describe("bulk edit dialog", () => {
  const money = (minor: number) => `£${(minor / 100).toFixed(2)}`;
  const products = [
    { id: "p1", storeId: "s", handle: "oak", title: "Oak bed", description: "", vendor: null, productType: null, status: "ACTIVE", media: [], available: true, tags: [], collectionIds: [], variants: [{ id: "v1", title: "Standard", sku: null, priceMinor: 10000, compareAtPriceMinor: null, options: {}, trackInventory: true, quantity: 3, available: true }] },
    { id: "p2", storeId: "s", handle: "pine", title: "Pine bed", description: "", vendor: null, productType: null, status: "DRAFT", media: [], available: true, tags: [], collectionIds: [], variants: [{ id: "v2", title: "Standard", sku: null, priceMinor: 20000, compareAtPriceMinor: null, options: {}, trackInventory: true, quantity: 0, available: true }] },
  ] as unknown as CatalogAdminProduct[];

  it("previews before and after, then saves each product and reports failures", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Price is too high."));
    const onDone = vi.fn();
    render(<ToastProvider><BulkEditDialog open onOpenChange={vi.fn()} products={products} collections={[{ id: "c1", title: "Bedroom" }]} money={money} save={save} onDone={onDone} /></ToastProvider>);
    const dialog = screen.getByRole("dialog", { name: "Bulk edit 2 products" });
    expect(within(dialog).getByRole("button", { name: "Nothing to change" })).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText("How"), "lowerPercent");
    await user.type(within(dialog).getByLabelText("Percentage"), "10");
    const table = within(dialog).getByRole("table", { name: "Before and after" });
    expect(within(table).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([expect.stringMatching(/Oak bed£100\.00£90\.00/), expect.stringMatching(/Pine bed£200\.00£180\.00/)]);
    expect(within(dialog).getByRole("status")).toHaveTextContent("2 values will change");
    expect(await violations(dialog)).toEqual([]);
    expect(save).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Change 2 products" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenCalledWith("p1", { variants: [expect.objectContaining({ id: "v1", priceMinor: 9000 })] });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Pine bed: Price is too high.");
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("can widen from the ticked rows to every matching product, and back", async () => {
    const user = userEvent.setup();
    const more = Array.from({ length: 5 }, (_, index) => ({ ...products[0], id: `m${index}`, title: `Matching ${index}`, variants: [{ ...products[0].variants[0], id: `mv${index}` }] })) as unknown as CatalogAdminProduct[];
    const loadAllMatching = vi.fn(async () => ({ products: more, more: false }));
    const save = vi.fn(async () => ({}));
    render(<ToastProvider><BulkEditDialog open onOpenChange={vi.fn()} products={products} collections={[]} money={money} save={save} onDone={vi.fn()} loadAllMatching={loadAllMatching} /></ToastProvider>);
    expect(screen.getByText("Editing the 2 you ticked.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Edit every matching product instead" }));
    expect(await screen.findByText("Editing all 5 products that match your search and filters.")).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Bulk edit 5 products" })).toBeVisible();
    await user.type(screen.getByLabelText("Amount"), "50");
    await user.click(screen.getByRole("button", { name: "Change 5 products" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(5));
    expect(save).toHaveBeenCalledWith("m0", { variants: [expect.objectContaining({ id: "mv0", priceMinor: 5000 })] });
  });

  it("says so when the matching products cannot be loaded and keeps the ticked ones", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><BulkEditDialog open onOpenChange={vi.fn()} products={products} collections={[]} money={money} save={vi.fn()} onDone={vi.fn()} loadAllMatching={vi.fn().mockRejectedValue(new Error("Could not load this information."))} /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: "Edit every matching product instead" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this information.");
    expect(screen.getByText("Editing the 2 you ticked.")).toBeVisible();
  });

  it("explains a value it cannot use and offers the store's collections", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><BulkEditDialog open onOpenChange={vi.fn()} products={products} collections={[{ id: "c1", title: "Bedroom" }]} money={money} save={vi.fn()} onDone={vi.fn()} /></ToastProvider>);
    await user.type(screen.getByLabelText("Amount"), "cheap");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an amount, like 499 or 499.50.");
    await user.selectOptions(screen.getByLabelText("Change"), "collection");
    expect(screen.getByText("Choose a collection to see what will change.")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Collection"), "c1");
    expect(screen.getByRole("button", { name: "Change 2 products" })).toBeEnabled();
    await user.selectOptions(screen.getByLabelText("Change"), "status");
    await user.selectOptions(screen.getByLabelText("New status"), "ARCHIVED");
    expect(screen.getByText(/Archived products are hidden from your store/)).toBeVisible();
  });
});
