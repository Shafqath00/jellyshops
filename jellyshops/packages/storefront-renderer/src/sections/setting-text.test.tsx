import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { RichTextDocument } from "@jelly/storefront-schema";
import { FaqSection } from "./home-sections";
import { formattedSetting, SettingText } from "./setting-text";

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
