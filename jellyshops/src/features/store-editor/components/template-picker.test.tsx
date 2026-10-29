import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StorefrontTemplateRecord, TemplateAssignmentRecord } from "../api/types";
import { TemplatePicker, type TemplatePickerApi } from "./template-picker";

const record = (id: string, handle: string, name: string) => ({ id, storeId: "store-a", revision: 0, type: "product", handle, name, layout: { sections: [] } }) as unknown as StorefrontTemplateRecord;
const assignment = (templateId: string, revision = 0) => ({ storeId: "store-a", resourceType: "product", resourceId: "bed-1", templateId, revision }) as TemplateAssignmentRecord;

function setup(templates: StorefrontTemplateRecord[], current: TemplateAssignmentRecord | null = null) {
  const api: TemplatePickerApi = {
    listTemplates: vi.fn(async () => templates),
    getAssignment: vi.fn(async () => current),
    assignTemplate: vi.fn(async (_storeId, _type, _id, templateId, revision) => ({ assignment: assignment(templateId, revision === null ? 0 : revision + 1) })),
    removeAssignment: vi.fn(async () => ({ generation: 3 })),
  };
  render(<TemplatePicker api={api} storeId="store-a" resourceType="product" resourceId="bed-1" />);
  return api;
}

describe("TemplatePicker", () => {
  it("points to the theme editor when the store has only the main template", async () => {
    setup([record("main", "default", "Product")]);

    expect(await screen.findByText(/This product uses the main product template/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("assigns another template and leaves out templates from older store designs", async () => {
    const api = setup([record("main", "default", "Product"), record("old", "previous-x", "Old product"), record("bed", "bed", "Bed")]);
    const select = await screen.findByRole("combobox", { name: "Page layout" });

    expect([...select.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["Product (main product template)", "Bed"]);
    await userEvent.selectOptions(select, "bed");

    expect(api.assignTemplate).toHaveBeenCalledWith("store-a", "product", "bed-1", "bed", null);
    expect(await screen.findByRole("status")).toHaveTextContent("Your live store shows it after you publish.");
  });

  it("goes back to the main template by removing the assignment", async () => {
    const api = setup([record("main", "default", "Product"), record("bed", "bed", "Bed")], assignment("bed", 4));
    const select = await screen.findByRole("combobox", { name: "Page layout" });
    expect(select).toHaveValue("bed");

    await userEvent.selectOptions(select, "");

    expect(api.removeAssignment).toHaveBeenCalledWith("store-a", "product", "bed-1", 4);
    expect(select).toHaveValue("");
  });

  it("shows a save error and keeps the current choice", async () => {
    const api = setup([record("main", "default", "Product"), record("bed", "bed", "Bed")]);
    vi.mocked(api.assignTemplate).mockRejectedValueOnce(new Error("A product can only use a product template."));
    const select = await screen.findByRole("combobox", { name: "Page layout" });

    await userEvent.selectOptions(select, "bed");

    expect(await screen.findByRole("alert")).toHaveTextContent("A product can only use a product template.");
    expect(select).toHaveValue("");
  });
});
