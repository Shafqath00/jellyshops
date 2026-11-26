"use client";

import "./content-editor.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { buttonClass } from "@/components/admin";
import { normalizeRichTextDocument, richTextToHtml, richTextWordCount, safeRichTextImageSrc, type RichTextDocument } from "@jelly/storefront-schema";
import { contentExtensions } from "./extensions";
import { EDITOR_COMMANDS, filterCommands, slashQuery, type CommandHelpers, type EditorCommand } from "./commands";
import { ButtonDialog, ImageDialog, LinkDialog, VideoDialog, type ButtonValue, type EditorMediaSource, type LinkValue } from "./dialogs";
import { EditorToolbar, shortcutLabel } from "./toolbar";
import { MediaBubble, TextBubble } from "./floating";
import { cleanPastedHtml } from "./paste";

export type { EditorMediaItem, EditorMediaSource } from "./dialogs";

export interface ContentEditorProps {
  /** Starting content (read when the editor is created; change `key` to load another item). */
  initialValue: RichTextDocument | null;
  /** Every change, as a clean rich text document. */
  onChange: (document: RichTextDocument) => void;
  /** Name for screen readers, e.g. "Page content". */
  label: string;
  /** Photos from the store's Files and uploads. Without it, photos can still be added by web address. */
  media?: EditorMediaSource;
  /** Server import for the HTML view (cleans and converts); without it the editor reads the HTML itself. */
  importHtml?: (html: string) => Promise<RichTextDocument>;
  placeholder?: string;
}

const EMPTY: RichTextDocument = { type: "doc", content: [] };

interface SlashState { query: string; from: number; to: number; index: number; top: number; left: number }

/** What the editor holds, as the saved format (unknown parts dropped, links and photos checked). */
export function editorDocument(editor: Editor): RichTextDocument {
  const document = normalizeRichTextDocument(editor.getJSON()) ?? EMPTY;
  // Empty lines at the end (the editor always keeps one, to click into) are not part of the content.
  const content = [...document.content];
  while (content.length && content[content.length - 1]!.type === "paragraph" && !(content[content.length - 1] as { content: unknown[] }).content.length) content.pop();
  return { type: "doc", content };
}

function readingTime(words: number): string {
  if (!words) return "";
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

export function ContentEditor({ initialValue, onChange, label, media, importHtml, placeholder }: ContentEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [buttonOpen, setButtonOpen] = useState(false);
  const [buttonInitial, setButtonInitial] = useState<ButtonValue | null>(null);
  const [linkInitial, setLinkInitial] = useState<LinkValue | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [source, setSource] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [sourceBusy, setSourceBusy] = useState(false);
  const [words, setWords] = useState(() => richTextWordCount(initialValue ?? EMPTY));
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [notice, setNotice] = useState("");
  const slashRef = useRef<SlashState | null>(null);
  /** Where a "/" was dismissed with Escape, so typing on does not reopen the menu for it. */
  const dismissedRef = useRef<number | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editorRef = useRef<Editor | null>(null);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  const openLink = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const attrs = editor.getAttributes("link") as { href?: string; target?: string };
    setLinkInitial(attrs.href ? { href: attrs.href, newTab: attrs.target === "_blank" } : null);
    if (attrs.href) editor.chain().extendMarkRange("link").run();
    setLinkOpen(true);
  }, []);

  const helpers: CommandHelpers = useMemo(() => ({
    openImage: () => setImageOpen(true),
    openVideo: () => setVideoOpen(true),
    openButton: () => { setButtonInitial(null); setButtonOpen(true); },
  }), []);
  const helpersRef = useRef(helpers);
  helpersRef.current = helpers;

  /** Photos dropped or pasted as files: uploaded to Files, then placed where they landed. */
  const uploadFiles = useCallback(async (files: File[], position?: number) => {
    const upload = mediaRef.current?.upload;
    const editor = editorRef.current;
    if (!upload || !editor) { setNotice("Use Insert → Photo to add photos."); return; }
    for (const file of files.filter((entry) => entry.type.startsWith("image/")).slice(0, 10)) {
      setNotice(`Uploading ${file.name}…`);
      try {
        const item = await upload(file);
        const node = { type: "image", attrs: { src: item.url, alt: item.alt ?? file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ") } };
        if (position !== undefined) editor.chain().focus().insertContentAt(position, node).run();
        else editor.chain().focus().insertContent(node).run();
        setNotice(`${file.name} added. Check its alt text.`);
      } catch (reason) {
        setNotice(reason instanceof Error ? reason.message : `${file.name} could not be uploaded.`);
      }
    }
  }, []);

  const runCommand = useCallback((command: EditorCommand) => {
    const editor = editorRef.current;
    const current = slashRef.current;
    if (!editor) return;
    if (current) editor.chain().focus().deleteRange({ from: current.from, to: current.to }).run();
    slashRef.current = null;
    setSlash(null);
    command.run(editor, helpersRef.current);
  }, []);

  // Created once: TipTap re-applies options on every render, and new extension objects would rebuild the editor.
  const extensions = useMemo(() => contentExtensions({ placeholder, onLinkShortcut: () => openLink() }), [placeholder, openLink]);
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initialValue && initialValue.content.length ? initialValue : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: { class: "jce-content", role: "textbox", "aria-multiline": "true", "aria-label": label, spellcheck: "true" },
      transformPastedHTML: cleanPastedHtml,
      handleKeyDown: (_view, event) => {
        const current = slashRef.current;
        if (!current) return false;
        const items = filterCommands(current.query);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const step = event.key === "ArrowDown" ? 1 : -1;
          const next = { ...current, index: (current.index + step + items.length) % Math.max(items.length, 1) };
          slashRef.current = next;
          setSlash(next);
          return true;
        }
        if ((event.key === "Enter" || event.key === "Tab") && items.length) {
          runCommand(items[Math.min(current.index, items.length - 1)]!);
          return true;
        }
        if (event.key === "Escape") { dismissedRef.current = current.from; slashRef.current = null; setSlash(null); return true; }
        return false;
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (!files.length) return false;
        void uploadFiles(files, view.state.selection.from);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (!files.length) return false;
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void uploadFiles(files, position);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const document = editorDocument(current);
      setWords(richTextWordCount(document));
      onChangeRef.current(document);
    },
    onSelectionUpdate: ({ editor: current }) => updateSlash(current),
    onTransaction: ({ editor: current }) => updateSlash(current),
  });
  editorRef.current = editor;

  function updateSlash(current: Editor) {
    const { $from, empty } = current.state.selection;
    const inText = empty && $from.parent.isTextblock && $from.parent.type.name !== "codeBlock";
    const found = inText ? slashQuery($from.parent.textBetween(0, $from.parentOffset, undefined, "￼"), $from.pos) : null;
    if (!found) dismissedRef.current = null;
    if (!found || found.from === dismissedRef.current || !filterCommands(found.query).length) {
      if (slashRef.current) { slashRef.current = null; setSlash(null); }
      return;
    }
    const coords = current.view.coordsAtPos($from.pos);
    const shell = shellRef.current?.getBoundingClientRect();
    const previous = slashRef.current;
    const next: SlashState = {
      query: found.query, from: found.from, to: $from.pos,
      index: previous && previous.query === found.query ? previous.index : 0,
      top: coords.bottom - (shell?.top ?? 0) + 6, left: Math.max(0, coords.left - (shell?.left ?? 0)),
    };
    // Only a real change re-renders (every transaction runs this).
    if (previous && previous.query === next.query && previous.from === next.from && previous.to === next.to && previous.index === next.index && previous.top === next.top && previous.left === next.left) return;
    slashRef.current = next;
    setSlash(next);
  }

  // Keep the list item in view while moving through it with the arrow keys.
  useEffect(() => {
    if (!slash) return;
    shellRef.current?.querySelector(`[data-slash-index="${slash.index}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [slash]);

  function toggleSource() {
    if (!editor) return;
    if (!sourceMode) {
      setSource(richTextToHtml(editorDocument(editor)));
      setSourceError("");
      setSourceMode(true);
      return;
    }
    void applySource();
  }

  async function applySource() {
    if (!editor) return;
    setSourceBusy(true);
    setSourceError("");
    try {
      const document = importHtml ? await importHtml(source) : null;
      if (document) editor.commands.setContent(document.content.length ? document : { type: "doc", content: [{ type: "paragraph" }] }, { emitUpdate: true });
      else editor.commands.setContent(cleanPastedHtml(source), { emitUpdate: true });
      setSourceMode(false);
    } catch (reason) {
      setSourceError(reason instanceof Error ? reason.message : "That HTML could not be read. Check it and try again.");
    } finally {
      setSourceBusy(false);
    }
  }

  if (!editor) return <div className="jce-shell jce-shell--loading" aria-busy="true"><div className="jk-skeleton jce-skeleton" /></div>;

  const slashItems = slash ? filterCommands(slash.query) : [];

  return (
    <div className="jce-shell" ref={shellRef}>
      <EditorToolbar editor={editor} helpers={helpers} onLink={openLink} sourceMode={sourceMode} onToggleSource={toggleSource} />
      {sourceMode ? (
        <div className="jce-source">
          <label htmlFor="jce-source" className="jce-source-label">HTML <span className="jk-muted">Only safe formatting is kept: scripts, styles and unknown tags are removed when you go back.</span></label>
          <textarea id="jce-source" className="jce-source-input" value={source} spellCheck={false} onChange={(event) => setSource(event.target.value)} />
          {sourceError ? <p className="jk-field-error" role="alert">{sourceError}</p> : null}
          <div className="jce-source-actions">
            <button type="button" className="jk-button" onClick={() => setSourceMode(false)} disabled={sourceBusy}>Cancel</button>
            <button type="button" className={buttonClass("primary")} onClick={() => void applySource()} disabled={sourceBusy}>{sourceBusy ? "Applying…" : "Apply HTML"}</button>
          </div>
        </div>
      ) : (
        <>
          <EditorContent editor={editor} className="jce-surface" />
          <TextBubble editor={editor} onLink={openLink} />
          <MediaBubble editor={editor} onEditButton={() => {
            const attrs = editor.getAttributes("button") as { href?: string; label?: string; style?: string; target?: string };
            setButtonInitial({ label: attrs.label ?? "", href: attrs.href ?? "", style: attrs.style === "secondary" ? "secondary" : "primary", newTab: attrs.target === "_blank" });
            setButtonOpen(true);
          }} />
        </>
      )}
      {slash && slashItems.length ? (
        <div className="jce-slash" style={{ top: slash.top, left: slash.left }} role="listbox" aria-label="Insert a block">
          {slashItems.map((command, index) => (
            <button key={command.id} type="button" role="option" aria-selected={index === slash.index} data-slash-index={index} className="jce-menu-item"
              onMouseDown={(event) => { event.preventDefault(); runCommand(command); }}
              onMouseEnter={() => { const next = { ...slash, index }; slashRef.current = next; setSlash(next); }}>
              <command.icon size={16} aria-hidden />
              <span><strong>{command.label}</strong><small>{command.description}</small></span>
              {command.shortcut ? <kbd>{shortcutLabel(command.shortcut)}</kbd> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div className="jce-footer">
        <span>{words} {words === 1 ? "word" : "words"}{words ? ` · ${readingTime(words)}` : ""}</span>
        <span className="jce-hint">Type <kbd>/</kbd> to add a heading, photo, table and more</span>
        <span className="jce-notice" role="status" aria-live="polite">{notice}</span>
      </div>

      <LinkDialog open={linkOpen} onClosed={() => editor.commands.focus()} onOpenChange={setLinkOpen} initial={linkInitial}
        onApply={({ href, newTab }) => {
          const chain = editor.chain().focus();
          if (editor.state.selection.empty && !editor.isActive("link")) chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href, target: newTab ? "_blank" : null } }] }).run();
          else chain.extendMarkRange("link").setLink({ href, target: newTab ? "_blank" : null }).run();
        }}
        onRemove={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()} />
      <ImageDialog open={imageOpen} onClosed={() => editor.commands.focus()} onOpenChange={setImageOpen} media={media}
        onInsert={(value) => { if (safeRichTextImageSrc(value.src)) editor.chain().focus().insertContent({ type: "image", attrs: value }).run(); }} />
      <VideoDialog open={videoOpen} onClosed={() => editor.commands.focus()} onOpenChange={setVideoOpen} onInsert={(value) => editor.chain().focus().insertContent({ type: "video", attrs: value }).run()} />
      <ButtonDialog open={buttonOpen} onClosed={() => editor.commands.focus()} onOpenChange={setButtonOpen} initial={buttonInitial}
        onApply={(value) => {
          const attrs = { label: value.label, href: value.href, style: value.style === "secondary" ? "secondary" : null, target: value.newTab ? "_blank" : null };
          if (buttonInitial && editor.isActive("button")) editor.chain().focus().updateAttributes("button", attrs).run();
          else editor.chain().focus().insertContent({ type: "button", attrs }).run();
        }} />
    </div>
  );
}

export { EDITOR_COMMANDS };
