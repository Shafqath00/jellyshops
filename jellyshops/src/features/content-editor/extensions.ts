/**
 * The content editor's TipTap setup. Every node and mark here maps one-to-one onto the shared rich text format
 * (`@jelly/storefront-schema` rich-text.ts), so `normalizeRichTextDocument(editor.getJSON())` is the saved document.
 */
import { Extension, Mark, Node, mergeAttributes, type AnyExtension } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Heading from "@tiptap/extension-heading";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";
import Blockquote from "@tiptap/extension-blockquote";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import HardBreak from "@tiptap/extension-hard-break";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { BulletList, ListItem, OrderedList, TaskItem, TaskList } from "@tiptap/extension-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Dropcursor, Gapcursor, Placeholder, TrailingNode, UndoRedo } from "@tiptap/extensions";
import { RICH_TEXT_SIZES, richTextStyleCss, safeRichTextHref, safeRichTextImageSrc } from "@jelly/storefront-schema";

/** Text colour and size, saved as one `textStyle` mark ({ color, size }), like the theme editor's. */
export const TextStyle = Mark.create({
  name: "textStyle",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-color") ?? element.style.color;
          return value ? toHex(value) : null;
        },
        renderHTML: (attrs) => attrs.color ? { "data-color": attrs.color } : {},
      },
      size: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-size");
          return value && (RICH_TEXT_SIZES as readonly string[]).includes(value) ? value : null;
        },
        renderHTML: (attrs) => attrs.size ? { "data-size": attrs.size } : {},
      },
    };
  },
  parseHTML: () => [{ tag: "span[data-color]" }, { tag: "span[data-size]" }, { tag: "span[style*=color]" }],
  renderHTML({ mark, HTMLAttributes }) {
    const css = richTextStyleCss({ color: mark.attrs.color ?? undefined, size: mark.attrs.size ?? undefined });
    const style = [css.color && `color: ${css.color}`, css.fontSize && `font-size: ${css.fontSize}`].filter(Boolean).join("; ");
    return ["span", { ...HTMLAttributes, ...(style ? { style } : {}) }, 0];
  },
});

/** "#abc", "rgb(1, 2, 3)" or "#aabbcc" as "#aabbcc"; null for anything else. */
export function toHex(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  const short = text.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const rgb = text.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  return rgb ? `#${rgb.slice(1, 4).map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0")).join("")}` : null;
}

/** A photo block: src, alt, caption, width (percent), alignment and an optional link. Edited from its floating toolbar. */
export const ContentImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: null },
      width: { default: null },
      align: { default: null },
      href: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure[data-type=image]",
        getAttrs: (element) => {
          const image = element.querySelector("img");
          if (!image || !safeRichTextImageSrc(image.getAttribute("src"))) return false;
          const width = Number((element.style.width || image.getAttribute("data-width") || "").replace("%", ""));
          return {
            src: image.getAttribute("src"),
            alt: image.getAttribute("alt") ?? "",
            caption: element.querySelector("figcaption")?.textContent?.trim() || null,
            width: Number.isFinite(width) && width > 0 ? width : null,
            align: element.getAttribute("data-align"),
            href: element.querySelector("a")?.getAttribute("href") ?? null,
          };
        },
      },
      // Photos with an address the saved format would refuse (relative, data:, javascript:) are left out.
      { tag: "img[src]", getAttrs: (element) => safeRichTextImageSrc(element.getAttribute("src")) ? { src: element.getAttribute("src"), alt: element.getAttribute("alt") ?? "" } : false },
    ];
  },
  renderHTML({ node }) {
    const { src, alt, caption, width, align } = node.attrs as { src: string | null; alt: string; caption: string | null; width: number | null; align: string | null };
    const safe = safeRichTextImageSrc(src) ?? "";
    const figure: Record<string, string> = { "data-type": "image", "data-align": align ?? "center", class: "jce-figure" };
    if (width) figure.style = `width: ${width}%`;
    return ["figure", figure, ["img", { src: safe, alt: alt ?? "", draggable: "false" }], ...(caption ? [["figcaption", {}, caption]] : [])] as never;
  },
});

/** A YouTube or Vimeo video, stored as provider + id. Shown in the editor as a card (no live player while editing). */
export const ContentVideo = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { provider: { default: null }, id: { default: null }, title: { default: null } };
  },
  parseHTML() {
    return [{
      tag: "figure[data-type=video]",
      getAttrs: (element) => ({ provider: element.getAttribute("data-provider"), id: element.getAttribute("data-id"), title: element.querySelector("iframe")?.getAttribute("title") ?? null }),
    }];
  },
  renderHTML({ node }) {
    const { provider, id, title } = node.attrs as { provider: string; id: string; title: string | null };
    const name = provider === "vimeo" ? "Vimeo" : "YouTube";
    return ["figure", { "data-type": "video", "data-provider": provider, "data-id": id, class: "jce-video" },
      ["span", { class: "jce-video-badge" }, `${name} video`],
      ["span", { class: "jce-video-title" }, title || `Video ${id}`]];
  },
});

/** A button link: label, address, style, new tab and alignment. */
export const ContentButton = Node.create({
  name: "button",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { href: { default: null }, label: { default: "" }, style: { default: null }, target: { default: null }, align: { default: null } };
  },
  parseHTML() {
    return [{
      tag: "p[data-type=button]",
      getAttrs: (element) => {
        const link = element.querySelector("a");
        if (!link) return false;
        return { href: link.getAttribute("href"), label: link.textContent?.trim() ?? "", style: element.getAttribute("data-style"), target: link.getAttribute("target") === "_blank" ? "_blank" : null, align: element.style.textAlign || null };
      },
    }];
  },
  renderHTML({ node }) {
    const { href, label, style, align } = node.attrs as { href: string | null; label: string; style: string | null; align: string | null };
    return ["p", mergeAttributes({ "data-type": "button", class: "jce-button-block" }, align ? { style: `text-align: ${align}` } : {}),
      ["span", { class: `jce-button jce-button--${style === "secondary" ? "secondary" : "primary"}`, "data-href": safeRichTextHref(href) ?? "" }, label || "Button"]];
  },
});

/** Ctrl/Cmd+K opens the link dialog (the dialog lives in React; this only tells it to open). */
export const LinkShortcut = Extension.create<{ onOpen: () => void }>({
  name: "linkShortcut",
  addOptions: () => ({ onOpen: () => undefined }),
  addKeyboardShortcuts() {
    return { "Mod-k": () => { this.options.onOpen(); return true; } };
  },
});

const CELL_CONTENT = "(paragraph | heading | bulletList | orderedList | taskList | blockquote | codeBlock | horizontalRule)+";

export interface ContentExtensionOptions {
  placeholder?: string;
  onLinkShortcut?: () => void;
}

export function contentExtensions(options: ContentExtensionOptions = {}): AnyExtension[] {
  return [
    Document, Paragraph, Text, HardBreak,
    Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    Bold, Italic, Underline, Strike, Code,
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: "https",
      isAllowedUri: (url) => safeRichTextHref(url) !== null,
      HTMLAttributes: { rel: "noopener noreferrer", target: null, class: null },
    }),
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
    BulletList, OrderedList, ListItem,
    TaskList, TaskItem.configure({ nested: true }),
    Blockquote, CodeBlock, HorizontalRule,
    Table.configure({ resizable: false }), TableRow,
    // Cells hold text only: photos, videos, buttons and tables inside a table are not part of the saved format.
    TableHeader.extend({ content: CELL_CONTENT }), TableCell.extend({ content: CELL_CONTENT }),
    ContentImage, ContentVideo, ContentButton,
    // Always an empty line at the end, so there is somewhere to click below a table, photo or video.
    TrailingNode,
    UndoRedo, Dropcursor.configure({ color: "var(--jk-accent)", width: 2 }), Gapcursor,
    Placeholder.configure({ placeholder: options.placeholder ?? "Start writing, or type / for headings, photos, tables and more" }),
    LinkShortcut.configure({ onOpen: options.onLinkShortcut ?? (() => undefined) }),
  ];
}
