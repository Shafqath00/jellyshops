import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { isSafeMenuImageUrl, normalizeMenuImage, readMenuImage } from "@jelly/storefront-schema";
import { MenuTree, megaMenuParts, shownMenuItems, type MenuTreeItem } from "./sections/menu-tree";
import { headerMegaMenu } from "./sections/header";

afterEach(cleanup);

const link = (id: string, label: string, children: MenuTreeItem[] = [], image?: MenuTreeItem["image"]): MenuTreeItem => ({ id, label, target: { kind: "external", url: `https://shop.test/${id}` }, ...(image ? { image } : {}), children });
const hrefFor = (item: MenuTreeItem) => item.target.kind === "external" ? item.target.url : null;
const photo = (name: string) => ({ url: `https://cdn.shop.test/${name}.webp`, alt: `${name} room` });
const menu = [
  link("home", "Home"),
  link("beds", "Beds", [
    link("by-type", "Bed types", [link("divan", "Divan beds"), link("ottoman", "Ottoman beds")]),
    link("by-size", "Bed sizes", [link("double", "Double"), link("king", "King")]),
    link("bedroom", "Bedroom", [], photo("bedroom")),
    link("kids", "Kids rooms", [], photo("kids")),
    link("sale", "Sale"),
  ]),
];

it("splits a top link into columns, plain links and photo tiles", () => {
  const [, beds] = shownMenuItems(menu, hrefFor);
  const parts = megaMenuParts(beds.children);
  expect(parts.columns.map((entry) => entry.item.label)).toEqual(["Bed types", "Bed sizes"]);
  expect(parts.tiles.map((entry) => entry.item.label)).toEqual(["Bedroom", "Kids rooms"]);
  expect(parts.links.map((entry) => entry.item.label)).toEqual(["Sale"]);
});

it("draws the large menu as a panel with columns, tiles and Shop all", () => {
  render(<nav aria-label="Primary"><MenuTree items={menu} hrefFor={hrefFor} variant="bar" mega={{ photoShape: "square" }} /></nav>);
  const toggle = screen.getByRole("button", { name: "Beds menu" });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
  expect(panel).toHaveClass("jelly-mega");
  expect(panel).toHaveAttribute("data-photo-shape", "square");
  expect(within(panel).getByRole("link", { name: "Bed types" })).toHaveAttribute("href", "https://shop.test/by-type");
  expect(within(panel).getByRole("link", { name: "Ottoman beds" })).toBeInTheDocument();
  expect(within(panel).getByRole("link", { name: "Sale" })).toBeInTheDocument();
  const tile = within(panel).getByRole("link", { name: /Kids rooms/ });
  expect(tile).toHaveAttribute("href", "https://shop.test/kids");
  expect(within(tile).getByRole("img", { name: "kids room" })).toHaveAttribute("src", "https://cdn.shop.test/kids.webp");
  expect(within(panel).getByRole("link", { name: "Shop all Beds" })).toHaveAttribute("href", "https://shop.test/beds");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});

it("keeps the old dropdown when the large menu is off", () => {
  render(<MenuTree items={menu} hrefFor={hrefFor} variant="bar" />);
  fireEvent.click(screen.getByRole("button", { name: "Beds menu" }));
  expect(document.querySelector(".jelly-mega")).toBeNull();
  expect(document.querySelector("ul.jelly-submenu")).not.toBeNull();
});

it("shows photo links as tiles in the phone menu, above the other links", () => {
  render(<MenuTree items={menu} hrefFor={hrefFor} variant="panel" mega={{}} />);
  const group = screen.getByText("Beds").closest("details")!;
  const tiles = group.querySelector("ul.jelly-menu-tiles")!;
  expect(within(tiles as HTMLElement).getAllByRole("link").map((element) => element.textContent)).toEqual(["Bedroom", "Kids rooms"]);
  expect(within(group).getByRole("link", { name: "Divan beds" })).toBeInTheDocument();
  expect(within(group).getByRole("link", { name: "Sale" })).toBeInTheDocument();
});

it("never draws an unsafe photo address", () => {
  const unsafe = [link("rooms", "Rooms", [link("bad", "Bad", [], { url: "javascript:alert(1)" }), link("plain", "Plain", [], { url: "http://cdn.example.com/a.webp" })])];
  render(<MenuTree items={unsafe} hrefFor={hrefFor} variant="bar" mega={{}} />);
  expect(document.querySelectorAll(".jelly-mega img")).toHaveLength(0);
  expect(screen.getByRole("link", { name: "Bad" })).toBeInTheDocument();
});

it("reads the header setting", () => {
  expect(headerMegaMenu({})).toBeUndefined();
  expect(headerMegaMenu({ menuStyle: "dropdown" })).toBeUndefined();
  expect(headerMegaMenu({ menuStyle: "mega" })).toEqual({ photoShape: "landscape" });
  expect(headerMegaMenu({ menuStyle: "mega", megaPhotoShape: "portrait" })).toEqual({ photoShape: "portrait" });
  expect(headerMegaMenu({ menuStyle: "mega", megaPhotoShape: "huge" })).toEqual({ photoShape: "landscape" });
});

it("accepts only https addresses and store paths for menu photos", () => {
  expect(isSafeMenuImageUrl("https://cdn.example.com/a.webp")).toBe(true);
  expect(isSafeMenuImageUrl("/api/public/media/store/1")).toBe(true);
  for (const url of ["http://cdn.example.com/a.webp", "//evil.example/a.webp", "javascript:alert(1)", "data:image/png;base64,AA", "/a b.webp", "/a\".webp", ""]) expect(isSafeMenuImageUrl(url)).toBe(false);
  expect(isSafeMenuImageUrl("http://127.0.0.1:3001/api/public/media/s/1")).toBe(false);
  expect(isSafeMenuImageUrl("http://127.0.0.1:3001/api/public/media/s/1", { allowLocalHttp: true })).toBe(true);
  expect(isSafeMenuImageUrl("http://cdn.example.com/a.webp", { allowLocalHttp: true })).toBe(false);
  expect(normalizeMenuImage({ url: " /themes/x/a.webp ", alt: "  " })).toEqual({ url: "/themes/x/a.webp" });
  expect(() => normalizeMenuImage({ url: "http://a.example/x.webp" })).toThrow("Menu photo");
  expect(readMenuImage({ url: "javascript:alert(1)" })).toBeUndefined();
  expect(readMenuImage("nope")).toBeUndefined();
});
