"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronDown, Code, FileCode2, Highlighter, Italic, Link2,
  List, ListChecks, ListOrdered, Plus, Redo2, RemoveFormatting, Strikethrough, Underline, Undo2, Baseline,
} from "lucide-react";
import { EDITOR_COMMANDS, type CommandHelpers } from "./commands";

/** Shortcuts shown with ⌘ on a Mac and Ctrl elsewhere. */
export function shortcutLabel(shortcut: string): string {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return mac ? shortcut.replace(/Ctrl\+/g, "⌘").replace(/Alt\+/g, "⌥").replace(/Shift\+/g, "⇧") : shortcut;
}

export const TEXT_COLOURS = [
  { label: "Default", value: "" }, { label: "Grey", value: "#6b675f" }, { label: "Red", value: "#c92a47" }, { label: "Orange", value: "#c2570c" },
  { label: "Green", value: "#2f7d32" }, { label: "Blue", value: "#2f5bff" }, { label: "Purple", value: "#7c3aed" },
];
export const HIGHLIGHTS = [
  { label: "None", value: "" }, { label: "Yellow", value: "#fff3a3" }, { label: "Green", value: "#d3f5c9" }, { label: "Blue", value: "#d6e4ff" },
  { label: "Pink", value: "#ffd9e6" }, { label: "Orange", value: "#ffe2c2" },
];

export const BLOCK_TYPES = [
  { value: "paragraph", label: "Text" },
  { value: "h1", label: "Heading 1" }, { value: "h2", label: "Heading 2" }, { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" }, { value: "h5", label: "Heading 5" }, { value: "h6", label: "Heading 6" },
  { value: "blockquote", label: "Quote" }, { value: "codeBlock", label: "Code block" },
] as const;

export function ToolButton({ label, shortcut, pressed, disabled, onClick, children }: { label: string; shortcut?: string; pressed?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  const title = shortcut ? `${label} (${shortcutLabel(shortcut)})` : label;
  return (
    <button type="button" className="jce-tool" aria-label={label} title={title} aria-pressed={pressed} disabled={disabled}
      onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

/** A small popover menu that closes on Escape, outside click and after a choice. */
function Popover({ label, icon, children, wide, disabled }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode; wide?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return (
    <div className="jce-popover" ref={root}>
      <button type="button" className="jce-tool jce-tool--menu" aria-label={label} title={label} aria-haspopup="true" aria-expanded={open} disabled={disabled}
        onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((value) => !value)}>
        {icon}<ChevronDown size={12} aria-hidden />
      </button>
      {open ? <div className={`jce-popover-panel${wide ? " jce-popover-panel--wide" : ""}`} role="menu">{children(() => setOpen(false))}</div> : null}
    </div>
  );
}

export function blockTypeOf(editor: Editor): string {
  for (let level = 1; level <= 6; level++) if (editor.isActive("heading", { level })) return `h${level}`;
  if (editor.isActive("codeBlock")) return "codeBlock";
  if (editor.isActive("blockquote")) return "blockquote";
  return "paragraph";
}

export function setBlockType(editor: Editor, value: string): void {
  const chain = editor.chain().focus();
  if (value.startsWith("h")) chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  else if (value === "blockquote") (editor.isActive("blockquote") ? chain : chain.setParagraph()).toggleBlockquote().run();
  else if (value === "codeBlock") chain.toggleCodeBlock().run();
  else {
    if (editor.isActive("blockquote")) chain.lift("blockquote");
    chain.setParagraph().run();
  }
}

export function ColourSwatches({ editor, kind, onDone }: { editor: Editor; kind: "text" | "highlight"; onDone: () => void }) {
  const colours = kind === "text" ? TEXT_COLOURS : HIGHLIGHTS;
  return (
    <div className="jce-swatches">
      {colours.map((colour) => (
        <button key={colour.label} type="button" role="menuitem" className="jce-swatch" aria-label={`${kind === "text" ? "Text colour" : "Highlight"}: ${colour.label}`} title={colour.label}
          style={{ ["--swatch" as string]: colour.value || "transparent" }} data-empty={!colour.value}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const chain = editor.chain().focus();
            if (kind === "text") (colour.value ? chain.setMark("textStyle", { color: colour.value }) : chain.unsetMark("textStyle")).run();
            else (colour.value ? chain.setHighlight({ color: colour.value }) : chain.unsetHighlight()).run();
            onDone();
          }} />
      ))}
    </div>
  );
}

export function EditorToolbar({ editor, helpers, onLink, sourceMode, onToggleSource }: {
  editor: Editor; helpers: CommandHelpers; onLink: () => void; sourceMode: boolean; onToggleSource: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      block: blockTypeOf(current),
      bold: current.isActive("bold"), italic: current.isActive("italic"), underline: current.isActive("underline"),
      strike: current.isActive("strike"), code: current.isActive("code"), link: current.isActive("link"),
      bullet: current.isActive("bulletList"), ordered: current.isActive("orderedList"), task: current.isActive("taskList"),
      align: (["center", "right", "justify"] as const).find((value) => current.isActive({ textAlign: value })) ?? "left",
      canUndo: current.can().undo(), canRedo: current.can().redo(),
      inTable: current.isActive("table"),
    }),
  });
  const disabled = sourceMode;

  return (
    <div className="jce-toolbar" role="toolbar" aria-label="Formatting">
      <div className="jce-tool-group">
        <ToolButton label="Undo" shortcut="Ctrl+Z" disabled={disabled || !state.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} aria-hidden /></ToolButton>
        <ToolButton label="Redo" shortcut="Ctrl+Shift+Z" disabled={disabled || !state.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} aria-hidden /></ToolButton>
      </div>
      <div className="jce-tool-group">
        <label className="jce-visually-hidden" htmlFor="jce-block-type">Text style</label>
        <select id="jce-block-type" className="jce-select" value={state.block} disabled={disabled} onChange={(event) => setBlockType(editor, event.target.value)}>
          {BLOCK_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
      </div>
      <div className="jce-tool-group">
        <ToolButton label="Bold" shortcut="Ctrl+B" pressed={state.bold} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} aria-hidden /></ToolButton>
        <ToolButton label="Italic" shortcut="Ctrl+I" pressed={state.italic} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} aria-hidden /></ToolButton>
        <ToolButton label="Underline" shortcut="Ctrl+U" pressed={state.underline} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={16} aria-hidden /></ToolButton>
        <ToolButton label="Strikethrough" shortcut="Ctrl+Shift+S" pressed={state.strike} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} aria-hidden /></ToolButton>
        <ToolButton label="Inline code" shortcut="Ctrl+E" pressed={state.code} disabled={disabled} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={16} aria-hidden /></ToolButton>
        <Popover disabled={disabled} label="Text colour" icon={<Baseline size={16} aria-hidden />}>{(close) => <ColourSwatches editor={editor} kind="text" onDone={close} />}</Popover>
        <Popover disabled={disabled} label="Highlight" icon={<Highlighter size={16} aria-hidden />}>{(close) => <ColourSwatches editor={editor} kind="highlight" onDone={close} />}</Popover>
        <ToolButton label={state.link ? "Edit link" : "Add link"} shortcut="Ctrl+K" pressed={state.link} disabled={disabled} onClick={onLink}><Link2 size={16} aria-hidden /></ToolButton>
        <ToolButton label="Clear formatting" disabled={disabled} onClick={() => editor.chain().focus().unsetAllMarks().run()}><RemoveFormatting size={16} aria-hidden /></ToolButton>
      </div>
      <div className="jce-tool-group">
        <ToolButton label="Align left" shortcut="Ctrl+Shift+L" pressed={state.align === "left"} disabled={disabled} onClick={() => editor.chain().focus().unsetTextAlign().run()}><AlignLeft size={16} aria-hidden /></ToolButton>
        <ToolButton label="Align centre" shortcut="Ctrl+Shift+E" pressed={state.align === "center"} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter size={16} aria-hidden /></ToolButton>
        <ToolButton label="Align right" shortcut="Ctrl+Shift+R" pressed={state.align === "right"} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight size={16} aria-hidden /></ToolButton>
        <ToolButton label="Justify" shortcut="Ctrl+Shift+J" pressed={state.align === "justify"} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify size={16} aria-hidden /></ToolButton>
      </div>
      <div className="jce-tool-group">
        <ToolButton label="Bulleted list" shortcut="Ctrl+Shift+8" pressed={state.bullet} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} aria-hidden /></ToolButton>
        <ToolButton label="Numbered list" shortcut="Ctrl+Shift+7" pressed={state.ordered} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} aria-hidden /></ToolButton>
        <ToolButton label="Checklist" shortcut="Ctrl+Shift+9" pressed={state.task} disabled={disabled} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks size={16} aria-hidden /></ToolButton>
      </div>
      <div className="jce-tool-group">
        <Popover disabled={disabled} label="Insert" icon={<span className="jce-insert-label"><Plus size={16} aria-hidden /> Insert</span>} wide>
          {(close) => (
            <div className="jce-menu-list">
              {EDITOR_COMMANDS.filter((command) => command.group === "Media" || command.group === "Layout").map((command) => (
                <button key={command.id} type="button" role="menuitem" className="jce-menu-item" disabled={disabled}
                  onMouseDown={(event) => event.preventDefault()} onClick={() => { close(); command.run(editor, helpers); }}>
                  <command.icon size={16} aria-hidden /><span><strong>{command.label}</strong><small>{command.description}</small></span>
                </button>
              ))}
            </div>
          )}
        </Popover>
      </div>
      {state.inTable && !disabled ? (
        <div className="jce-tool-group jce-table-tools" aria-label="Table">
          <button type="button" className="jce-chip" onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row</button>
          <button type="button" className="jce-chip" onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Column</button>
          <button type="button" className="jce-chip" onClick={() => editor.chain().focus().deleteRow().run()}>− Row</button>
          <button type="button" className="jce-chip" onClick={() => editor.chain().focus().deleteColumn().run()}>− Column</button>
          <button type="button" className="jce-chip" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Header row</button>
          <button type="button" className="jce-chip jce-chip--danger" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
        </div>
      ) : null}
      <div className="jce-tool-group jce-tool-group--end">
        <ToolButton label={sourceMode ? "Back to the editor" : "Edit HTML"} pressed={sourceMode} onClick={onToggleSource}><FileCode2 size={16} aria-hidden /></ToolButton>
      </div>
    </div>
  );
}
