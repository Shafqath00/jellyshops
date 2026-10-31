import { Smartphone, Tablet } from "lucide-react";

/** Shown above the settings while the preview is on Mobile or Tablet, so merchants know which changes apply to that screen only. */
export function MobileEditingNote({ phoneSettings, device = "mobile" }: { phoneSettings: number; device?: "mobile" | "tablet" }) {
  const name = device === "tablet" ? "Tablet" : "Phone";
  const Icon = device === "tablet" ? Tablet : Smartphone;
  return (
    <p role="note" className="mb-3 flex gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-[12px] leading-snug text-[var(--ink-soft)]">
      <Icon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        {phoneSettings > 0
          ? `${name} view: settings marked (${name.toLowerCase()}) change this only on ${name.toLowerCase()}s. Other settings change every screen.`
          : `${name} view: this item has no ${name.toLowerCase()}-only settings, so changes here apply to every screen.`}
      </span>
    </p>
  );
}
