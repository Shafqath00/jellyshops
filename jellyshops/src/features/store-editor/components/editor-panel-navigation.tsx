import clsx from "clsx";

export type EditorPanel = "sections" | "preview" | "settings";

const panels: Array<{ id: EditorPanel; label: string }> = [
  { id: "sections", label: "Sections" },
  { id: "preview", label: "Preview" },
  { id: "settings", label: "Settings" },
];

export function EditorPanelNavigation({ value, onChange }: { value: EditorPanel; onChange(panel: EditorPanel): void }) {
  return (
    <nav aria-label="Editor panels" className="grid grid-cols-3 gap-1 border-b border-[var(--line)] bg-[var(--white)] p-2 lg:hidden">
      {panels.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={clsx(
            "min-h-10 rounded-lg px-2 text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]",
            value === id ? "bg-[var(--paper-deep)] text-[var(--ink)]" : "text-[var(--ink-soft)] hover:bg-[var(--paper)]",
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
