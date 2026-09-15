import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CompilationDiagnostic } from "@jelly/storefront-schema";
import { expect, it, vi } from "vitest";
import { StoreEditorApiError } from "../api/types";
import { PublishControls } from "./publish-controls";

const errorDiagnostic: CompilationDiagnostic = {
  severity: "error",
  code: "BINDING_INVALID",
  message: "Binding is invalid",
  location: { entityType: "template", entityId: "home-default" },
};

it("blocks publish while compiler errors are present", () => {
  render(
    <PublishControls
      generation={7}
      diagnostics={[errorDiagnostic]}
      validate={vi.fn()}
      compilePreview={vi.fn()}
      publish={vi.fn()}
      refreshWorkspace={vi.fn()}
      onDiagnostics={vi.fn()}
      onPreview={vi.fn()}
      onGeneration={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
});

it("publishes with generation and a generated idempotency key", async () => {
  const publish = vi.fn().mockResolvedValue({ ok: true, diagnostics: [], publication: { id: "pub-1", storeId: "store-demo", sourceGeneration: 7 } });
  render(
    <PublishControls
      generation={7}
      diagnostics={[]}
      validate={vi.fn()}
      compilePreview={vi.fn()}
      publish={publish}
      refreshWorkspace={vi.fn()}
      onDiagnostics={vi.fn()}
      onPreview={vi.fn()}
      onGeneration={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Publish" }));

  expect(publish).toHaveBeenCalledTimes(1);
  expect(publish.mock.calls[0][0]).toBe(7);
  expect(publish.mock.calls[0][1]).toMatch(/^publish-/);
});

it("refreshes only generation and diagnostics after a stale workspace publish", async () => {
  const publish = vi.fn().mockRejectedValue(new StoreEditorApiError(409, "WORKSPACE_GENERATION_CONFLICT", "changed", undefined, undefined, 9));
  const refreshWorkspace = vi.fn().mockResolvedValue({ generation: 9, updatedAt: null });
  const validate = vi.fn().mockResolvedValue({ ok: false, diagnostics: [errorDiagnostic], dependencies: {} });
  const onGeneration = vi.fn();
  const onDiagnostics = vi.fn();
  render(
    <PublishControls
      generation={7}
      diagnostics={[]}
      validate={validate}
      compilePreview={vi.fn()}
      publish={publish}
      refreshWorkspace={refreshWorkspace}
      onDiagnostics={onDiagnostics}
      onPreview={vi.fn()}
      onGeneration={onGeneration}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Publish" }));

  expect(refreshWorkspace).toHaveBeenCalledTimes(1);
  expect(onGeneration).toHaveBeenCalledWith(9);
  expect(validate).toHaveBeenCalledWith(9);
  expect(onDiagnostics).toHaveBeenCalledWith([errorDiagnostic]);
});
