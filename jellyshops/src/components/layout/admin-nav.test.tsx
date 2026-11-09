import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { vi, it, expect, beforeEach } from "vitest";
import { AdminNav } from "./admin-nav";
import { AdminSearch } from "./admin-search";

const push = vi.fn();
let pathname = "/admin/products/collections";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push }) }));
beforeEach(() => { push.mockClear(); });

it("opens only the group you are in and marks the current page", () => {
  render(<AdminNav />);
  const products = screen.getByRole("list", { name: "Products" });
  expect(within(products).getByRole("link", { name: "Collections" })).toHaveAttribute("aria-current", "page");
  expect(within(products).getByRole("link", { name: "All products" })).not.toHaveAttribute("aria-current");
  expect(screen.queryByRole("link", { name: "Messages" })).toBeNull();
  expect(screen.getByRole("link", { name: "Customers" })).toHaveAttribute("href", "/admin/customers");
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/admin/settings");
});

it("treats a product's own page as part of All products", () => {
  pathname = "/admin/products/123";
  render(<AdminNav />);
  expect(screen.getByRole("link", { name: "All products" })).toHaveAttribute("aria-current", "page");
  pathname = "/admin/products/collections";
});

it("finds admin pages from the top bar without pretending to search records", async () => {
  const user = userEvent.setup();
  const { container } = render(<AdminSearch />);
  const box = screen.getByRole("combobox", { name: "Search pages" });
  await user.type(box, "invent");
  expect(screen.getByRole("option", { name: /Inventory/ })).toBeVisible();
  expect(screen.queryByRole("option", { name: /Orders/ })).toBeNull();
  await user.keyboard("{Enter}");
  expect(push).toHaveBeenCalledWith("/admin/products/inventory");
  await user.type(box, "zzz");
  expect(screen.getByText("No pages match “zzz”.")).toBeVisible();
  await user.keyboard("{Escape}");
  expect(box).toHaveValue("");
  const results = await axe.run(container, { rules: { region: { enabled: false } } });
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

it("moves through matches with the arrow keys and focuses with Ctrl+K", async () => {
  const user = userEvent.setup();
  render(<AdminSearch />);
  await user.keyboard("{Control>}k{/Control}");
  const box = screen.getByRole("combobox", { name: "Search pages" });
  expect(box).toHaveFocus();
  await user.type(box, "products");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(push).toHaveBeenCalledTimes(1);
  expect(push.mock.calls[0][0]).not.toBe("/admin/products");
});
