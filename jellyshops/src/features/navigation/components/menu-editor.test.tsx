import { expect, it } from "vitest";
import { reorderMenuItem } from "./menu-editor";
import { MenuEditor } from "./menu-editor";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
afterEach(cleanup);

it("adds a collection link by stable ID with a searchable collection picker", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<MenuEditor menu={{ id: "menu", storeId: "a", revision: 1, name: "Main", handle: "main", items: [] }} collections={[{ id: "uuid", title: "Beds", handle: "beds" }]} onChange={onChange} onSave={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Add link" }));
  await user.type(screen.getByLabelText("Link label"), "Beds");
  await user.selectOptions(screen.getByLabelText("Destination type"), "collection");
  await user.type(screen.getByLabelText("Search collections"), "bed");
  await user.selectOptions(screen.getByLabelText("Collection"), "uuid");
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ label: "Beds", target: { kind: "collection", resourceId: "uuid" }, children: [] })]);
});

it("edits labels while retaining nested items and promotes children when a parent is removed", async () => {
  const onChange = vi.fn(); const user = userEvent.setup();
  const child = { id: "child", label: "Search", target: { kind: "search" as const }, children: [] };
  render(<MenuEditor menu={{ id: "m", storeId: "a", revision: 1, name: "Main", handle: "main", items: [{ id: "parent", label: "Home", target: { kind: "home" }, children: [child] }] }} onChange={onChange} onSave={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Edit Home" }));
  await user.clear(screen.getByLabelText("Link label")); await user.type(screen.getByLabelText("Link label"), "Welcome");
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: "parent", label: "Welcome", children: [child] })]);
  await user.click(screen.getByRole("button", { name: "Remove Home" }));
  expect(onChange).toHaveBeenLastCalledWith([child]);
});

it("requires labels and destinations, refuses unsafe URLs and accepts store paths", async () => {
  const onChange = vi.fn(); const user = userEvent.setup();
  render(<MenuEditor menu={{ id: "m", storeId: "a", revision: 1, name: "Main", handle: "main", items: [] }} onChange={onChange} onSave={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Add link" }));
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a link label");
  await user.type(screen.getByLabelText("Link label"), "More");
  await user.selectOptions(screen.getByLabelText("Destination type"), "external");
  await user.type(screen.getByLabelText("URL", { exact: true }), "javascript:alert(1)");
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  expect(screen.getByRole("alert")).toHaveTextContent("full web address");
  await user.clear(screen.getByLabelText("URL", { exact: true }));
  await user.type(screen.getByLabelText("URL", { exact: true }), "//other.example/page");
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  expect(screen.getByRole("alert")).toHaveTextContent("full web address");
  expect(onChange).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText("URL", { exact: true }));
  await user.type(screen.getByLabelText("URL", { exact: true }), "/pages/faq");
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ target: { kind: "external", url: "/pages/faq" } })]);
  await user.click(screen.getByRole("button", { name: "Add link" }));
  await user.type(screen.getAllByLabelText("Link label").at(-1)!, "More");
  await user.selectOptions(screen.getByLabelText("Destination type"), "anchor");
  await user.type(screen.getByLabelText("Anchor", { exact: true }), "#details");
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ target: { kind: "anchor", anchor: "#details" } })]);
});

it("reorders a nested item without changing stable ids or targets", () => {
  const items = [{
    id: "parent",
    label: "Parent",
    target: { kind: "home" as const },
    children: [
      { id: "first", label: "First", target: { kind: "page" as const, resourceId: "page-1" }, children: [] },
      { id: "second", label: "Second", target: { kind: "external" as const, url: "https://example.com" }, children: [] },
    ],
  }];

  const reordered = reorderMenuItem(items, "second", { parentId: "parent", index: 0 });

  expect(reordered[0].children.map((item) => item.id)).toEqual(["second", "first"]);
  expect(reordered[0].children[1].target).toEqual({ kind: "page", resourceId: "page-1" });
});

it("adds a link inside another link, edits and removes nested links", async () => {
  const onChange = vi.fn(); const user = userEvent.setup();
  const items = [{ id: "beds", label: "Beds", target: { kind: "home" as const }, children: [{ id: "divan", label: "Divan beds", target: { kind: "search" as const }, children: [{ id: "small", label: "Small double", target: { kind: "search" as const }, children: [] }] }] }];
  render(<MenuEditor menu={{ id: "m", storeId: "a", revision: 1, name: "Main", handle: "main", items }} onChange={onChange} onSave={() => {}} />);
  // Third level is the deepest: no "Add inside" on it.
  expect(screen.getByRole("button", { name: "Add link inside Divan beds" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add link inside Small double" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Add link inside Beds" }));
  expect(screen.getByText("New link inside Beds")).toBeInTheDocument();
  await user.type(screen.getByLabelText("Link label"), "Ottoman beds");
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: "beds", children: [expect.objectContaining({ id: "divan" }), expect.objectContaining({ label: "Ottoman beds", target: { kind: "home" } })] })]);
  await user.click(screen.getByRole("button", { name: "Edit Small double" }));
  await user.clear(screen.getByLabelText("Link label")); await user.type(screen.getByLabelText("Link label"), "Small doubles");
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  expect(onChange.mock.lastCall?.[0][0].children[0].children[0]).toMatchObject({ id: "small", label: "Small doubles" });
  await user.click(screen.getByRole("button", { name: "Remove Divan beds" }));
  expect(onChange.mock.lastCall?.[0][0].children).toEqual([expect.objectContaining({ id: "small" })]);
});

it("uploads a photo for the large menu and keeps its description", async () => {
  const onChange = vi.fn(); const user = userEvent.setup();
  const uploadImage = vi.fn(async () => "https://api.example/api/public/media/a/photo-1");
  render(<MenuEditor menu={{ id: "m", storeId: "a", revision: 1, name: "Main", handle: "main", items: [] }} onChange={onChange} onSave={() => {}} uploadImage={uploadImage} />);
  await user.click(screen.getByRole("button", { name: "Add link" }));
  await user.type(screen.getByLabelText("Link label"), "Bedroom");
  await user.upload(screen.getByLabelText("Upload photo"), new File(["x"], "bedroom.webp", { type: "image/webp" }));
  expect(uploadImage).toHaveBeenCalledTimes(1);
  await user.type(await screen.findByLabelText("Photo description"), "A calm bedroom");
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ label: "Bedroom", image: { url: "https://api.example/api/public/media/a/photo-1", alt: "A calm bedroom" } })]);
});

it("shows a plain message when a photo upload fails", async () => {
  const user = userEvent.setup();
  render(<MenuEditor menu={{ id: "m", storeId: "a", revision: 1, name: "Main", handle: "main", items: [] }} onChange={() => {}} onSave={() => {}} uploadImage={async () => { throw new Error("413"); }} />);
  await user.click(screen.getByRole("button", { name: "Add link" }));
  await user.upload(screen.getByLabelText("Upload photo"), new File(["x"], "big.webp", { type: "image/webp" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be uploaded");
});
