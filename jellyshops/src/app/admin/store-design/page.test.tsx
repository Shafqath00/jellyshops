import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AdminNav } from "@/components/layout/admin-nav";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

vi.mock("next/navigation", () => ({
  redirect,
  usePathname: () => "/admin",
}));

import StoreDesignPage from "./page";

beforeEach(() => {
  redirect.mockClear();
});

it("redirects the legacy store design route to the Online Store editor", () => {
  expect(() => StoreDesignPage()).toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/admin/online-store/editor");
});

it("links merchant navigation to Online Store", () => {
  render(<AdminNav />);

  fireEvent.click(screen.getByText("Online Store"));
  expect(screen.getByRole("link", { name: "Themes" })).toHaveAttribute("href", "/admin/online-store");
});
