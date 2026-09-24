import clsx from "clsx";

export type EditorPanel = "sections" | "preview" | "settings";

const panels: Array<{ id: EditorPanel; label: string }> = [
  { id: "sections", label: "Sections" },
  { id: "preview", label: "Preview" },
  { id: "settings", label: "Settings" },
];

export function EditorPanelNavigation({ value, onChange }: { value: EditorPanel; onChange(panel: EditorPanel): void }) {
  return (
    <nav aria-label="Editor panels" className="grid grid-cols-3 gap-1 border-b border-[#e3e3e3] bg-white p-2 lg:hidden">
      {panels.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={clsx(
            "min-h-10 rounded-lg px-2 text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23633f]",
            value === id ? "bg-[#eaf2eb] text-[#173f2b]" : "text-[#5f6962] hover:bg-[#f5f7f4]",
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
