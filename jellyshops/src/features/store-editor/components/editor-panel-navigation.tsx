import clsx from "clsx";
export type EditorPanel = "sections" | "preview" | "settings";
export function EditorPanelNavigation({ value, onChange, editPanel = "sections" }: { value: EditorPanel; onChange(panel: EditorPanel): void; editPanel?: "sections" | "settings" }) {
  return <nav aria-label="Editor panels" className="grid grid-cols-2 gap-1 border-b border-[var(--line)] bg-[var(--white)] p-1 lg:hidden">
    <button type="button" aria-pressed={value !== "preview"} onClick={() => { if (value === "preview") onChange(editPanel); }} className={clsx("min-h-9 rounded-lg text-xs font-semibold", value !== "preview" ? "bg-muted text-foreground" : "text-muted-foreground")}>Edit</button>
    <button type="button" aria-pressed={value === "preview"} onClick={() => onChange("preview")} className={clsx("min-h-9 rounded-lg text-xs font-semibold", value === "preview" ? "bg-muted text-foreground" : "text-muted-foreground")}>Preview</button>
  </nav>;
}
