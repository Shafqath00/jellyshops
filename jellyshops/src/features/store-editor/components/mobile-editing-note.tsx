import { Smartphone } from "lucide-react";

/** Shown above the settings while the preview is on Mobile, so merchants know which changes are phone-only. */
export function MobileEditingNote({ phoneSettings }: { phoneSettings: number }) {
  return (
    <p role="note" className="mb-3 flex gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-[12px] leading-snug text-[var(--ink-soft)]">
      <Smartphone size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        {phoneSettings > 0
          ? "Phone view: settings marked (phone) change this only on phones. Other settings change every screen."
          : "Phone view: this item has no phone-only settings, so changes here apply to every screen."}
      </span>
    </p>
  );
}
