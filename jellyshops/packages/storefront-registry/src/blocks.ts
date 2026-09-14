import { z } from "zod";
import { settingValueSchema, type DynamicValueType } from "@jelly/storefront-schema";
import type { BlockDefinition } from "./types";

const dynamicString = z.union([z.string(), settingValueSchema(z.string())]);
const text = z.object({ text: dynamicString }).passthrough();
const stringTypes = ["string", "text"] satisfies DynamicValueType[];
const urlTypes = ["url"] satisfies DynamicValueType[];

const blocks: BlockDefinition[] = [
  { type: "heading", settingsSchema: text, controls: [{ type: "text", key: "text", label: "Heading", group: "content", maxLength: 120, dynamicTypes: stringTypes }], defaultSettings: { text: "Heading" } },
  { type: "text", settingsSchema: text, controls: [{ type: "textarea", key: "text", label: "Text", group: "content", maxLength: 1000, dynamicTypes: stringTypes }], defaultSettings: { text: "Add your text here." } },
  { type: "button", settingsSchema: z.object({ label: dynamicString, href: z.union([z.string(), settingValueSchema(z.string())]).optional() }).passthrough(), controls: [{ type: "text", key: "label", label: "Label", group: "content", maxLength: 40, dynamicTypes: stringTypes }, { type: "link", key: "href", label: "Link", group: "advanced", dynamicTypes: urlTypes }], defaultSettings: { label: "Shop now", href: "/shop" } },
  { type: "testimonial", settingsSchema: z.object({ quote: dynamicString, author: z.string() }).passthrough(), controls: [{ type: "textarea", key: "quote", label: "Quote", group: "content", maxLength: 500, dynamicTypes: stringTypes }], defaultSettings: { quote: "A customer story.", author: "Customer" } },
  { type: "faq-item", settingsSchema: z.object({ question: dynamicString, answer: z.string() }).passthrough(), controls: [{ type: "text", key: "question", label: "Question", group: "content", maxLength: 160, dynamicTypes: stringTypes }], defaultSettings: { question: "Question", answer: "Answer" } },
  { type: "logo", settingsSchema: z.object({ assetId: z.string().optional(), label: dynamicString.optional() }).passthrough(), controls: [{ type: "text", key: "label", label: "Label", group: "content", maxLength: 80, dynamicTypes: stringTypes }], defaultSettings: {} },
  { type: "menu", settingsSchema: z.object({ label: z.string().optional() }).passthrough(), controls: [], defaultSettings: {} },
  { type: "contact-item", settingsSchema: z.object({ label: z.string(), value: dynamicString }).passthrough(), controls: [{ type: "text", key: "value", label: "Value", group: "content", maxLength: 160, dynamicTypes: stringTypes }], defaultSettings: { label: "Email", value: "hello@example.com" } },
  { type: "social-link", settingsSchema: z.object({ label: z.string(), href: z.union([z.string(), settingValueSchema(z.string())]) }).passthrough(), controls: [{ type: "link", key: "href", label: "Link", group: "advanced", dynamicTypes: urlTypes }], defaultSettings: { label: "Instagram", href: "https://example.com" } }
];

export const blockDefinitions = new Map(blocks.map((definition) => [definition.type, definition]));
