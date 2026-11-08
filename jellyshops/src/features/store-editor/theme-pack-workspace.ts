import { createThemePackDocument, type ThemePackId } from "@jelly/storefront-registry";

export type ThemePackLayout = {
  theme: { id: ThemePackId; settings: Record<string, unknown> };
  sections: Array<{ kind: "inline"; section: { id: string; type: string; enabled: boolean; settings: Record<string, unknown>; blocks: unknown[] } }>;
};

/** Produces a fresh, editor-owned layout without retaining shared pack state. */
export function createThemePackLayout(packId: ThemePackId): ThemePackLayout {
  const document = createThemePackDocument(packId);
  return {
    theme: { id: document.theme.id as ThemePackId, settings: structuredClone(document.globalSettings) as unknown as Record<string, unknown> },
    sections: document.pages.home.sections.map((section) => ({
      kind: "inline",
      section: structuredClone(section),
    })),
  };
}
