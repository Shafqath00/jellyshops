import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { MenuTree, type MenuTreeItem } from "./sections/menu-tree";

const link = (id: string, label: string, children: MenuTreeItem[] = []): MenuTreeItem => ({ id, label, target: { kind: "external", url: `https://shop.test/${id}` }, children });
const heading = (id: string, label: string, children: MenuTreeItem[]): MenuTreeItem => ({ id, label, target: { kind: "page", resourceId: "missing" }, children });
const hrefFor = (item: MenuTreeItem) => item.target.kind === "external" ? item.target.url : null;
const menu = [
  link("home", "Home"),
  link("women", "Women", [link("dresses", "Dresses", [link("maxi", "Maxi dresses")]), link("tops", "Tops")]),
  heading("brands", "Brands", [link("acme", "Acme")]),
  heading("empty", "Nothing here", [heading("deeper", "Still nothing", [])]),
];

it("draws dropdowns that open from their arrow button and close with Escape", () => {
  render(<nav aria-label="Primary"><MenuTree items={menu} hrefFor={hrefFor} variant="bar" /></nav>);
  expect(screen.getByRole("link", { name: "Women" })).toHaveAttribute("href", "https://shop.test/women");
  const toggle = screen.getByRole("button", { name: "Women menu" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  const submenu = document.getElementById(toggle.getAttribute("aria-controls")!)!;
  expect(within(submenu).getByRole("link", { name: "Dresses" })).toBeInTheDocument();
  expect(within(submenu).getByRole("link", { name: "Maxi dresses" })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveFocus();
  // Hover would show it again; Escape keeps it hidden until the pointer leaves.
  const item = toggle.closest("li")!;
  expect(item).toHaveAttribute("data-hover-off", "true");
  fireEvent.pointerLeave(item);
  expect(item).not.toHaveAttribute("data-hover-off");
});

it("opens one dropdown at a time and closes it on an outside click", () => {
  render(<><MenuTree items={menu} hrefFor={hrefFor} variant="bar" /><p>Outside</p></>);
  const women = screen.getByRole("button", { name: "Women menu" });
  const brands = screen.getByRole("button", { name: "Brands" });
  fireEvent.click(women);
  fireEvent.click(brands);
  expect(women).toHaveAttribute("aria-expanded", "false");
  expect(brands).toHaveAttribute("aria-expanded", "true");
  fireEvent.pointerDown(screen.getByText("Outside"));
  expect(brands).toHaveAttribute("aria-expanded", "false");
});

it("leaves out items that lead nowhere", () => {
  render(<MenuTree items={menu} hrefFor={hrefFor} variant="bar" />);
  expect(screen.queryByText("Nothing here")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Brands" })).toBeInTheDocument();
});

it("folds groups open in the phone menu with the parent page as View all", () => {
  render(<MenuTree items={menu} hrefFor={hrefFor} variant="panel" />);
  const women = screen.getByText("Women", { selector: "summary" }).closest("details")!;
  expect(women).not.toHaveAttribute("open");
  expect(within(women).getByRole("link", { name: "View all Women" })).toHaveAttribute("href", "https://shop.test/women");
  expect(within(women).getByText("Maxi dresses")).toBeInTheDocument();
  expect(within(screen.getByText("Brands", { selector: "summary" }).closest("details")!).queryByText(/View all/)).not.toBeInTheDocument();
});

it("keeps the footer to top-level links", () => {
  render(<MenuTree items={menu} hrefFor={hrefFor} />);
  expect(screen.getAllByRole("link").map((element) => element.textContent)).toEqual(["Home", "Women"]);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
