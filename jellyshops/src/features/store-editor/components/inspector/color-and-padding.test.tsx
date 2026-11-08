import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { getBlockDefinition } from "@jelly/storefront-registry";
import { MAX_RECENT_COLORS, normalizeHex, readRecentColors, rememberColor, themePalette } from "../../color-palette";
import { ColorPaletteProvider } from "./color-palette-context";
import { LinkedPaddingControl, isPaddingControl } from "./linked-padding";
import { OptionalColorControl } from "./style-controls";

beforeEach(() => window.localStorage.clear());

it("builds the palette from the theme and its colour schemes, without repeats", () => {
  const palette = themePalette("jelly-signature", { colorSchemes: { count: "5", scheme2: { name: "Sand", background: "#010203" }, scheme5: { text: "#040506" } } });
  expect(palette[0]).toEqual({ label: "Page background", color: "#faf9f7" });
  expect(new Set(palette.map((item) => item.color)).size).toBe(palette.length);
  expect(palette).toContainEqual({ label: "Scheme 2: Sand background", color: "#010203" });
  expect(palette).toContainEqual({ label: "Scheme 5 text", color: "#040506" });
  // A colour the theme already offers keeps its first name.
  expect(palette.filter((item) => item.color === "#faf9f7")).toEqual([{ label: "Page background", color: "#faf9f7" }]);
  expect(palette.every((item) => /^#[0-9a-f]{6}$/.test(item.color))).toBe(true);
});

it("remembers recent colours newest first, once each, up to the limit", () => {
  for (let index = 0; index < MAX_RECENT_COLORS + 3; index++) rememberColor(`#00000${index.toString(16)}`.padEnd(7, "0"));
  rememberColor("#112233");
  rememberColor("112233");
  const recent = readRecentColors();
  expect(recent[0]).toBe("#112233");
  expect(recent.filter((item) => item === "#112233")).toHaveLength(1);
  expect(recent).toHaveLength(MAX_RECENT_COLORS);
  expect(normalizeHex("ABCDEF")).toBe("#abcdef");
  expect(normalizeHex("red")).toBeNull();
  window.localStorage.setItem("jelly-editor-recent-colors", "not json");
  expect(readRecentColors()).toEqual([]);
});

it("offers theme and recent colours under a colour field and applies one with a click", async () => {
  rememberColor("#123456");
  const onChange = vi.fn();
  render(<ColorPaletteProvider value={[{ label: "Text", color: "#1c1b19" }]}><OptionalColorControl label="Background" value={undefined} onChange={onChange} /></ColorPaletteProvider>);
  expect(screen.queryByRole("group", { name: /colour choices/ })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Background palette" }));
  expect(screen.getByRole("button", { name: "Use Recent colour #123456" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Use Text #1c1b19" }));
  expect(onChange).toHaveBeenCalledWith("#1c1b19");
  expect(readRecentColors()[0]).toBe("#1c1b19");
});

it("takes a typed hex colour with or without #, and ignores nonsense", async () => {
  const onChange = vi.fn();
  render(<OptionalColorControl label="Text" value={undefined} onChange={onChange} />);
  const box = screen.getByLabelText("Text");
  await userEvent.type(box, "ABCDEF{Enter}");
  expect(onChange).toHaveBeenLastCalledWith("#abcdef");
  await userEvent.clear(box);
  await userEvent.type(box, "nope{Enter}");
  expect(onChange).toHaveBeenCalledTimes(1);
  // The colour just typed is now a recent colour, so the palette button appears.
  expect(screen.getByRole("button", { name: "Text palette" })).toBeInTheDocument();
});

const padding = getBlockDefinition("heading")!.controls.filter(isPaddingControl);

it("changes all sides together while linked, and one side when unlinked", async () => {
  expect(padding.map((control) => control.key)).toHaveLength(4);
  const onPatch = vi.fn();
  const values = { blockPaddingTop: 8, blockPaddingRight: 8, blockPaddingBottom: 8, blockPaddingLeft: 8 };
  render(<LinkedPaddingControl controls={padding} values={values} onPatch={onPatch} />);
  const top = screen.getByLabelText("Top");
  await userEvent.clear(top);
  await userEvent.type(top, "24{Enter}");
  expect(onPatch).toHaveBeenLastCalledWith({ blockPaddingTop: 24, blockPaddingBottom: 24, blockPaddingLeft: 24, blockPaddingRight: 24 });
  await userEvent.click(screen.getByRole("button", { name: /Padding sides linked/ }));
  const left = screen.getByLabelText("Left");
  await userEvent.clear(left);
  await userEvent.type(left, "4{Enter}");
  expect(onPatch).toHaveBeenLastCalledWith({ blockPaddingLeft: 4 });
});

it("starts unlinked when the sides differ, links them to the first side on request, steps with arrow keys and resets", async () => {
  const onPatch = vi.fn();
  render(<LinkedPaddingControl controls={padding} values={{ blockPaddingTop: 10, blockPaddingRight: 20, blockPaddingBottom: 10, blockPaddingLeft: 30 }} onPatch={onPatch} />);
  const link = screen.getByRole("button", { name: /Padding sides separate/ });
  expect(link).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(link);
  expect(onPatch).toHaveBeenLastCalledWith({ blockPaddingTop: 10, blockPaddingRight: 10, blockPaddingBottom: 10, blockPaddingLeft: 10 });
  await userEvent.click(screen.getByLabelText("Right"));
  await userEvent.keyboard("{ArrowUp}");
  expect(onPatch).toHaveBeenLastCalledWith({ blockPaddingTop: 21, blockPaddingRight: 21, blockPaddingBottom: 21, blockPaddingLeft: 21 });
  await userEvent.click(screen.getByRole("button", { name: "Reset padding" }));
  expect(onPatch).toHaveBeenLastCalledWith({ blockPaddingTop: undefined, blockPaddingRight: undefined, blockPaddingBottom: undefined, blockPaddingLeft: undefined });
});
