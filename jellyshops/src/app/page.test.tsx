import { render, screen } from "@testing-library/react";
import HomePage from "./page";

it("renders the Jelly Shop entry point", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { name: /jelly shop/i })).toBeVisible();
});

it("uses Tailwind utilities for the primary merchant action", () => {
  render(<HomePage />);
  expect(screen.getByRole("link", { name: /open merchant studio/i }))
    .toHaveClass("bg-jelly-ink", "text-jelly-paper", "shadow-jelly-guava");
});
