"use client";

import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Heading from "@tiptap/extension-heading";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Link from "@tiptap/extension-link";
import Blockquote from "@tiptap/extension-blockquote";
import HardBreak from "@tiptap/extension-hard-break";
import { normalizeRichTextDocument, resolveRichTextDocument, safeRichTextHref, type RichTextDocument, type SectionNode } from "@jelly/storefront-schema";

const extensions = [
  Document, Paragraph, Text, Heading.configure({ levels: [1, 2, 3] }), Bold, Italic,
  BulletList, OrderedList, ListItem, Blockquote, HardBreak,
  Link.configure({
    openOnClick: false,
    autolink: false,
    linkOnPaste: false,
    isAllowedUri: (url) => safeRichTextHref(url) !== null,
    HTMLAttributes: { target: null, rel: null },
  }),
];

const toolbarButton = "rounded border border-[#d7d7d7] bg-white px-2 py-1 text-[11px] font-medium text-[#303030] hover:bg-[#f3f3f3]";

export function RichTextDocumentEditor({ section, onSave }: { section: SectionNode; onSave(document: RichTextDocument): Promise<void> }) {
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [initial] = useState(() => resolveRichTextDocument(section));
  const editor = useEditor({
    extensions,
    content: initial.content.length ? initial : { type: "doc", content: [{ type: "paragraph" }] },
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": "Rich text document", "aria-multiline": "true", class: "min-h-36 rounded-lg border border-[#d7d7d7] bg-white p-3 text-sm leading-6 outline-none focus:border-[#8c8c8c]" } },
    onUpdate: () => { setSaved(false); },
  }, [section.id]);

  const applyLink = () => {
    const href = safeRichTextHref(linkUrl);
    if (!href) {
      setError("Use an HTTP or HTTPS URL, store path, or anchor.");
      return;
    }
    editor?.chain().focus().setLink({ href }).run();
    setError(null);
  };

  const save = async () => {
    if (!editor) return;
    const document = normalizeRichTextDocument(editor.getJSON());
    if (!document) {
      setError("The rich text document could not be saved.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(document);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The rich text document could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-3">
    <div role="toolbar" aria-label="Rich text formatting" className="flex flex-wrap gap-1">
      <button type="button" aria-label="Paragraph" className={toolbarButton} onClick={() => editor?.chain().focus().setParagraph().run()}>P</button>
      {[1, 2, 3].map((level) => <button key={level} type="button" aria-label={`Heading ${level}`} className={toolbarButton} onClick={() => editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}>H{level}</button>)}
      <button type="button" aria-label="Bold" className={toolbarButton} onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</button>
      <button type="button" aria-label="Italic" className={toolbarButton} onClick={() => editor?.chain().focus().toggleItalic().run()}>Italic</button>
      <button type="button" aria-label="Bullet list" className={toolbarButton} onClick={() => editor?.chain().focus().toggleBulletList().run()}>Bullets</button>
      <button type="button" aria-label="Ordered list" className={toolbarButton} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>Numbers</button>
      <button type="button" aria-label="Blockquote" className={toolbarButton} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>Quote</button>
      <button type="button" aria-label="Hard break" className={toolbarButton} onClick={() => editor?.chain().focus().setHardBreak().run()}>Break</button>
    </div>
    <div className="[&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:pl-3"><EditorContent editor={editor} /></div>
    <div className="flex flex-wrap gap-2">
      <input aria-label="Link URL" type="text" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https:// or /pages/..." className="min-w-0 flex-1 rounded border border-[#d7d7d7] px-2 py-1 text-xs" />
      <button type="button" className={toolbarButton} onClick={applyLink}>Apply link</button>
      <button type="button" className={toolbarButton} onClick={() => editor?.chain().focus().unsetLink().run()}>Remove link</button>
    </div>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => { void save(); }} disabled={!editor || saving} className="rounded bg-[#241f20] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save rich text"}</button>
      {saved && <span role="status" className="text-xs text-green-700">Saved</span>}
    </div>
  </div>;
}
