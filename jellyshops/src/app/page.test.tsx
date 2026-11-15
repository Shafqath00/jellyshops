import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, vi } from "vitest";
import HomePage from "./page";
import { integrations } from "./home-content";

vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "geist" }), Geist_Mono: () => ({ variable: "geist-mono" }) }));
vi.mock("lenis", () => ({ default: class { raf() {} destroy() {} } }));

beforeAll(() => {
  // jsdom has no dialog methods, matchMedia or IntersectionObserver.
  HTMLDialogElement.prototype.showModal ??= vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
  HTMLDialogElement.prototype.close ??= vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); });
  window.matchMedia ??= vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
  globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } } as unknown as typeof IntersectionObserver;
});

it("says what Jellyshop does and who it is for in the hero", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { level: 1 }).textContent?.replace(/\s+/g, " ").trim()).toBe("Launch your store. Sell from day one.");
  expect(screen.getByText(/all-in-one platform for independent brands/i)).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /start free/i })[0]).toHaveAttribute("href", "/signup");
  expect(screen.getAllByRole("button", { name: /take the tour/i }).length).toBeGreaterThan(0);
});

it("has every section in the agreed order", () => {
  render(<HomePage />);
  const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
  const expected = [/four steps/i, /every tool/i, /design made for your shop/i, /every place your customers/i, /tools you already use/i, /measurable results/i, /pricing/i, /trusted/i, /frequently asked/i, /live this afternoon/i];
  let from = 0;
  for (const pattern of expected) {
    const index = headings.findIndex((text, i) => i >= from && pattern.test(text));
    expect(index, String(pattern)).toBeGreaterThanOrEqual(from);
    from = index + 1;
  }
});

it("opens the mega menu from the keyboard-reachable button and closes it with Escape", () => {
  render(<HomePage />);
  const nav = screen.getByRole("navigation", { name: "Main" });
  const product = within(nav).getByRole("button", { name: /product/i });
  fireEvent.click(product);
  expect(product).toHaveAttribute("aria-expanded", "true");
  expect(within(nav).getByRole("link", { name: /storefront builder/i })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(product).toHaveAttribute("aria-expanded", "false");
});

it("switches pricing to yearly", () => {
  render(<HomePage />);
  fireEvent.click(screen.getByRole("radio", { name: /yearly/i }));
  expect(screen.getByRole("radio", { name: /yearly/i })).toHaveAttribute("aria-checked", "true");
  expect(screen.getAllByText(/billed yearly/i).length).toBe(2);
});

it("expands an FAQ answer", () => {
  render(<HomePage />);
  const question = screen.getByRole("button", { name: /how do i get paid/i });
  expect(question).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(question);
  expect(question).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(/connect a stripe account during setup/i)).toBeInTheDocument();
});

it("uses real brand logos only for real integrations and invented names for shops", () => {
  render(<HomePage />);
  const withLogo = integrations.filter((i) => i.logo).map((i) => i.name);
  expect(withLogo).toEqual(["Stripe", "YouTube", "Vimeo", "Spotify", "SoundCloud"]);
  expect(screen.getByText(/shop names are illustrative/i)).toBeInTheDocument();
  expect(screen.getByText(/illustrative merchants and results/i)).toBeInTheDocument();
});

it("marks channels that are not built yet", () => {
  render(<HomePage />);
  const sell = screen.getByRole("heading", { level: 2, name: /every place your customers/i }).closest("section")!;
  expect(within(sell).getAllByText("Soon")).toHaveLength(2);
});

it("opens the product tour", () => {
  render(<HomePage />);
  fireEvent.click(screen.getAllByRole("button", { name: /take the tour/i })[0]);
  expect(screen.getAllByText(/from a blank store to your first order/i)[0]).toBeInTheDocument();
});
