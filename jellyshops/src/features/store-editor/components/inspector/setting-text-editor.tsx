"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EditorContent, Extension, Mark, useEditor, useEditorState } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Heading from "@tiptap/extension-heading";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import HardBreak from "@tiptap/extension-hard-break";
import Link from "@tiptap/extension-link";
import { history, redo, undo } from "@tiptap/pm/history";
import { AlignCenter, AlignLeft, AlignRight, Bold as BoldIcon, Italic as ItalicIcon, Link2, List, ListOrdered, Redo2, RemoveFormatting, Underline as UnderlineIcon, Undo2 } from "lucide-react";
import { normalizeRichTextDocument, plainTextToRichTextDocument, richTextStyleCss, richTextToPlainText, safeRichTextHref, type RichTextDocument, type RichTextSize } from "@jelly/storefront-schema";

/**
 * The theme editor's text editor, like Shopify's: bold, italic, underline, link,
 * text colour and text size, plus paragraph styles, alignment and lists for
 * longer text. `inline` keeps it to one line of formatted text, for headings.
 * Saves a rich text document (see `@jelly/storefront-schema` rich-text) and its plain text.
 */

/** Undo and redo for the editor; the other TipTap history extension is a separate dependency we do not need. */
const History = Extension.create({
  name: "history",
  addProseMirrorPlugins: () => [history()],
  addKeyboardShortcuts() {
    return {
      "Mod-z": () => undo(this.editor.state, this.editor.view.dispatch),
      "Mod-y": () => redo(this.editor.state, this.editor.view.dispatch),
      "Shift-Mod-z": () => redo(this.editor.state, this.editor.view.dispatch),
    };
  },
});

/** Text colour and size, saved as one `textStyle` mark. */
const TextStyle = Mark.create({
  name: "textStyle",
  addAttributes() {
    return {
      color: { default: null, parseHTML: (element) => element.getAttribute("data-color"), renderHTML: (attrs) => attrs.color ? { "data-color": attrs.color } : {} },
      size: { default: null, parseHTML: (element) => element.getAttribute("data-size"), renderHTML: (attrs) => attrs.size ? { "data-size": attrs.size } : {} },
    };
  },
  parseHTML: () => [{ tag: "span[data-text-style]" }],
  renderHTML({ mark, HTMLAttributes }) {
    const css = richTextStyleCss({ color: mark.attrs.color ?? undefined, size: mark.attrs.size ?? undefined });
    const style = [css.color && `color: ${css.color}`, css.fontSize && `font-size: ${css.fontSize}`].filter(Boolean).join("; ");
    return ["span", { ...HTMLAttributes, "data-text-style": "", ...(style ? { style } : {}) }, 0];
  },
});

const linkExtension = Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: (url) => safeRichTextHref(url) !== null, HTMLAttributes: { target: null, rel: null } });
const fullExtensions = [
  Document, Paragraph, Text, Heading.configure({ levels: [2, 3] }), Bold, Italic, Underline,
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
  BulletList, OrderedList, ListItem, HardBreak, linkExtension, TextStyle, History,
];
/** One paragraph only: a heading is a single line of formatted text. */
const inlineExtensions = [Document.extend({ content: "paragraph" }), Paragraph, Text, Bold, Italic, Underline, linkExtension, TextStyle, History];

const EMPTY_EDITOR_CONTENT = { type: "doc", content: [{ type: "paragraph" }] };
const SIZES: Array<{ label: string; value: RichTextSize | "" }> = [{ label: "Default size", value: "" }, { label: "Small", value: "small" }, { label: "Large", value: "large" }, { label: "Extra large", value: "x-large" }];

const surface = "[&_.ProseMirror]:rounded-b-lg [&_.ProseMirror]:border [&_.ProseMirror]:border-border [&_.ProseMirror]:bg-card [&_.ProseMirror]:p-3 [&_.ProseMirror]:text-sm [&_.ProseMirror]:leading-6 [&_.ProseMirror]:outline-none [&_.ProseMirror:focus-visible]:ring-2 [&_.ProseMirror:focus-visible]:ring-ring [&_.ProseMirror_p]:my-1 [&_.ProseMirror_h2]:my-2 [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:my-2 [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_a]:underline";
const button = "inline-flex size-8 items-center justify-center rounded-md border border-transparent text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 aria-pressed:border-border aria-pressed:bg-muted";
const textButton = "inline-flex h-8 items-center rounded-md border border-border bg-card px-2.5 text-[12px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const select = "h-8 rounded-md border border-border bg-card px-2 text-[12px]";

function ToolbarButton({ label, pressed, disabled, onClick, children }: { label: string; pressed?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} className={button} onClick={onClick}>{children}</button>;
}

/** Empty documents are stored as nothing, so "cleared" and "never written" look the same. */
function documentOrNull(value: unknown): RichTextDocument | null {
  const document = normalizeRichTextDocument(value);
  return document && richTextToPlainText(document) === "" ? null : document;
}

function initialContent(value: RichTextDocument | null, fallbackText: string) {
  return value ?? (fallbackText.trim() ? plainTextToRichTextDocument(fallbackText) : null);
}

export function SettingTextEditor({ id, label, value, fallbackText, inline = false, onChange }: {
  id: string;
  label: string;
  /** The saved formatted copy, or null when the setting only has plain text. */
  value: RichTextDocument | null;
  /** Plain text shown until the merchant formats it. */
  fallbackText: string;
  inline?: boolean;
  onChange(document: RichTextDocument | null, plainText: string): void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: inline ? inlineExtensions : fullExtensions,
    content: initialContent(value, fallbackText) ?? EMPTY_EDITOR_CONTENT,
    immediatelyRender: false,
    editorProps: { attributes: { id, role: "textbox", "aria-label": label, "aria-multiline": inline ? "false" : "true", class: inline ? "" : "min-h-28" } },
    onUpdate: ({ editor: current }) => {
      const document = documentOrNull(current.getJSON());
      onChange(document, document ? richTextToPlainText(document) : "");
    },
  });

  // Follow the setting when it changes from outside (undo, inline editing in the preview).
  useEffect(() => {
    if (!editor) return;
    const expected = initialContent(value, fallbackText);
    if (JSON.stringify(documentOrNull(editor.getJSON())) !== JSON.stringify(documentOrNull(expected))) {
      editor.commands.setContent(expected ?? EMPTY_EDITOR_CONTENT, { emitUpdate: false });
    }
  }, [editor, value, fallbackText]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      underline: current?.isActive("underline") ?? false,
      bullet: current?.isActive("bulletList") ?? false,
      ordered: current?.isActive("orderedList") ?? false,
      link: current?.isActive("link") ?? false,
      linkHref: (current?.getAttributes("link").href as string | undefined) ?? "",
      color: (current?.getAttributes("textStyle").color as string | null | undefined) ?? "",
      size: (current?.getAttributes("textStyle").size as string | null | undefined) ?? "",
      style: current?.isActive("heading", { level: 2 }) ? "h2" : current?.isActive("heading", { level: 3 }) ? "h3" : "p",
      align: (["center", "right"] as const).find((alignment) => current?.isActive({ textAlign: alignment })) ?? "left",
      canUndo: current ? undo(current.state) : false,
      canRedo: current ? redo(current.state) : false,
    }),
  });

  const run = () => editor?.chain().focus();
  /** Sets or clears the colour or size, keeping the other one. */
  const setStyle = (change: { color?: string | null; size?: string | null }) => {
    const current = editor?.getAttributes("textStyle") ?? {};
    const next = { color: current.color ?? null, size: current.size ?? null, ...change };
    if (!next.color && !next.size) run()?.unsetMark("textStyle").run();
    else run()?.setMark("textStyle", next).run();
  };
  const applyLink = () => {
    const href = safeRichTextHref(linkUrl);
    if (!href) { setLinkError("Use an http or https address, a store path like /pages/care, or an anchor."); return; }
    run()?.extendMarkRange("link").setLink({ href }).run();
    setLinkError("");
    setLinkOpen(false);
  };

  return (
    <div className="rounded-lg">
      <div role="toolbar" aria-label={`${label} formatting`} className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-border bg-muted/40 p-1.5">
        <ToolbarButton label="Undo" disabled={!state?.canUndo} onClick={() => run()?.command(({ state: current, dispatch }) => undo(current, dispatch)).run()}><Undo2 size={15} /></ToolbarButton>
        <ToolbarButton label="Redo" disabled={!state?.canRedo} onClick={() => run()?.command(({ state: current, dispatch }) => redo(current, dispatch)).run()}><Redo2 size={15} /></ToolbarButton>
        {!inline && (
          <select aria-label="Paragraph style" value={state?.style ?? "p"} className={select} onChange={(event) => {
            const style = event.target.value;
            if (style === "p") run()?.setParagraph().run(); else run()?.setHeading({ level: style === "h2" ? 2 : 3 }).run();
          }}>
            <option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
          </select>
        )}
        <ToolbarButton label="Bold" pressed={state?.bold} onClick={() => run()?.toggleBold().run()}><BoldIcon size={15} /></ToolbarButton>
        <ToolbarButton label="Italic" pressed={state?.italic} onClick={() => run()?.toggleItalic().run()}><ItalicIcon size={15} /></ToolbarButton>
        <ToolbarButton label="Underline" pressed={state?.underline} onClick={() => run()?.toggleUnderline().run()}><UnderlineIcon size={15} /></ToolbarButton>
        <ToolbarButton label="Link" pressed={state?.link || linkOpen} onClick={() => { setLinkUrl(state?.linkHref ?? ""); setLinkError(""); setLinkOpen((open) => !open); }}><Link2 size={15} /></ToolbarButton>
        <span className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-1.5">
          <input type="color" aria-label="Text colour" title="Text colour" value={state?.color || "#000000"} onChange={(event) => setStyle({ color: event.target.value })} className="size-5 cursor-pointer border-0 bg-transparent p-0" />
          {state?.color && <button type="button" aria-label="Remove text colour" title="Remove text colour" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setStyle({ color: null })}>×</button>}
        </span>
        <select aria-label="Text size" value={state?.size ?? ""} className={select} onChange={(event) => setStyle({ size: event.target.value || null })}>
          {SIZES.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}
        </select>
        {!inline && <>
          <ToolbarButton label="Align left" pressed={state?.align === "left"} onClick={() => run()?.setTextAlign("left").run()}><AlignLeft size={15} /></ToolbarButton>
          <ToolbarButton label="Align center" pressed={state?.align === "center"} onClick={() => run()?.setTextAlign("center").run()}><AlignCenter size={15} /></ToolbarButton>
          <ToolbarButton label="Align right" pressed={state?.align === "right"} onClick={() => run()?.setTextAlign("right").run()}><AlignRight size={15} /></ToolbarButton>
          <ToolbarButton label="Bullet list" pressed={state?.bullet} onClick={() => run()?.toggleBulletList().run()}><List size={15} /></ToolbarButton>
          <ToolbarButton label="Numbered list" pressed={state?.ordered} onClick={() => run()?.toggleOrderedList().run()}><ListOrdered size={15} /></ToolbarButton>
        </>}
        <ToolbarButton label="Clear formatting" onClick={() => { const chain = run()?.unsetAllMarks(); (inline ? chain : chain?.clearNodes())?.run(); }}><RemoveFormatting size={15} /></ToolbarButton>
      </div>
      {linkOpen && (
        <div className="flex flex-wrap items-start gap-2 border-x border-border bg-muted/20 p-2">
          <div className="min-w-0 flex-1">
            <input aria-label="Link address" aria-invalid={Boolean(linkError)} value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } }} placeholder="https://… or /pages/care" className="h-8 w-full rounded-md border border-border bg-card px-2 text-[13px]" />
            {linkError && <p role="alert" className="mt-1 text-[12px] font-semibold text-destructive">{linkError}</p>}
          </div>
          <button type="button" className={textButton} onClick={applyLink}>Apply link</button>
          <button type="button" className={textButton} onClick={() => { run()?.extendMarkRange("link").unsetLink().run(); setLinkOpen(false); }}>Remove link</button>
        </div>
      )}
      <div className={surface}><EditorContent editor={editor} /></div>
    </div>
  );
}
