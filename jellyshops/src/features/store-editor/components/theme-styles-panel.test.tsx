import { fireEvent, render, screen } from "@testing-library/react";
import { applyThemeStyle, listThemeStyles } from "@jelly/storefront-themes";
import { expect, it, vi } from "vitest";
import { styleIsApplied, ThemeStylesPanel } from "./theme-styles-panel";

const styles = listThemeStyles("jelly-avenue");

it("lists the theme's styles, marks the current one and applies another", () => {
  const onApply = vi.fn();
  const settings = applyThemeStyle({}, styles[0]);
  render(<ThemeStylesPanel styles={styles} settings={settings} onApply={onApply} />);
  expect(screen.getByRole("button", { name: "Gallery (current style)" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Apply the Midnight style" }));
  expect(onApply).toHaveBeenCalledWith(styles[1]);
});

it("knows when a style is already applied, and shows nothing for themes without styles", () => {
  expect(styleIsApplied(applyThemeStyle({ other: 1 }, styles[2]), styles[2])).toBe(true);
  expect(styleIsApplied(applyThemeStyle({}, styles[2]), styles[3])).toBe(false);
  const { container } = render(<ThemeStylesPanel styles={[]} settings={{}} onApply={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
});
