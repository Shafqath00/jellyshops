import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AdminThemeToggle } from "./admin-theme-toggle";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it("restores the saved theme, persists changes, and removes the class on unmount", () => {
  localStorage.setItem("jelly-admin-theme", "dark");
  const view = render(<AdminThemeToggle />);
  expect(document.documentElement).toHaveClass("admin-dark");
  fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
  expect(localStorage.getItem("jelly-admin-theme")).toBe("light");
  expect(document.documentElement).not.toHaveClass("admin-dark");
  view.unmount();
  expect(document.documentElement).not.toHaveClass("admin-dark");
});
