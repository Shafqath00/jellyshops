import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ResourceForm } from "./resource-form";

const resource = {
  id: "page-1",
  title: "About",
  handle: "about",
  seoTitle: null,
  seoDescription: null,
  socialMediaId: null,
  noindex: false,
  canonicalOverride: null,
};
const templates = [{ id: "page-default", name: "Default page" }, { id: "page-alt", name: "Editorial page" }];

it("customizes the assigned template for the same preview resource", async () => {
  const onCustomizeTemplate = vi.fn();
  render(
    <ResourceForm
      resource={resource}
      templates={templates}
      assignedTemplateId="page-alt"
      onSave={vi.fn()}
      onAssignTemplate={vi.fn()}
      onCustomizeTemplate={onCustomizeTemplate}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Customize template" }));

  expect(onCustomizeTemplate).toHaveBeenCalledWith({ resourceId: "page-1", templateId: "page-alt" });
  expect(screen.getByLabelText("Title")).toHaveValue("About");
});

it("assigns a selected template without submitting content changes", async () => {
  const onAssignTemplate = vi.fn();
  const onSave = vi.fn();
  render(
    <ResourceForm
      resource={resource}
      templates={templates}
      assignedTemplateId="page-default"
      onSave={onSave}
      onAssignTemplate={onAssignTemplate}
      onCustomizeTemplate={vi.fn()}
    />,
  );

  await userEvent.selectOptions(screen.getByLabelText("Template"), "page-alt");
  await userEvent.click(screen.getByRole("button", { name: "Assign template" }));

  expect(onAssignTemplate).toHaveBeenCalledWith({ resourceId: "page-1", templateId: "page-alt" });
  expect(onSave).not.toHaveBeenCalled();
});
