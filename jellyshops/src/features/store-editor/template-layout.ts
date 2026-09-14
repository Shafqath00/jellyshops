import type { SectionNode } from "@jelly/storefront-schema";

export type TemplatePlacement =
  | { kind: "inline"; section: SectionNode }
  | { kind: "global"; globalSectionId: string };

function readPlacements(layout: Record<string, unknown>): TemplatePlacement[] {
  const value = layout.sections;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): TemplatePlacement[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    if (candidate.kind === "global" && typeof candidate.globalSectionId === "string") {
      return [{ kind: "global", globalSectionId: candidate.globalSectionId }];
    }
    if (candidate.kind === "inline" && candidate.section && typeof candidate.section === "object" && !Array.isArray(candidate.section)) {
      return [{ kind: "inline", section: structuredClone(candidate.section) as SectionNode }];
    }
    return [];
  });
}

function withPlacements(layout: Record<string, unknown>, sections: TemplatePlacement[]): Record<string, unknown> {
  return { ...structuredClone(layout), sections };
}

export function appendInlineSection(layout: Record<string, unknown>, section: SectionNode): Record<string, unknown> {
  return withPlacements(layout, [
    ...readPlacements(layout),
    { kind: "inline", section: structuredClone(section) },
  ]);
}

export function appendGlobalPlacement(layout: Record<string, unknown>, globalSectionId: string): Record<string, unknown> {
  return withPlacements(layout, [
    ...readPlacements(layout),
    { kind: "global", globalSectionId },
  ]);
}

export function updateInlineSection(
  layout: Record<string, unknown>,
  sectionId: string,
  update: (section: SectionNode) => SectionNode,
): Record<string, unknown> {
  const sections = readPlacements(layout).map((placement) => {
    if (placement.kind !== "inline" || placement.section.id !== sectionId) return placement;
    return { kind: "inline" as const, section: structuredClone(update(structuredClone(placement.section))) };
  });
  return withPlacements(layout, sections);
}

export function replaceInlineWithGlobal(
  layout: Record<string, unknown>,
  sectionId: string,
  globalSectionId: string,
): Record<string, unknown> {
  const sections = readPlacements(layout).map((placement) =>
    placement.kind === "inline" && placement.section.id === sectionId
      ? { kind: "global" as const, globalSectionId }
      : placement,
  );
  return withPlacements(layout, sections);
}

export function detachGlobalPlacement(
  layout: Record<string, unknown>,
  globalSectionId: string,
  section: SectionNode,
): Record<string, unknown> {
  let detached = false;
  const sections = readPlacements(layout).map((placement) => {
    if (!detached && placement.kind === "global" && placement.globalSectionId === globalSectionId) {
      detached = true;
      return { kind: "inline" as const, section: structuredClone(section) };
    }
    return placement;
  });
  return withPlacements(layout, sections);
}
