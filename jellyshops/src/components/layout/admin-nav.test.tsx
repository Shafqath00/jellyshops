import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, it, expect } from "vitest";
import { AdminNav } from "./admin-nav";
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/products" }));

it("finds admin destinations without pretending to search records", async () => {
  const user = userEvent.setup();
  render(<AdminNav />);
  await user.type(screen.getByRole("searchbox", { name: "Search pages" }), "stock");
  expect(screen.getByRole("link", { name: "Stock" })).toHaveAttribute("href", "/admin/products/stock");
  expect(screen.queryByRole("link", { name: "Orders" })).toBeNull();
  await user.clear(screen.getByRole("searchbox", { name: "Search pages" }));
  expect(screen.getByRole("link", { name: "Collections" })).toHaveAttribute("href", "/admin/products/collections");
});
