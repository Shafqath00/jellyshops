import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { GlobalSectionPanel } from "./global-section-panel";

const globalSection = {
  id: "global-1",
  name: "Announcement",
  section: {
    id: "announcement-1",
    type: "announcement-bar",
    enabled: true,
    settings: { text: "Shared" },
    blocks: [],
  },
};

afterEach(() => vi.restoreAllMocks());

it("confirms before converting a local section into a synced global section", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const onMakeGlobal = vi.fn();
  const localSection = {
    id: "hero-1",
    type: "hero",
    enabled: true,
    settings: { alignment: "left" },
    blocks: [],
  };

  render(
    <GlobalSectionPanel
      globalSections={[globalSection]}
      localSection={localSection}
      onMakeGlobal={onMakeGlobal}
      onInsertGlobal={vi.fn()}
      onDetachGlobal={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Make global" }));

  expect(window.confirm).toHaveBeenCalled();
  expect(onMakeGlobal).toHaveBeenCalledTimes(1);
  expect(onMakeGlobal.mock.calls[0][0]).toEqual(localSection);
  expect(onMakeGlobal.mock.calls[0][0]).not.toBe(localSection);
});

it("inserts a shared global reference and detaches to a local copy", async () => {
  const onInsertGlobal = vi.fn();
  const onDetachGlobal = vi.fn();

  const { rerender } = render(
    <GlobalSectionPanel
      globalSections={[globalSection]}
      onMakeGlobal={vi.fn()}
      onInsertGlobal={onInsertGlobal}
      onDetachGlobal={onDetachGlobal}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Insert Announcement" }));
  expect(onInsertGlobal).toHaveBeenCalledWith("global-1");

  rerender(
    <GlobalSectionPanel
      globalSections={[globalSection]}
      attachedGlobalId="global-1"
      onMakeGlobal={vi.fn()}
      onInsertGlobal={onInsertGlobal}
      onDetachGlobal={onDetachGlobal}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Detach Announcement" }));
  const detached = onDetachGlobal.mock.calls[0][0];
  expect(detached).toEqual(globalSection.section);
  expect(detached).not.toBe(globalSection.section);
});
