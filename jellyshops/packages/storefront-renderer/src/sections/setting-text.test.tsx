import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { RichTextDocument } from "@jelly/storefront-schema";
import { FaqSection } from "./home-sections";
import { formattedSetting, inlineSetting, SettingText } from "./setting-text";
import { RegistrySectionRenderer } from "../registry-section-renderer";
import type { SectionNode } from "@jelly/storefront-schema";

const doc: RichTextDocument = { type: "doc", content: [
  { type: "paragraph", content: [{ type: "text", text: "Made in " }, { type: "text", text: "small", marks: [{ type: "bold" }] }, { type: "text", text: " batches." }] },
  { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Organic cotton" }] }] }] },
] };
// What the editor saves as the plain copy of `doc`.
const plain = "Made in small batches.\n\n- Organic cotton";

it("uses the formatted copy only while it matches the plain text", () => {
  expect(formattedSetting({ text: plain, textDoc: doc }, "text")).toEqual(doc);
  // Changed elsewhere (inline editing, a custom field): the plain text wins.
  expect(formattedSetting({ text: "Made in big batches.", textDoc: doc }, "text")).toBeNull();
  expect(formattedSetting({ text: "", textDoc: doc }, "text")).toBeNull();
  expect(formattedSetting({ text: plain, textDoc: { type: "doc", content: "nope" } }, "text")).toBeNull();
  expect(formattedSetting({ text: plain }, "text")).toBeNull();
});

it("shows formatting when there is a copy and a plain paragraph otherwise", () => {
  const { container, rerender } = render(<SettingText text={plain} document={doc} />);
  expect(container.querySelector("strong")).toHaveTextContent("small");
  expect(screen.getByRole("listitem")).toHaveTextContent("Organic cotton");
  rerender(<SettingText text="Just words" document={null} />);
  expect(container.querySelector("p")).toHaveTextContent("Just words");
  expect(container.querySelector(".jelly-setting-text")).toBeNull();
});

it("formats FAQ answers on the store", () => {
  const answer = "Yes, within 30 days.";
  const answerDoc: RichTextDocument = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Yes, within " }, { type: "text", text: "30 days", marks: [{ type: "italic" }] }, { type: "text", text: "." }] }] };
  const { container } = render(<FaqSection section={{ id: "faq", type: "faq", enabled: true, settings: { heading: "Questions" }, blocks: [{ id: "q1", type: "faq-item", enabled: true, settings: { question: "Can I return it?", answer, answerDoc } }] }} />);
  expect(container.querySelector("details em")).toHaveTextContent("30 days");
});

const headingDoc: RichTextDocument = { type: "doc", content: [{ type: "paragraph", content: [
  { type: "text", text: "Summer " },
  { type: "text", text: "sale", marks: [{ type: "italic" }, { type: "textStyle", attrs: { color: "#c00000", size: "large" } }] },
  { type: "text", text: " now on", marks: [{ type: "link", attrs: { href: "/collections/sale" } }] },
] }] };

it("shows a formatted heading inside the heading element, and plain text when the copy is out of date", () => {
  render(<h2 data-testid="h">{inlineSetting({ text: "Summer sale now on", textDoc: headingDoc }, "text", "Summer sale now on")}</h2>);
  const heading = screen.getByTestId("h");
  expect(heading.querySelector("p, div")).toBeNull();
  // Marks wrap in order: italic inside the colour and size.
  expect(heading.querySelector("span[style]")).toHaveStyle({ color: "#c00000", fontSize: "1.25em" });
  expect(heading.querySelector("span[style] em")).toHaveTextContent("sale");
  expect(screen.getByRole("link", { name: "now on" })).toHaveAttribute("href", "/collections/sale");
  expect(inlineSetting({ text: "Changed in the preview", textDoc: headingDoc }, "text", "Changed in the preview")).toBe("Changed in the preview");
});

it("uses formatted heading blocks in content sections on the live store", () => {
  const blocks = [{ id: "h", type: "heading", enabled: true, settings: { text: "Summer sale now on", textDoc: headingDoc } }];
  const sections: SectionNode[] = [
    { id: "c", type: "custom-content", enabled: true, settings: {}, blocks },
    { id: "i", type: "image-with-text", enabled: true, settings: {}, blocks },
  ];
  for (const section of sections) {
    const { unmount } = render(<RegistrySectionRenderer section={section} mode="published" commerce={{ getProducts: async () => [] }} storeSlug="demo" />);
    const heading = document.querySelector("h2")!;
    expect(heading).toHaveTextContent("Summer sale now on");
    expect(heading.querySelector("em")).toHaveTextContent("sale");
    unmount();
  }
});
