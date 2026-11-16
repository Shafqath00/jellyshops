import { z } from "zod";
import { STORE_ICON_LABELS, STORE_ICON_NAMES, settingValueSchema, type DynamicValueType } from "@jelly/storefront-schema";
import type { BlockDefinition, ControlDefinition } from "./types.js";

/**
 * The shared content block library, wave 1 (theme plan T2, docs/template-analysis.md section 6.4): text,
 * layout and card blocks that every section taking "@content" accepts (Custom content, groups, grids, and from
 * T5 the product details column). Child-only blocks (accordion row, tab, icon list item) are not in the set:
 * they only go inside their parent.
 */

const CONTENT: BlockDefinition["sets"] = ["@content"];
const stringTypes = ["string", "text"] satisfies DynamicValueType[];
const urlTypes = ["url"] satisfies DynamicValueType[];
const dynamicString = z.union([z.string(), settingValueSchema(z.string())]);
const linkSchema = z.union([z.string(), settingValueSchema(z.string())]).optional();
const imageReference = z.object({ url: z.string(), alt: z.string().optional() }).passthrough();
const choice = <T extends readonly [string, ...string[]]>(values: T) => z.union([z.enum(values), z.literal("")]).optional();
const icon = z.enum(STORE_ICON_NAMES).optional();
const iconOptions = STORE_ICON_NAMES.map((value) => ({ label: STORE_ICON_LABELS[value], value }));
const options = (...pairs: Array<[string, string]>) => pairs.map(([value, label]) => ({ label, value }));

const text = (key: string, label: string, maxLength: number, extra: Partial<ControlDefinition> = {}): ControlDefinition =>
  ({ type: "text", key, label, group: "content", maxLength, dynamicTypes: stringTypes, ...extra }) as ControlDefinition;
const richText = (key: string, label: string, maxLength: number): ControlDefinition =>
  ({ type: "rich-text", key, label, group: "content", maxLength, dynamicTypes: stringTypes });
const link = (key: string, label: string): ControlDefinition => ({ type: "link", key, label, group: "content", dynamicTypes: urlTypes });
const iconControl = (key = "icon"): ControlDefinition => ({ type: "select", key, label: "Icon", group: "content", options: iconOptions });

/** Text blocks: a short line above a heading, a heading with text, and text that opens and closes. */
const subheading: BlockDefinition = {
  type: "subheading", sets: CONTENT,
  settingsSchema: z.object({ text: dynamicString }).passthrough(),
  controls: [text("text", "Text", 80)],
  defaultSettings: { text: "Our story" },
};

const sectionHeader: BlockDefinition = {
  type: "section-header", sets: CONTENT,
  settingsSchema: z.object({ eyebrow: z.string().max(80).optional(), heading: dynamicString, text: z.string().max(600).optional(), layout: choice(["vertical", "horizontal"] as const), linkLabel: z.string().max(40).optional(), link: linkSchema }).passthrough(),
  controls: [
    text("eyebrow", "Small text above heading", 80, { dynamicTypes: undefined }),
    { type: "rich-text", inline: true, key: "heading", label: "Heading", group: "content", maxLength: 120, dynamicTypes: stringTypes },
    richText("text", "Text", 600),
    text("linkLabel", "Link text", 40, { dynamicTypes: undefined }),
    link("link", "Link"),
    { type: "segmented", key: "layout", mobile: true, label: "Layout", description: "Side by side puts the heading on the left and the text and link on the right.", group: "layout", options: options(["vertical", "Stacked"], ["horizontal", "Side by side"]) },
  ],
  defaultSettings: { eyebrow: "New in", heading: "Made to last", text: "A short line about what this part of the page shows.", layout: "vertical" },
};

const collapsibleText: BlockDefinition = {
  type: "collapsible-text", sets: CONTENT,
  settingsSchema: z.object({ title: dynamicString, text: z.string().max(2000).optional(), startOpen: z.boolean().optional() }).passthrough(),
  controls: [text("title", "Title", 120), richText("text", "Text", 2000), { type: "checkbox", key: "startOpen", label: "Open to start with", group: "content" }],
  defaultSettings: { title: "Delivery and returns", text: "Free delivery on orders over £50. Return anything within 30 days." },
};

/** Layout blocks: a grid of blocks, an accordion, tabs, a dividing line and empty space. */
const grid: BlockDefinition = {
  type: "grid", sets: CONTENT,
  settingsSchema: z.object({ columns: z.number().int().min(1).max(6).optional(), gap: z.number().int().min(0).max(80).optional(), alignItems: choice(["start", "center", "stretch"] as const) }).passthrough(),
  controls: [
    { type: "range", key: "columns", mobile: true, label: "Columns", group: "layout", heading: "Layout", min: 1, max: 6, step: 1 },
    { type: "range", key: "gap", mobile: true, label: "Gap", group: "layout", heading: "Layout", min: 0, max: 80, step: 1, unit: "px" },
    { type: "segmented", key: "alignItems", label: "Line up", group: "layout", heading: "Layout", options: options(["start", "Top"], ["center", "Middle"], ["stretch", "Same height"]) },
  ],
  defaultSettings: { columns: 3, gap: 24, alignItems: "stretch" },
  allowedBlockTypes: ["@content", "@app"],
  maxBlocks: 12,
  defaultBlocks: [
    { id: "grid-box-1", type: "icon-box", enabled: true, settings: { icon: "truck", heading: "Free delivery", text: "On every order over £50." } },
    { id: "grid-box-2", type: "icon-box", enabled: true, settings: { icon: "return", heading: "Easy returns", text: "Send it back within 30 days." } },
    { id: "grid-box-3", type: "icon-box", enabled: true, settings: { icon: "shield", heading: "Two-year guarantee", text: "We stand behind what we make." } },
  ],
};

const accordion: BlockDefinition = {
  type: "accordion", sets: CONTENT,
  settingsSchema: z.object({ openFirst: z.boolean().optional(), oneAtATime: z.boolean().optional() }).passthrough(),
  controls: [
    { type: "checkbox", key: "openFirst", label: "Open the first row", group: "content" },
    { type: "checkbox", key: "oneAtATime", label: "Close the others when one opens", group: "content" },
  ],
  defaultSettings: { openFirst: true },
  allowedBlockTypes: ["accordion-row"],
  maxBlocks: 20,
  defaultBlocks: [
    { id: "accordion-row-1", type: "accordion-row", enabled: true, settings: { title: "How long does delivery take?", text: "Most orders arrive in 3 to 5 working days." } },
    { id: "accordion-row-2", type: "accordion-row", enabled: true, settings: { title: "Can I return my order?", text: "Yes, within 30 days, as long as it is unused." } },
    { id: "accordion-row-3", type: "accordion-row", enabled: true, settings: { title: "Do you deliver abroad?", text: "We deliver across the UK and Europe." } },
  ],
};

const accordionRow: BlockDefinition = {
  type: "accordion-row",
  settingsSchema: z.object({ title: dynamicString, text: z.string().max(2000).optional() }).passthrough(),
  controls: [text("title", "Title", 120), richText("text", "Text", 2000)],
  defaultSettings: { title: "Question", text: "Answer" },
};

const tabs: BlockDefinition = {
  type: "tabs", sets: CONTENT,
  settingsSchema: z.object({ tabAlign: choice(["start", "center"] as const) }).passthrough(),
  controls: [{ type: "segmented", key: "tabAlign", label: "Tab position", group: "layout", options: options(["start", "Left"], ["center", "Centre"]) }],
  defaultSettings: {},
  allowedBlockTypes: ["tab"],
  maxBlocks: 8,
  defaultBlocks: [
    { id: "tab-1", type: "tab", enabled: true, settings: { title: "Details", text: "What it is made of and how it is made." } },
    { id: "tab-2", type: "tab", enabled: true, settings: { title: "Care", text: "How to look after it." } },
  ],
};

const tab: BlockDefinition = {
  type: "tab",
  settingsSchema: z.object({ title: dynamicString, text: z.string().max(2000).optional() }).passthrough(),
  controls: [text("title", "Tab name", 40), richText("text", "Text", 2000)],
  defaultSettings: { title: "Tab", text: "Add the text for this tab." },
};

const divider: BlockDefinition = {
  type: "divider", sets: CONTENT,
  settingsSchema: z.object({ lineStyle: choice(["solid", "dashed", "dotted"] as const), thickness: z.number().int().min(1).max(8).optional(), length: choice(["full", "short"] as const) }).passthrough(),
  controls: [
    { type: "segmented", key: "lineStyle", label: "Line", group: "style", options: options(["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]) },
    { type: "range", key: "thickness", label: "Thickness", group: "style", min: 1, max: 8, step: 1, unit: "px" },
    { type: "segmented", key: "length", label: "Length", group: "layout", options: options(["full", "Full width"], ["short", "Short"]) },
  ],
  defaultSettings: { lineStyle: "solid", thickness: 1, length: "full" },
};

const spacer: BlockDefinition = {
  type: "spacer", sets: CONTENT,
  settingsSchema: z.object({ height: z.number().int().min(0).max(200).optional() }).passthrough(),
  controls: [{ type: "range", key: "height", mobile: true, label: "Height", group: "layout", min: 0, max: 200, step: 4, unit: "px" }],
  defaultSettings: { height: 32 },
};

/** Icon blocks: one icon, a list of icons with text, and an icon box (icon, heading, text, link). */
const iconBlock: BlockDefinition = {
  type: "icon", sets: CONTENT,
  settingsSchema: z.object({ icon, size: z.number().int().min(16).max(96).optional(), label: z.string().max(80).optional() }).passthrough(),
  controls: [iconControl(), { type: "range", key: "size", label: "Size", group: "style", min: 16, max: 96, step: 4, unit: "px" }, text("label", "Name for screen readers", 80, { description: "Leave empty when the text next to it says the same.", dynamicTypes: undefined })],
  defaultSettings: { icon: "star", size: 32 },
};

const iconList: BlockDefinition = {
  type: "icon-list", sets: CONTENT,
  settingsSchema: z.object({ listLayout: choice(["vertical", "horizontal"] as const), iconSize: z.number().int().min(12).max(48).optional() }).passthrough(),
  controls: [
    { type: "segmented", key: "listLayout", mobile: true, label: "Layout", group: "layout", options: options(["vertical", "List"], ["horizontal", "In a row"]) },
    { type: "range", key: "iconSize", label: "Icon size", group: "style", min: 12, max: 48, step: 2, unit: "px" },
  ],
  defaultSettings: { listLayout: "vertical", iconSize: 20 },
  allowedBlockTypes: ["icon-list-item"],
  maxBlocks: 12,
  defaultBlocks: [
    { id: "icon-item-1", type: "icon-list-item", enabled: true, settings: { icon: "truck", text: "Free delivery over £50" } },
    { id: "icon-item-2", type: "icon-list-item", enabled: true, settings: { icon: "return", text: "30-day returns" } },
    { id: "icon-item-3", type: "icon-list-item", enabled: true, settings: { icon: "shield", text: "Two-year guarantee" } },
  ],
};

const iconListItem: BlockDefinition = {
  type: "icon-list-item",
  settingsSchema: z.object({ icon, text: dynamicString, link: linkSchema }).passthrough(),
  controls: [iconControl(), text("text", "Text", 120), link("link", "Link")],
  defaultSettings: { icon: "check", text: "A good reason to buy" },
};

const iconBox: BlockDefinition = {
  type: "icon-box", sets: CONTENT,
  settingsSchema: z.object({ icon, heading: dynamicString, text: z.string().max(600).optional(), linkLabel: z.string().max(40).optional(), link: linkSchema, boxLayout: choice(["stacked", "inline"] as const), boxStyle: choice(["standard", "card"] as const) }).passthrough(),
  controls: [
    iconControl(),
    text("heading", "Heading", 80),
    richText("text", "Text", 600),
    text("linkLabel", "Link text", 40, { dynamicTypes: undefined }),
    link("link", "Link"),
    { type: "segmented", key: "boxLayout", label: "Icon position", group: "layout", options: options(["stacked", "Above"], ["inline", "Beside"]) },
    { type: "segmented", key: "boxStyle", label: "Style", group: "style", options: options(["standard", "Plain"], ["card", "Card"]) },
  ],
  defaultSettings: { icon: "star", heading: "Why it matters", text: "One or two lines that explain it.", boxLayout: "stacked", boxStyle: "standard" },
};

/** Cards and small extras: a photo card, a badge or sticker, a big number, and a row of buttons. */
const card: BlockDefinition = {
  type: "card", sets: CONTENT,
  settingsSchema: z.object({ image: imageReference.optional(), heading: dynamicString, text: z.string().max(600).optional(), linkLabel: z.string().max(40).optional(), link: linkSchema, imageRatio: choice(["square", "portrait", "landscape", "wide"] as const), imagePosition: choice(["top", "left"] as const) }).passthrough(),
  controls: [
    { type: "image", key: "image", label: "Image", group: "content" },
    text("heading", "Heading", 120),
    richText("text", "Text", 600),
    text("linkLabel", "Link text", 40, { dynamicTypes: undefined }),
    link("link", "Link"),
    { type: "select", key: "imageRatio", label: "Image shape", group: "layout", options: options(["landscape", "Landscape (4:3)"], ["square", "Square"], ["portrait", "Portrait (4:5)"], ["wide", "Wide (16:9)"]) },
    { type: "segmented", key: "imagePosition", mobile: true, label: "Image position", group: "layout", options: options(["top", "Above"], ["left", "Beside"]) },
  ],
  defaultSettings: { heading: "Card heading", text: "A sentence or two about this.", linkLabel: "Find out more", imageRatio: "landscape", imagePosition: "top" },
};

const badge: BlockDefinition = {
  type: "badge", sets: CONTENT,
  settingsSchema: z.object({ text: dynamicString, shape: choice(["pill", "circle", "tag"] as const), spin: z.boolean().optional() }).passthrough(),
  controls: [
    text("text", "Text", 40),
    { type: "segmented", key: "shape", label: "Shape", group: "style", options: options(["pill", "Pill"], ["circle", "Circle"], ["tag", "Tag"]) },
    { type: "checkbox", key: "spin", label: "Turn slowly", description: "Stays still for visitors who ask for less motion.", group: "style" },
  ],
  defaultSettings: { text: "New", shape: "pill" },
};

const counter: BlockDefinition = {
  type: "counter", sets: CONTENT,
  settingsSchema: z.object({ value: z.number().min(0).max(999_999_999).optional(), prefix: z.string().max(8).optional(), suffix: z.string().max(12).optional(), label: dynamicString.optional() }).passthrough(),
  controls: [
    { type: "number", key: "value", label: "Number", description: "Up to two decimals, for example 4.9.", group: "content", min: 0, max: 999_999_999, step: 0.1 },
    text("prefix", "Before the number", 8, { description: "For example £.", dynamicTypes: undefined }),
    text("suffix", "After the number", 12, { description: "For example + or %.", dynamicTypes: undefined }),
    text("label", "Label", 80),
  ],
  defaultSettings: { value: 12000, suffix: "+", label: "Happy customers" },
};

const buttonGroup: BlockDefinition = {
  type: "button-group", sets: CONTENT,
  settingsSchema: z.object({ buttonAlign: choice(["start", "center", "end"] as const), stackOnPhones: z.boolean().optional() }).passthrough(),
  controls: [
    { type: "segmented", key: "buttonAlign", label: "Alignment", group: "layout", options: options(["", "Follow section"], ["start", "Left"], ["center", "Centre"], ["end", "Right"]) },
    { type: "checkbox", key: "stackOnPhones", label: "Stack on phones", group: "layout" },
  ],
  defaultSettings: { stackOnPhones: true },
  allowedBlockTypes: ["button"],
  maxBlocks: 4,
  defaultBlocks: [
    { id: "button-group-1", type: "button", enabled: true, settings: { label: "Shop now", href: "/shop" } },
    { id: "button-group-2", type: "button", enabled: true, settings: { label: "Our story", href: "/pages/about" } },
  ],
};

export const CONTENT_BLOCKS: BlockDefinition[] = [
  subheading, sectionHeader, collapsibleText,
  grid, accordion, accordionRow, tabs, tab, divider, spacer,
  iconBlock, iconList, iconListItem, iconBox,
  card, badge, counter, buttonGroup,
];

/** Wave-1 block types, for tests and docs. */
export const CONTENT_BLOCK_TYPES = CONTENT_BLOCKS.map((definition) => definition.type);
