import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ChangelogPage from "./page";
import { changelog, formatChangelogDate } from "./changelog-content";

vi.mock("@/features/brand/fonts", () => ({ geist: { variable: "" }, geistMono: { variable: "" } }));

it("lists every entry newest first with a readable date", () => {
  render(<ChangelogPage />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/what.s new in jellyshop/i);
  const titles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
  expect(titles).toEqual(expect.arrayContaining(changelog.map((entry) => entry.title)));
  const dates = changelog.map((entry) => entry.date);
  expect([...dates].sort().reverse()).toEqual(dates);
  expect(formatChangelogDate("2026-11-15")).toBe("15 November 2026");
});

it("announces the bulk import that the home page pill names", () => {
  render(<ChangelogPage />);
  const entry = screen.getByRole("heading", { level: 2, name: /bulk import your catalogue/i }).closest("article")!;
  expect(within(entry).getByText(/csv or excel/i)).toBeInTheDocument();
});

it("points in-page links back at the home page", () => {
  render(<ChangelogPage />);
  const footer = screen.getByRole("contentinfo");
  expect(within(footer).getByRole("link", { name: "Questions" })).toHaveAttribute("href", "/#faq");
  expect(within(footer).getByRole("link", { name: "Changelog" })).toHaveAttribute("href", "/changelog");
});
