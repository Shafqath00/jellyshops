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
