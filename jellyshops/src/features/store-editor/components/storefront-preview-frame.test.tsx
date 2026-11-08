import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { StorefrontPreviewFrame } from "./storefront-preview-frame";

it("renders an interactive preview in its own document with storefront styles", async () => {
  function Preview() {
    const [text, setText] = useState("Edit heading");
    return <StorefrontPreviewFrame title="Storefront preview" themeId="fresh-market" style={{ color: "green" }}><button onClick={() => setText("Selected")}>{text}</button></StorefrontPreviewFrame>;
  }
  render(<Preview />);
  const frame = screen.getByTitle("Storefront preview") as HTMLIFrameElement;
  fireEvent.load(frame);
  const button = await within(frame.contentDocument!.body).findByRole("button", { name: "Edit heading" });
  fireEvent.click(button);
  expect(within(frame.contentDocument!.body).getByRole("button", { name: "Selected" })).toBeVisible();
  expect(frame.contentDocument!.body.querySelector('[data-jelly-theme="fresh-market"]')).toHaveStyle({ color: "rgb(0, 128, 0)" });
});
