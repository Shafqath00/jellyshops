import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { describe, expect, it, vi } from "vitest";
import { EditorShell } from "./editor-shell";
import { StoreEditorApiError } from "../api/types";

const commerce = { async getProducts() { return []; } };

function documentWithRichText() {
  const document = createDefaultStorefrontDocument("store-demo");
  document.regions.template.push({
    id: "rich-text-id", type: "rich-text", enabled: true, settings: {},
    blocks: [{ id: "story-heading", type: "heading", enabled: true, settings: { text: "Our story" } }],
  });
  return document;
}

describe("editor shell", () => {
  it("synchronizes hierarchy and canvas selection", async () => {
    const user = userEvent.setup();
    render(<EditorShell initialDocument={documentWithRichText()} revision={0} commerce={commerce} onSave={vi.fn()} onPublish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Hero section" }));
    expect(screen.getByTestId("section-hero")).toHaveAttribute("data-editor-selected", "true");

    await user.click(screen.getByTestId("section-rich-text"));
    expect(screen.getByRole("heading", { name: "Rich text settings" })).toBeInTheDocument();
  });

  it("keeps the section tree visible while the selected section inspector is open", async () => {
    const user = userEvent.setup();
    render(<EditorShell initialDocument={documentWithRichText()} revision={0} commerce={commerce} onSave={vi.fn()} onPublish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Hero section" }));

    expect(screen.getByRole("heading", { name: "Home page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rich text section" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hero settings" })).toBeInTheDocument();
    expect(screen.getByLabelText("Storefront preview")).toBeInTheDocument();
  });

  it("shows blocks below their parent section in the left hierarchy", async () => {
    const user = userEvent.setup();
    render(<EditorShell initialDocument={documentWithRichText()} revision={0} commerce={commerce} onSave={vi.fn()} onPublish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Heading block in Hero" }));

    expect(screen.getByRole("heading", { name: "Heading block settings" })).toBeInTheDocument();
  });

  it("supports non-drag section ordering and device previews", async () => {
    const user = userEvent.setup();
    render(<EditorShell initialDocument={documentWithRichText()} revision={0} commerce={commerce} onSave={vi.fn()} onPublish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Move Hero down" }));
    expect(within(screen.getByTestId("template-hierarchy")).getAllByTestId("hierarchy-row").map((row) => row.textContent)).toEqual([
      expect.stringContaining("Product grid"), expect.stringContaining("Hero"), expect.stringContaining("Rich text"),
    ]);

    await user.click(screen.getByRole("button", { name: "Mobile preview" }));
    expect(screen.getByTestId("preview-viewport")).toHaveAttribute("data-viewport", "mobile");
  });

  it("exposes a keyboard-accessible drag handle for sections", () => {
    render(<EditorShell initialDocument={documentWithRichText()} revision={0} commerce={commerce} onSave={vi.fn()} onPublish={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Drag Hero section" })).toBeInTheDocument();
  });

  it("opens section and block settings and updates the live preview", async () => {
    const user = userEvent.setup();
    render(<EditorShell initialDocument={documentWithRichText()} revision={0} commerce={commerce} onSave={vi.fn()} onPublish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Hero section" }));
    expect(screen.getByRole("heading", { name: "Hero settings" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Eyebrow" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Heading block" }));
    const heading = screen.getByRole("textbox", { name: "Heading" });
    await user.clear(heading);
    await user.type(heading, "Fresh arrivals");
    expect(screen.getByText("Fresh arrivals")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to page hierarchy" }));
    expect(screen.getByRole("heading", { name: "Home page" })).toBeInTheDocument();
  });

  it("selects a preview heading by stable block id", async () => {
    const user = userEvent.setup();
    render(<EditorShell initialDocument={documentWithRichText()} revision={0} commerce={commerce} onSave={vi.fn()} onPublish={vi.fn()} />);

    await user.click(screen.getByRole("heading", { name: "Welcome" }));

    expect(screen.getByRole("heading", { name: "Heading block settings" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Heading" })).toHaveFocus();
  });

  it("refocuses the schema field when the same preview text is selected again", async () => {
    const user = userEvent.setup();
    render(<EditorShell initialDocument={documentWithRichText()} revision={0} commerce={commerce} onSave={vi.fn()} onPublish={vi.fn()} />);

    const heading = screen.getByRole("heading", { name: "Welcome" });
    await user.click(heading);
    await user.click(screen.getByRole("button", { name: "Move Hero down" }));
    await user.click(heading);

    expect(screen.getByRole("textbox", { name: "Heading" })).toHaveFocus();
  });

  it("adds a registered section from the section picker", async () => {
    const user = userEvent.setup();
    render(<EditorShell initialDocument={documentWithRichText()} revision={0} commerce={commerce} onSave={vi.fn()} onPublish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add section" }));
    expect(screen.getByRole("dialog", { name: "Add section" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add Newsletter" }));

    expect(screen.getByRole("heading", { name: "Newsletter settings" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to page hierarchy" }));
    expect(screen.getByRole("button", { name: "Newsletter section" })).toBeInTheDocument();
  });

  it("groups add-section presets into Shopify-style categories", async () => {
    const user = userEvent.setup();
    render(<EditorShell initialDocument={documentWithRichText()} revision={0} commerce={commerce} onSave={vi.fn()} onPublish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add section" }));

    expect(screen.getByRole("heading", { name: "Banners" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Content" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marketing" })).toBeInTheDocument();
  });

  it("edits global theme colors from theme settings", async () => {
    const user = userEvent.setup();
    render(<EditorShell initialDocument={documentWithRichText()} revision={0} commerce={commerce} onSave={vi.fn()} onPublish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Theme settings" }));
    expect(screen.getByRole("heading", { name: "Theme settings" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Background color"));
    await user.type(screen.getByLabelText("Background color"), "#123456");

    expect(screen.getByTestId("preview-viewport").querySelector(".jelly-storefront")).toHaveStyle({ "--jelly-color-background": "#123456" });
  });

  it("autosaves a changed draft after the debounce delay", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(3);
    render(<EditorShell initialDocument={documentWithRichText()} revision={2} commerce={commerce} onSave={onSave} onPublish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Hero section" }));
    await user.clear(screen.getByRole("textbox", { name: "Eyebrow" }));
    await user.type(screen.getByRole("textbox", { name: "Eyebrow" }), "New");
    expect(onSave).not.toHaveBeenCalled();

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-demo" }), 2), { timeout: 1200 });
  });

  it("stops autosave and reports a revision conflict without overwriting", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new StoreEditorApiError(409, "REVISION_CONFLICT", "A newer draft exists", undefined, 3));
    const reloaded = documentWithRichText();
    reloaded.regions.template[0].settings.eyebrow = "Server copy";
    const onReload = vi.fn().mockResolvedValue({ document: reloaded, revision: 3 });
    render(<EditorShell initialDocument={documentWithRichText()} revision={2} commerce={commerce} onSave={onSave} onPublish={vi.fn()} onReload={onReload} />);

    await user.click(screen.getByRole("button", { name: "Hero section" }));
    await user.clear(screen.getByRole("textbox", { name: "Eyebrow" }));
    await user.type(screen.getByRole("textbox", { name: "Eyebrow" }), "New");

    await waitFor(() => expect(screen.getByText("Conflict detected")).toBeInTheDocument(), { timeout: 1200 });
    expect(onSave).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Reload latest draft" }));
    await waitFor(() => expect(screen.getByText("Server copy")).toBeInTheDocument());
  });

  it("saves the latest draft revision before publishing", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(8);
    const onPublish = vi.fn().mockResolvedValue(undefined);
    render(<EditorShell initialDocument={documentWithRichText()} revision={7} commerce={commerce} onSave={onSave} onPublish={onPublish} />);

    await user.click(screen.getByRole("button", { name: "Hero section" }));
    await user.click(screen.getByRole("button", { name: "Heading block" }));
    await user.clear(screen.getByRole("textbox", { name: "Heading" }));
    await user.type(screen.getByRole("textbox", { name: "Heading" }), "Ready to publish");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-demo" }), 8));
    expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(onPublish.mock.invocationCallOrder[0]);
    expect(onSave.mock.calls[0][0].regions.template[0].blocks[0].settings.text).toBe("Ready to publish");
  });

  it("prevents overlapping save and publish operations", async () => {
    const user = userEvent.setup();
    let finishSave!: (revision: number) => void;
    const onSave = vi.fn().mockReturnValue(new Promise<number>((resolve) => { finishSave = resolve; }));
    const onPublish = vi.fn();
    render(<EditorShell initialDocument={documentWithRichText()} revision={2} commerce={commerce} onSave={onSave} onPublish={onPublish} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(onPublish).not.toHaveBeenCalled();
    finishSave(3);
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled());
  });
});
