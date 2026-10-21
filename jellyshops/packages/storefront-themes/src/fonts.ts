/** Font families a merchant can pick. Fraunces and Inter are self-hosted by the app as CSS variables. */
export const FONT_OPTIONS = [
  { value: "Fraunces", label: "Fraunces (serif)" },
  { value: "Inter", label: "Inter (sans-serif)" },
  { value: "Georgia", label: "Georgia (serif)" },
  { value: "Arial", label: "Arial (sans-serif)" },
] as const;

const stacks: Record<string, string> = {
  Fraunces: "var(--font-fraunces), Georgia, \"Times New Roman\", serif",
  Inter: "var(--font-inter), \"Helvetica Neue\", Arial, sans-serif",
  Georgia: "Georgia, \"Times New Roman\", serif",
  Arial: "Arial, \"Helvetica Neue\", sans-serif",
};

/** Turns a saved font name into a safe CSS font-family stack. Unknown but well-formed names are quoted with a generic fallback. */
export function fontStack(name: unknown, fallback: string): string {
  const value = typeof name === "string" ? name.trim() : "";
  if (stacks[value]) return stacks[value];
  if (/^[\w .'-]{1,80}$/.test(value)) return `"${value.replace(/"/g, "")}", ${stacks[fallback] ?? fallback}`;
  return stacks[fallback] ?? fallback;
}
