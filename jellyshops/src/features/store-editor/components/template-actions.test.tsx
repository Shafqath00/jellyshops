import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StorefrontTemplateRecord } from "../api/types";
import { TemplateActions, type TemplateActionsApi } from "./template-actions";

const record = (id: string, handle: string, name: string, revision = 0): StorefrontTemplateRecord => ({
  id, storeId: "store-a", revision, type: "product", handle, name, layout: { sections: [] }, createdAt: "", updatedAt: "",
} as unknown as StorefrontTemplateRecord);

const main = record("product-main", "default", "Product", 4);
const bed = record("product-bed", "bed", "Bed", 2);

function setup(active = main, overrides: Partial<TemplateActionsApi> = {}, flushResult = true) {
  const api: TemplateActionsApi = {
    cloneTemplate: vi.fn(async (_storeId, _id, input) => ({ template: record("copy", input.handle, input.name), generation: 9 })),
    createTemplate: vi.fn(async (_storeId, input) => ({ template: record("blank", input.handle ?? "x", input.name), generation: 9 })),
    updateTemplate: vi.fn(async (_storeId, id, revision, patch) => ({ template: { ...active, id, revision: revision + 1, name: patch.name ?? active.name }, generation: 10 })),
    deleteTemplate: vi.fn(async (_storeId, templateId) => ({ templateId, generation: 11 })),
    ...overrides,
  };
  const handlers = { onCreated: vi.fn(), onUpdated: vi.fn(), onDeleted: vi.fn(), flush: vi.fn(async () => flushResult) };
  render(<TemplateActions api={api} storeId="store-a" activeTemplate={active} templates={[main, bed]}
    latest={(id) => id === active.id ? { ...active, revision: active.revision + 1 } : undefined}
    blankLayout={{ sections: [{ kind: "inline", section: { id: "product-product-gallery", type: "product-gallery", settings: {}, blocks: [] } }] }}
    {...handlers} />);
  return { api, ...handlers };
}

afterEach(() => vi.restoreAllMocks());

describe("TemplateActions", () => {
  it("explains that the main template is used by every product", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Product/ }));

    expect(screen.getByText("All products use this template unless you choose another one for them.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete template/ })).not.toBeInTheDocument();
  });

  it("creates a copy of the current template after saving pending edits", async () => {
    const { api, flush, onCreated } = setup();
    await userEvent.click(screen.getByRole("button", { name: /Product/ }));
    await userEvent.click(screen.getByRole("button", { name: /Create a product template/i }));
    await userEvent.type(screen.getByLabelText("Template name"), "Mattress");
    await userEvent.click(screen.getByRole("button", { name: "Create template" }));

    expect(flush).toHaveBeenCalled();
    expect(api.cloneTemplate).toHaveBeenCalledWith("store-a", "product-main", { name: "Mattress", handle: "mattress" });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ name: "Mattress" }), 9);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts from the basic layout with fresh section ids when asked", async () => {
    const { api } = setup();
    await userEvent.click(screen.getByRole("button", { name: /Product/ }));
    await userEvent.click(screen.getByRole("button", { name: /Create a product template/i }));
    await userEvent.type(screen.getByLabelText("Template name"), "Bed");
    await userEvent.click(screen.getByLabelText("The basic layout"));
    await userEvent.click(screen.getByRole("button", { name: "Create template" }));

    expect(api.createTemplate).toHaveBeenCalledWith("store-a", expect.objectContaining({ type: "product", name: "Bed", handle: "bed-2" }));
    const layout = vi.mocked(api.createTemplate).mock.calls[0][1].layout as { sections: Array<{ section: { id: string } }> };
    expect(layout.sections[0].section.id).not.toBe("product-product-gallery");
  });

  it("renames with the revision saved after pending edits", async () => {
    const { api, onUpdated } = setup(bed);
    await userEvent.click(screen.getByRole("button", { name: /Bed/ }));
    await userEvent.click(screen.getByRole("button", { name: /Rename/ }));
    await userEvent.clear(screen.getByLabelText("Template name"));
    await userEvent.type(screen.getByLabelText("Template name"), "Beds and frames");
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(api.updateTemplate).toHaveBeenCalledWith("store-a", "product-bed", 3, { name: "Beds and frames" });
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ name: "Beds and frames" }), 10);
  });

  it("deletes an extra template after confirming", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { api, onDeleted } = setup(bed);
    await userEvent.click(screen.getByRole("button", { name: /Bed/ }));
    await userEvent.click(screen.getByRole("button", { name: /Delete template/ }));

    expect(api.deleteTemplate).toHaveBeenCalledWith("store-a", "product-bed", 3);
    expect(onDeleted).toHaveBeenCalledWith("product-bed", 11);
  });

  it("shows the server's message when a template can't be deleted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDeleted } = setup(bed, { deleteTemplate: vi.fn(async () => { throw new Error("This template is used by 2 items. Switch them to another template first."); }) });
    await userEvent.click(screen.getByRole("button", { name: /Bed/ }));
    await userEvent.click(screen.getByRole("button", { name: /Delete template/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This template is used by 2 items.");
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("does nothing while edits are still unsaved", async () => {
    const { api } = setup(bed, {}, false);
    await userEvent.click(screen.getByRole("button", { name: /Bed/ }));
    await userEvent.click(screen.getByRole("button", { name: /Rename/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your latest edits haven't saved yet.");
    expect(api.updateTemplate).not.toHaveBeenCalled();
  });
});
