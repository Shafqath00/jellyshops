import { z } from "zod";
import type { BlockDefinition } from "./types";

const text = z.object({ text: z.string() }).passthrough();
const blocks: BlockDefinition[] = [
  { type: "heading", settingsSchema: text, controls: [{ type: "text", key: "text", label: "Heading", group: "content", maxLength: 120 }], defaultSettings: { text: "Heading" } },
  { type: "text", settingsSchema: text, controls: [{ type: "textarea", key: "text", label: "Text", group: "content", maxLength: 1000 }], defaultSettings: { text: "Add your text here." } },
  { type: "button", settingsSchema: z.object({ label: z.string(), href: z.string().optional() }).passthrough(), controls: [{ type: "text", key: "label", label: "Label", group: "content", maxLength: 40 }, { type: "link", key: "href", label: "Link", group: "advanced" }], defaultSettings: { label: "Shop now", href: "/shop" } },
  { type: "testimonial", settingsSchema: z.object({ quote: z.string(), author: z.string() }).passthrough(), controls: [{ type: "textarea", key: "quote", label: "Quote", group: "content", maxLength: 500 }], defaultSettings: { quote: "A customer story.", author: "Customer" } },
  { type: "faq-item", settingsSchema: z.object({ question: z.string(), answer: z.string() }).passthrough(), controls: [{ type: "text", key: "question", label: "Question", group: "content", maxLength: 160 }], defaultSettings: { question: "Question", answer: "Answer" } },
  { type: "logo", settingsSchema: z.object({ assetId: z.string().optional(), label: z.string().optional() }).passthrough(), controls: [{ type: "text", key: "label", label: "Label", group: "content", maxLength: 80 }], defaultSettings: {} },
  { type: "menu", settingsSchema: z.object({ label: z.string().optional() }).passthrough(), controls: [], defaultSettings: {} },
  { type: "contact-item", settingsSchema: z.object({ label: z.string(), value: z.string() }).passthrough(), controls: [{ type: "text", key: "value", label: "Value", group: "content", maxLength: 160 }], defaultSettings: { label: "Email", value: "hello@example.com" } },
  { type: "social-link", settingsSchema: z.object({ label: z.string(), href: z.string() }).passthrough(), controls: [{ type: "link", key: "href", label: "Link", group: "advanced" }], defaultSettings: { label: "Instagram", href: "https://example.com" } }
];

export const blockDefinitions = new Map(blocks.map((definition) => [definition.type, definition]));
