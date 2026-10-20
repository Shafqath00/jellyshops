import { fireEvent, render, screen } from "@testing-library/react";
import { getV4StarterPack } from "@jelly/storefront-registry";
import { expect, it, vi } from "vitest";
import { TemplatePreviewDialog } from "./template-preview";

it("renders each shared starter section once in an isolated responsive preview", () => {
  render(<TemplatePreviewDialog starter={getV4StarterPack("fresh-market")} hasWorkspace={false} busy={false} onClose={vi.fn()} onUse={vi.fn()} onEdit={vi.fn()} />);
  const frame = screen.getByTitle("Template preview") as HTMLIFrameElement;
  fireEvent.load(frame);
  expect(frame.contentDocument!.querySelectorAll('[data-testid="section-header"]')).toHaveLength(1);
  expect(frame.contentDocument!.querySelectorAll('[data-testid="section-announcement-bar"]')).toHaveLength(1);
  expect(frame.contentDocument!.querySelectorAll('[data-testid="section-footer"]')).toHaveLength(1);
});
