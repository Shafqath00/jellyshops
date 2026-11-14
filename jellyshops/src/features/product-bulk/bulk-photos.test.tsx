import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/admin";
import type { ProductBulkApi } from "./api";
import { BulkPhotos } from "./bulk-photos";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
beforeAll(() => { URL.createObjectURL = vi.fn(() => "blob:preview"); URL.revokeObjectURL = vi.fn(); });
afterEach(cleanup);

const photo = (name: string, type = "image/jpeg") => new File(["x"], name, { type });
function fakeApi(overrides: Partial<ProductBulkApi> = {}): ProductBulkApi {
  return {
    matchPhotos: vi.fn(async (names: string[]) => names.map((name) => /oak/i.test(name)
      ? { name, product: { id: "p1", title: "Oak bed frame", handle: "oak-bed-frame", photoCount: 2 }, matchedBy: "sku" as const }
      : /tote/i.test(name) ? { name, product: { id: "p2", title: "Linen tote", handle: "linen-tote", photoCount: 0 }, matchedBy: "handle" as const }
      : { name, product: null, matchedBy: null })),
    addPhoto: vi.fn(async (productId: string) => ({ productId, photoCount: 3, added: true })),
    ...overrides,
  } as unknown as ProductBulkApi;
}
const rows = () => within(screen.getByRole("table", { name: "Photos and their products" })).getAllByRole("row").slice(1).map((row) => row.textContent);

describe("bulk photo upload", () => {
  it("shows which product each photo goes to before uploading, then uploads matched photos in name order", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    const { container } = render(<ToastProvider><BulkPhotos api={api} /></ToastProvider>);
    expect(screen.getByRole("heading", { name: "No photos chosen yet" })).toBeVisible();
    await user.upload(screen.getByLabelText("Choose photos"), [photo("oak-bed-2.jpg"), photo("holiday.jpg"), photo("linen-tote.jpg"), photo("OAK-BED-1.jpg")]);
    expect(await screen.findByText("3 photos matched to a product, 1 not matched.")).toBeVisible();
    expect(api.matchPhotos).toHaveBeenCalledWith(["oak-bed-2.jpg", "holiday.jpg", "linen-tote.jpg", "OAK-BED-1.jpg"]);
    expect(rows()).toEqual([
      expect.stringMatching(/holiday\.jpg.*No product with this name.*Not matched/),
      expect.stringMatching(/linen-tote\.jpg.*Linen tote.*Matched by web address ending · has 0 photos.*Ready/),
      expect.stringMatching(/OAK-BED-1\.jpg.*Oak bed frame.*Matched by SKU · has 2 photos.*Ready/),
      expect.stringMatching(/oak-bed-2\.jpg.*Oak bed frame/),
    ]);
    expect(screen.getByText("1 photo did not match a product")).toBeVisible();
    expect(api.addPhoto).not.toHaveBeenCalled();
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Upload 3 photos" }));
    expect(await screen.findByText("3 photos added.")).toBeVisible();
    expect(vi.mocked(api.addPhoto).mock.calls.map(([productId, file]) => [productId, file.name])).toEqual([["p2", "linen-tote.jpg"], ["p1", "OAK-BED-1.jpg"], ["p1", "oak-bed-2.jpg"]]);
    expect(screen.getByRole("button", { name: "Add more photos" })).toBeVisible();
  });

  it("leaves out files that are not photos or are too large, and says so", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const api = fakeApi();
    render(<ToastProvider><BulkPhotos api={api} /></ToastProvider>);
    const big = photo("oak-big.jpg");
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    await user.upload(screen.getByLabelText("Choose photos"), [photo("notes.pdf", "application/pdf"), big, photo("oak.jpg")]);
    expect(await screen.findByText(/Files that are not photos were left out\. Photos larger than 10 MB were left out\./)).toBeVisible();
    await waitFor(() => expect(api.matchPhotos).toHaveBeenCalledWith(["oak.jpg"]));
    expect(rows()).toHaveLength(1);
  });

  it("reports a photo that fails and one the product already has, and carries on with the rest", async () => {
    const user = userEvent.setup();
    const addPhoto = vi.fn()
      .mockRejectedValueOnce(new Error("This product already has 30 photos, which is the most a product can have."))
      .mockResolvedValueOnce({ productId: "p1", photoCount: 3, added: false })
      .mockResolvedValueOnce({ productId: "p2", photoCount: 1, added: true });
    render(<ToastProvider><BulkPhotos api={fakeApi({ addPhoto })} /></ToastProvider>);
    await user.upload(screen.getByLabelText("Choose photos"), [photo("oak-1.jpg"), photo("oak-2.jpg"), photo("tote.jpg")]);
    await user.click(await screen.findByRole("button", { name: "Upload 3 photos" }));
    expect(await screen.findByText("1 photo added, 1 already there, 1 not added.")).toBeVisible();
    expect(rows()[0]).toMatch(/oak-1\.jpg.*Not added.*already has 30 photos/);
    expect(rows()[1]).toMatch(/oak-2\.jpg.*Already on the product/);
    expect(addPhoto).toHaveBeenCalledTimes(3);
  });

  it("says when products could not be looked up", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><BulkPhotos api={fakeApi({ matchPhotos: vi.fn().mockRejectedValue(new Error("We could not look up your products. Try again.")) })} /></ToastProvider>);
    await user.upload(screen.getByLabelText("Choose photos"), [photo("oak.jpg")]);
    expect(await screen.findByText("We could not look up your products. Try again.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Nothing to upload" })).toBeDisabled();
  });
});
