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

it("blocks compilation and publication while draft changes are not saved", () => {
  render(<PublishControls generation={7} diagnostics={[]} saveState="saving" validate={vi.fn()} compilePreview={vi.fn()} publish={vi.fn()} refreshWorkspace={vi.fn()} onDiagnostics={vi.fn()} onPreview={vi.fn()} onGeneration={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
});

it("shows preview request failures and allows another attempt", async () => {
  const compilePreview = vi.fn().mockRejectedValueOnce(new Error("Preview service unavailable")).mockResolvedValue({ ok: true, diagnostics: [], dependencies: {} });
  render(<PublishControls generation={7} diagnostics={[]} validate={vi.fn()} compilePreview={compilePreview} publish={vi.fn()} refreshWorkspace={vi.fn()} onDiagnostics={vi.fn()} onPreview={vi.fn()} onGeneration={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Preview service unavailable");
  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(screen.getByRole("status")).toHaveTextContent(/Preview/);
});

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

it("flushes pending drafts and validates the refreshed generation before publishing", async () => {
  const events: string[] = [];
  const flushDraft = vi.fn(async () => { events.push("flush"); return true; });
  const refreshWorkspace = vi.fn(async () => { events.push("refresh"); return { generation: 9, updatedAt: null }; });
  const validate = vi.fn(async () => { events.push("validate"); return { ok: true, diagnostics: [], dependencies: {} }; });
  const publish = vi.fn(async (_generation: number, _key: string) => { events.push("publish"); return { ok: true, diagnostics: [] }; });
  render(<PublishControls generation={7} diagnostics={[]} saveState="saving" flushDraft={flushDraft} validate={validate} compilePreview={vi.fn()} publish={publish} refreshWorkspace={refreshWorkspace} onDiagnostics={vi.fn()} onPreview={vi.fn()} onGeneration={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Publish" }));
  expect(events).toEqual(["flush", "refresh", "validate", "publish"]);
  expect(validate).toHaveBeenCalledWith(9);
  expect(publish.mock.calls[0][0]).toBe(9);
});

it("does not publish when pending draft saves fail", async () => {
  const publish = vi.fn();
  const refreshWorkspace = vi.fn();
  render(<PublishControls generation={7} diagnostics={[]} flushDraft={async () => false} validate={vi.fn()} compilePreview={vi.fn()} publish={publish} refreshWorkspace={refreshWorkspace} onDiagnostics={vi.fn()} onPreview={vi.fn()} onGeneration={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Publish" }));
  expect(screen.getByRole("alert")).toHaveTextContent("could not be saved");
  expect(refreshWorkspace).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
});

it("keeps publish accessible from the compact save menu", async () => {
  const publish = vi.fn().mockResolvedValue({ ok: true, diagnostics: [] });
  render(<PublishControls compact onSaveDraft={vi.fn()} generation={7} diagnostics={[]} validate={vi.fn()} compilePreview={vi.fn()} publish={publish} refreshWorkspace={vi.fn()} onDiagnostics={vi.fn()} onPreview={vi.fn()} onGeneration={vi.fn()} />);
  await userEvent.click(screen.getByLabelText("Publishing options"));
  await userEvent.click(screen.getByRole("button", { name: "Publish" }));
  expect(publish).toHaveBeenCalledOnce();
});
