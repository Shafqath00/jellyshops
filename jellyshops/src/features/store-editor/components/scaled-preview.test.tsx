import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { previewFit, ScaledPreview } from "./scaled-preview";

it("draws a narrow editor's desktop preview at full width and shrinks it to fit", () => {
  expect(previewFit({ width: 780, height: 520 }, 1280)).toEqual({ width: 1280, height: 520 / (780 / 1280), scale: 780 / 1280 });
  // Phones and tablets shrink the same way when the editor is narrower than the device.
  expect(previewFit({ width: 300, height: 600 }, 390)).toMatchObject({ width: 390, scale: 300 / 390 });
});

it("fills the room it has when that is already wide enough", () => {
  expect(previewFit({ width: 1600, height: 900 }, 1280)).toEqual({ width: 1600, height: 900, scale: 1 });
  expect(previewFit({ width: 390, height: 700 }, 390)).toEqual({ width: 390, height: 700, scale: 1 });
  // Before the first measurement nothing is shrunk.
  expect(previewFit({ width: 0, height: 0 }, 1280)).toMatchObject({ scale: 1 });
});

it("renders its content inside the scaled box", () => {
  render(<ScaledPreview minWidth={1280}><p>Store</p></ScaledPreview>);
  expect(screen.getByText("Store")).toBeInTheDocument();
});
