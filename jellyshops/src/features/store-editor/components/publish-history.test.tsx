import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { PublishHistory, type PublishedVersion } from "./publish-history";

const versions = (liveId: string): PublishedVersion[] => [
  { id: "pub-b", sourceGeneration: 5, publishedAt: "2026-10-31T10:00:00.000Z", isCurrent: liveId === "pub-b" },
  { id: "pub-a", sourceGeneration: 3, publishedAt: "2026-10-30T10:00:00.000Z", isCurrent: liveId === "pub-a" },
];

it("lists published versions, marks the live one and restores an earlier one", async () => {
  const user = userEvent.setup();
  let live = "pub-b";
  const list = vi.fn(async () => versions(live));
  const restore = vi.fn(async (id: string) => { live = id; });
  const onRestored = vi.fn();
  render(<PublishHistory list={list} restore={restore} onRestored={onRestored} />);

  await user.click(screen.getByRole("button", { name: "Version history" }));
  const dialog = await screen.findByRole("dialog", { name: "Published versions" });
  await waitFor(() => expect(dialog).toHaveTextContent("Live now"));
  expect(screen.getAllByRole("button", { name: /^Restore the version/ })).toHaveLength(1);

  await user.click(screen.getByRole("button", { name: /^Restore the version/ }));
  expect(restore).toHaveBeenCalledWith("pub-a");
  await waitFor(() => expect(dialog).toHaveTextContent("Your draft was not changed."));
  expect(onRestored).toHaveBeenCalledTimes(1);
});

it("shows the reason when versions cannot be loaded", async () => {
  const user = userEvent.setup();
  render(<PublishHistory list={async () => { throw new Error("Publish history is not available."); }} restore={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Version history" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Publish history is not available.");
});
