import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CompilationDiagnostic } from "@jelly/storefront-schema";
import { expect, it, vi } from "vitest";
import { PublishDiagnostics, hasBlockingDiagnostics } from "./publish-diagnostics";

const warning: CompilationDiagnostic = {
  severity: "warning",
  code: "SEO_DESCRIPTION_MISSING",
  message: "Add a description for better search previews",
  location: { entityType: "template", entityId: "home-default" },
};

const error: CompilationDiagnostic = {
  severity: "error",
  code: "BINDING_TYPE_MISMATCH",
  message: "Heading requires text",
  location: {
    entityType: "template",
    entityId: "product-default",
    sectionId: "hero-1",
    blockId: "heading-1",
    fieldKey: "text",
  },
};

it("warnings do not block publish while errors do", () => {
  expect(hasBlockingDiagnostics([warning])).toBe(false);
  expect(hasBlockingDiagnostics([warning, error])).toBe(true);
});

it("opens the exact diagnostic setting location", async () => {
  const onOpen = vi.fn();
  render(<PublishDiagnostics diagnostics={[warning, error]} onOpen={onOpen} />);

  await userEvent.click(screen.getByRole("button", { name: "Open Heading requires text" }));

  expect(onOpen).toHaveBeenCalledWith(error.location);
  expect(screen.getByText("1 error")).toBeVisible();
  expect(screen.getByText("1 warning")).toBeVisible();
});
