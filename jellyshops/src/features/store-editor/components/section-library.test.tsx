import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SectionLibrary } from "./section-library";

it("inserts a detached copy of a saved preset", async () => {
  const section = {
    id: "preset-section",
    type: "rich-text",
    enabled: true,
    settings: { alignment: "center" },
    blocks: [{ id: "text-1", type: "text", enabled: true, settings: { text: "Original" } }],
  };
  const onInsert = vi.fn();

  render(
    <SectionLibrary
      presets={[{ id: "preset-1", name: "Story", section }]}
      onInsertPreset={onInsert}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Insert Story" }));

  expect(onInsert).toHaveBeenCalledTimes(1);
  const inserted = onInsert.mock.calls[0][0];
  expect(inserted).toEqual(section);
  expect(inserted).not.toBe(section);
  expect(inserted.blocks).not.toBe(section.blocks);

  inserted.blocks[0].settings.text = "Changed locally";
  expect(section.blocks[0].settings.text).toBe("Original");
});

it("searches the built-in section catalog and inserts the selected section", async () => {
  const onInsertBuiltIn = vi.fn();

  render(
    <SectionLibrary
      presets={[]}
      builtIns={[
        { id: "hero", name: "Hero", category: "Banners" },
        { id: "newsletter", name: "Newsletter", category: "Marketing" },
      ]}
      onInsertPreset={vi.fn()}
      onInsertBuiltIn={onInsertBuiltIn}
    />,
  );

  await userEvent.type(screen.getByRole("searchbox", { name: "Search sections" }), "news");

  expect(screen.queryByRole("button", { name: "Add Hero" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Add Newsletter" }));
  expect(onInsertBuiltIn).toHaveBeenCalledWith("newsletter");
});

it("removes a saved section after asking", async () => {
  const section = { id: "s", type: "rich-text", enabled: true, settings: {}, blocks: [] };
  const onDelete = vi.fn();
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<SectionLibrary presets={[{ id: "preset-1", name: "Story", section }]} onInsertPreset={vi.fn()} onDeletePreset={onDelete} />);
  const remove = screen.getByRole("button", { name: "Remove Story from saved sections" });
  await userEvent.click(remove);
  expect(onDelete).not.toHaveBeenCalled();
  await userEvent.click(remove);
  expect(onDelete).toHaveBeenCalledWith("preset-1");
  confirm.mockRestore();
});

it("shows designed presets with a layout sketch and a description, and searches the description", async () => {
  const onInsert = vi.fn();
  render(<SectionLibrary presets={[]} builtIns={[
    { id: "category-grid", name: "Collection list", category: "Products" },
    { id: "category-grid-bento", name: "Collection list: Bento", category: "Products", description: "One large collection beside four smaller ones.", thumbnail: "bento" },
  ]} onInsertPreset={vi.fn()} onInsertBuiltIn={onInsert} />);
  const bento = screen.getByRole("button", { name: "Add Collection list: Bento" });
  expect(bento.querySelector("[data-preset-sketch='bento']")).not.toBeNull();
  expect(bento).toHaveTextContent("One large collection beside four smaller ones.");
  await userEvent.click(bento);
  expect(onInsert).toHaveBeenCalledWith("category-grid-bento");
  await userEvent.type(screen.getByRole("searchbox", { name: "Search sections" }), "smaller");
  expect(screen.queryByRole("button", { name: "Add Collection list" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Collection list: Bento" })).toBeInTheDocument();
});

it("asks for a live preview of the choice the pointer or keyboard is on", async () => {
  const onPreview = vi.fn();
  const builtIns = [
    { id: "custom-tabs", name: "Custom section: Tabs", category: "Content" },
    { id: "custom-steps", name: "Custom section: How it works", category: "Content" },
  ];
  render(<SectionLibrary presets={[]} builtIns={builtIns} onInsertPreset={vi.fn()} onPreview={onPreview} />);
  await userEvent.hover(screen.getByRole("button", { name: "Add Custom section: Tabs" }));
  expect(onPreview).toHaveBeenLastCalledWith("custom-tabs");
  await userEvent.unhover(screen.getByRole("button", { name: "Add Custom section: Tabs" }));
  await userEvent.tab();
  await userEvent.tab();
  expect(onPreview).toHaveBeenLastCalledWith(expect.stringMatching(/^custom-/));
  screen.getByRole("button", { name: "Add Custom section: How it works" }).focus();
  expect(onPreview).toHaveBeenLastCalledWith("custom-steps");
});
