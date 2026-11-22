import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AdminNav } from "@/components/layout/admin-nav";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

vi.mock("next/navigation", () => ({
  redirect,
  usePathname: () => "/admin/s/myshop",
  useParams: () => ({ shop: "myshop" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import StoreDesignPage from "./page";

beforeEach(() => {
  redirect.mockClear();
});

it("redirects the legacy store design route to the shop's Online Store editor", async () => {
  await expect(StoreDesignPage({ params: Promise.resolve({ shop: "myshop" }) })).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/admin/s/myshop/online-store/editor");
});

it("links merchant navigation to the shop's Online Store", () => {
  render(<AdminNav />);

  expect(screen.getByRole("link", { name: "Online Store" })).toHaveAttribute("href", "/admin/s/myshop/online-store");
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
});
