"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EditorContent, Extension, useEditor, useEditorState } from "@tiptap/react";
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
import Blockquote from "@tiptap/extension-blockquote";
import HardBreak from "@tiptap/extension-hard-break";
import Link from "@tiptap/extension-link";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { history, redo, undo } from "@tiptap/pm/history";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold as BoldIcon, Italic as ItalicIcon, Link2, List, ListOrdered, Quote, Redo2, RemoveFormatting, Table as TableIcon, Underline as UnderlineIcon, Undo2 } from "lucide-react";
import { normalizeRichTextDocument, plainTextToRichTextDocument, richTextToPlainText, safeRichTextHref, type RichTextDocument } from "@jelly/storefront-schema";

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

const extensions = [
  Document, Paragraph, Text, Heading.configure({ levels: [2, 3] }), Bold, Italic, Underline,
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
  BulletList, OrderedList, ListItem, Blockquote, HardBreak,
  Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
  Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: (url) => safeRichTextHref(url) !== null, HTMLAttributes: { target: null, rel: null } }),
  History,
];

const EMPTY_EDITOR_CONTENT = { type: "doc", content: [{ type: "paragraph" }] };

type Props = {
  id: string;
  /** The saved rich text, or null for a product that only has a plain-text description. */
  value: RichTextDocument | null;
  /** Plain-text description shown (as paragraphs) until the seller edits it. */
  fallbackText: string;
  onChange: (document: RichTextDocument | null, plainText: string) => void;
  /** What screen readers call the text box; "Description" unless a store editor setting names it. */
  label?: string;
};

const surface = "[&_.ProseMirror]:min-h-40 [&_.ProseMirror]:rounded-b-lg [&_.ProseMirror]:border [&_.ProseMirror]:border-border [&_.ProseMirror]:bg-card [&_.ProseMirror]:p-3 [&_.ProseMirror]:text-sm [&_.ProseMirror]:leading-6 [&_.ProseMirror]:outline-none [&_.ProseMirror:focus-visible]:ring-2 [&_.ProseMirror:focus-visible]:ring-ring [&_.ProseMirror_p]:my-2 [&_.ProseMirror_h2]:my-3 [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:my-3 [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_a]:underline [&_.ProseMirror_table]:my-3 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:bg-muted/50 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:text-left";
const button = "inline-flex size-8 items-center justify-center rounded-md border border-transparent text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 aria-pressed:border-border aria-pressed:bg-muted";
const textButton = "inline-flex h-8 items-center rounded-md border border-border bg-card px-2.5 text-[12px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

function ToolbarButton({ label, pressed, disabled, onClick, children }: { label: string; pressed?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} className={button} onClick={onClick}>{children}</button>;
}

/** Empty documents are stored as nothing, so "cleared" and "never written" look the same. */
function documentOrNull(value: unknown): RichTextDocument | null {
  const document = normalizeRichTextDocument(value);
  return document && richTextToPlainText(document) === "" && !document.content.some((block) => block.type === "table") ? null : document;
}

export function DescriptionEditor({ id, value, fallbackText, onChange, label = "Description" }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions,
    content: (value ?? (fallbackText.trim() ? plainTextToRichTextDocument(fallbackText) : null)) ?? EMPTY_EDITOR_CONTENT,
    immediatelyRender: false,
    editorProps: { attributes: { id, role: "textbox", "aria-label": label, "aria-multiline": "true" } },
    onUpdate: ({ editor: current }) => {
      const document = documentOrNull(current.getJSON());
      onChange(document, document ? richTextToPlainText(document) : "");
    },
  });

  // Follow the draft when it is replaced from outside (Discard, Add another).
  useEffect(() => {
    if (!editor) return;
    const expected = value ?? (fallbackText.trim() ? plainTextToRichTextDocument(fallbackText) : null);
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
      quote: current?.isActive("blockquote") ?? false,
      link: current?.isActive("link") ?? false,
      linkHref: (current?.getAttributes("link").href as string | undefined) ?? "",
      inTable: current?.isActive("table") ?? false,
      style: current?.isActive("heading", { level: 2 }) ? "h2" : current?.isActive("heading", { level: 3 }) ? "h3" : "p",
      align: (["center", "right", "justify"] as const).find((alignment) => current?.isActive({ textAlign: alignment })) ?? "left",
      canUndo: current ? undo(current.state) : false,
      canRedo: current ? redo(current.state) : false,
    }),
  });

  const run = () => editor?.chain().focus();
  const applyLink = () => {
    const href = safeRichTextHref(linkUrl);
    if (!href) { setLinkError("Use an http or https address, a store path like /pages/care, or an anchor."); return; }
    run()?.extendMarkRange("link").setLink({ href }).run();
    setLinkError("");
    setLinkOpen(false);
  };

  return (
    <div className="rounded-lg">
      <div role="toolbar" aria-label="Description formatting" className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-border bg-muted/40 p-1.5">
        <ToolbarButton label="Undo" disabled={!state?.canUndo} onClick={() => run()?.command(({ state: current, dispatch }) => undo(current, dispatch)).run()}><Undo2 size={15} /></ToolbarButton>
        <ToolbarButton label="Redo" disabled={!state?.canRedo} onClick={() => run()?.command(({ state: current, dispatch }) => redo(current, dispatch)).run()}><Redo2 size={15} /></ToolbarButton>
        <select aria-label="Text style" value={state?.style ?? "p"} className="h-8 rounded-md border border-border bg-card px-2 text-[12px]" onChange={(event) => {
          const style = event.target.value;
          if (style === "p") run()?.setParagraph().run(); else run()?.setHeading({ level: style === "h2" ? 2 : 3 }).run();
        }}>
          <option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
        </select>
        <ToolbarButton label="Bold" pressed={state?.bold} onClick={() => run()?.toggleBold().run()}><BoldIcon size={15} /></ToolbarButton>
        <ToolbarButton label="Italic" pressed={state?.italic} onClick={() => run()?.toggleItalic().run()}><ItalicIcon size={15} /></ToolbarButton>
        <ToolbarButton label="Underline" pressed={state?.underline} onClick={() => run()?.toggleUnderline().run()}><UnderlineIcon size={15} /></ToolbarButton>
        <ToolbarButton label="Align left" pressed={state?.align === "left"} onClick={() => run()?.setTextAlign("left").run()}><AlignLeft size={15} /></ToolbarButton>
        <ToolbarButton label="Align center" pressed={state?.align === "center"} onClick={() => run()?.setTextAlign("center").run()}><AlignCenter size={15} /></ToolbarButton>
        <ToolbarButton label="Align right" pressed={state?.align === "right"} onClick={() => run()?.setTextAlign("right").run()}><AlignRight size={15} /></ToolbarButton>
        <ToolbarButton label="Justify" pressed={state?.align === "justify"} onClick={() => run()?.setTextAlign("justify").run()}><AlignJustify size={15} /></ToolbarButton>
        <ToolbarButton label="Bullet list" pressed={state?.bullet} onClick={() => run()?.toggleBulletList().run()}><List size={15} /></ToolbarButton>
        <ToolbarButton label="Numbered list" pressed={state?.ordered} onClick={() => run()?.toggleOrderedList().run()}><ListOrdered size={15} /></ToolbarButton>
        <ToolbarButton label="Quote" pressed={state?.quote} onClick={() => run()?.toggleBlockquote().run()}><Quote size={15} /></ToolbarButton>
        <ToolbarButton label="Link" pressed={state?.link || linkOpen} onClick={() => { setLinkUrl(state?.linkHref ?? ""); setLinkError(""); setLinkOpen((open) => !open); }}><Link2 size={15} /></ToolbarButton>
        <ToolbarButton label="Insert table" disabled={state?.inTable} onClick={() => run()?.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={15} /></ToolbarButton>
        <ToolbarButton label="Clear formatting" onClick={() => run()?.unsetAllMarks().clearNodes().run()}><RemoveFormatting size={15} /></ToolbarButton>
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
      {state?.inTable && (
        <div role="toolbar" aria-label="Table" className="flex flex-wrap gap-1 border-x border-border bg-muted/20 p-1.5">
          <button type="button" className={textButton} onClick={() => run()?.addRowAfter().run()}>Add row below</button>
          <button type="button" className={textButton} onClick={() => run()?.addColumnAfter().run()}>Add column after</button>
          <button type="button" className={textButton} onClick={() => run()?.deleteRow().run()}>Delete row</button>
          <button type="button" className={textButton} onClick={() => run()?.deleteColumn().run()}>Delete column</button>
          <button type="button" className={textButton} onClick={() => run()?.deleteTable().run()}>Delete table</button>
        </div>
      )}
      <div className={surface}><EditorContent editor={editor} /></div>
    </div>
  );
}
