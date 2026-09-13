import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ResourceForm } from "./resource-form";

it("customizes the assigned template for the same preview resource", async () => {
  const onCustomizeTemplate = vi.fn();
  render(
    <ResourceForm
      resource={{
        id: "page-1",
        title: "About",
        handle: "about",
        seoTitle: null,
        seoDescription: null,
        socialMediaId: null,
        noindex: false,
        canonicalOverride: null,
      }}
      templates={[{ id: "page-default", name: "Default page" }, { id: "page-alt", name: "Editorial page" }]}
      assignedTemplateId="page-alt"
      onSave={vi.fn()}
      onCustomizeTemplate={onCustomizeTemplate}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Customize template" }));

  expect(onCustomizeTemplate).toHaveBeenCalledWith({ resourceId: "page-1", templateId: "page-alt" });
  expect(screen.getByLabelText("Title")).toHaveValue("About");
});
