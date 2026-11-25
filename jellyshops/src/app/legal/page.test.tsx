import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import TermsPage from "./terms/page";
import PrivacyPage from "./privacy/page";
import CookiesPage from "./cookies/page";
import { formatLegalDate, LEGAL_VERSION, legalDocuments } from "./legal-content";

vi.mock("@/features/brand/fonts", () => ({ geist: { variable: "" }, geistMono: { variable: "" } }));

const pages = [
  ["terms", TermsPage, /terms of service/i],
  ["privacy", PrivacyPage, /privacy policy/i],
  ["cookies", CookiesPage, /cookie policy/i],
] as const;

it.each(pages)("draws the %s page with a heading, version and every section", (slug, Page, title) => {
  render(<Page />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
  expect(screen.getByText(new RegExp(`Version ${LEGAL_VERSION}`))).toBeInTheDocument();
  const doc = legalDocuments[slug];
  const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
  for (const section of doc.sections) expect(headings).toContain(section.title);
});

it("links the three legal pages from each page and marks the current one", () => {
  render(<CookiesPage />);
  const nav = screen.getByRole("navigation", { name: "Legal pages" });
  expect(within(nav).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/legal/terms");
  expect(within(nav).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/legal/privacy");
  expect(within(nav).getByRole("link", { name: "Cookies" })).toHaveAttribute("aria-current", "page");
});

it("has a table of contents that points at real sections", () => {
  render(<TermsPage />);
  const toc = screen.getByRole("navigation", { name: "On this page" });
  for (const link of within(toc).getAllByRole("link")) {
    expect(document.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull();
  }
});

it("section numbers run in order and ids are unique", () => {
  for (const doc of Object.values(legalDocuments)) {
    const ids = doc.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    doc.sections.forEach((section, index) => expect(section.title.startsWith(`${index + 1}. `)).toBe(true));
  }
  expect(formatLegalDate("2026-11-25")).toBe("25 November 2026");
});
