import type { Editor } from "@tiptap/react";
import {
  CheckSquare, Code2, Heading1, Heading2, Heading3, Heading4, ImageIcon, List, ListOrdered, Minus, MousePointerClick,
  Pilcrow, Quote, Table as TableIcon, Video, type LucideIcon,
} from "lucide-react";

/** What a command needs from the editor screen besides the editor (dialogs live in React). */
export interface CommandHelpers {
  openImage: () => void;
  openVideo: () => void;
  openButton: () => void;
}

export interface EditorCommand {
  id: string;
  label: string;
  description: string;
  /** Extra words people may type after "/". */
  keywords: string[];
  icon: LucideIcon;
  /** Shown next to the item; the editor already listens for it. */
  shortcut?: string;
  group: "Text" | "Lists" | "Media" | "Layout";
  run: (editor: Editor, helpers: CommandHelpers) => void;
}

export const EDITOR_COMMANDS: EditorCommand[] = [
  { id: "paragraph", label: "Text", description: "Plain paragraph text", keywords: ["paragraph", "normal", "body"], icon: Pilcrow, group: "Text", shortcut: "Ctrl+Alt+0",
    run: (editor) => editor.chain().focus().setParagraph().run() },
  { id: "h1", label: "Heading 1", description: "Big section heading", keywords: ["title", "h1", "large"], icon: Heading1, group: "Text", shortcut: "Ctrl+Alt+1",
    run: (editor) => editor.chain().focus().setHeading({ level: 1 }).run() },
  { id: "h2", label: "Heading 2", description: "Medium section heading", keywords: ["subtitle", "h2"], icon: Heading2, group: "Text", shortcut: "Ctrl+Alt+2",
    run: (editor) => editor.chain().focus().setHeading({ level: 2 }).run() },
  { id: "h3", label: "Heading 3", description: "Small section heading", keywords: ["h3"], icon: Heading3, group: "Text", shortcut: "Ctrl+Alt+3",
    run: (editor) => editor.chain().focus().setHeading({ level: 3 }).run() },
  { id: "h4", label: "Heading 4", description: "Smaller heading (also 5 and 6 in the toolbar)", keywords: ["h4", "h5", "h6"], icon: Heading4, group: "Text", shortcut: "Ctrl+Alt+4",
    run: (editor) => editor.chain().focus().setHeading({ level: 4 }).run() },
  { id: "quote", label: "Quote", description: "A quotation or review", keywords: ["blockquote", "review", "testimonial"], icon: Quote, group: "Text", shortcut: "Ctrl+Shift+B",
    run: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { id: "code", label: "Code block", description: "Text shown exactly as typed", keywords: ["pre", "monospace", "snippet"], icon: Code2, group: "Text", shortcut: "Ctrl+Alt+C",
    run: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  { id: "bullets", label: "Bulleted list", description: "A simple list", keywords: ["ul", "unordered", "points"], icon: List, group: "Lists", shortcut: "Ctrl+Shift+8",
    run: (editor) => editor.chain().focus().toggleBulletList().run() },
  { id: "numbers", label: "Numbered list", description: "Steps in order", keywords: ["ol", "ordered", "steps"], icon: ListOrdered, group: "Lists", shortcut: "Ctrl+Shift+7",
    run: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { id: "checklist", label: "Checklist", description: "Items with tick boxes", keywords: ["todo", "task", "check"], icon: CheckSquare, group: "Lists", shortcut: "Ctrl+Shift+9",
    run: (editor) => editor.chain().focus().toggleTaskList().run() },
  { id: "image", label: "Photo", description: "From your files, an upload or a web address", keywords: ["image", "picture", "img", "upload"], icon: ImageIcon, group: "Media",
    run: (_editor, helpers) => helpers.openImage() },
  { id: "video", label: "Video", description: "YouTube or Vimeo", keywords: ["youtube", "vimeo", "embed", "film"], icon: Video, group: "Media",
    run: (_editor, helpers) => helpers.openVideo() },
  { id: "button", label: "Button", description: "A link that stands out", keywords: ["cta", "link", "call to action"], icon: MousePointerClick, group: "Media",
    run: (_editor, helpers) => helpers.openButton() },
  { id: "table", label: "Table", description: "Rows and columns, for sizes or prices", keywords: ["grid", "rows", "columns", "sizes"], icon: TableIcon, group: "Layout",
    run: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: "divider", label: "Divider", description: "A line between sections", keywords: ["hr", "line", "separator", "rule"], icon: Minus, group: "Layout",
    run: (editor) => editor.chain().focus().setHorizontalRule().run() },
];

/** Commands whose label, id or keywords start with (or contain) what was typed after "/". */
export function filterCommands(query: string, commands: EditorCommand[] = EDITOR_COMMANDS): EditorCommand[] {
  const text = query.trim().toLowerCase();
  if (!text) return commands;
  const starts = commands.filter((command) => [command.label, command.id, ...command.keywords].some((word) => word.toLowerCase().startsWith(text)));
  const contains = commands.filter((command) => !starts.includes(command) && [command.label, command.description, ...command.keywords].some((word) => word.toLowerCase().includes(text)));
  return [...starts, ...contains];
}

/** The "/word" being typed just before the cursor in a text block, with where it starts. */
export function slashQuery(textBefore: string, cursor: number): { query: string; from: number } | null {
  const match = /(?:^|\s)\/([a-z0-9]*(?: [a-z0-9]+)?)$/i.exec(textBefore);
  if (!match || match[1]!.length > 24) return null;
  return { query: match[1]!, from: cursor - match[1]!.length - 1 };
}
