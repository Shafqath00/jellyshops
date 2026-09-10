import type { SectionNode, StorefrontDocument } from "@jelly/storefront-schema";
import type { RegionName } from "@jelly/storefront-registry";
import type { EditorCommand } from "./types";

function updateRegion(
  document: StorefrontDocument,
  region: RegionName,
  pageId: string | undefined,
  update: (sections: SectionNode[]) => SectionNode[] | null,
): StorefrontDocument {
  const page = region === "template"
    ? document.pages.find((entry) => entry.id === pageId) ?? document.pages.find((entry) => entry.type === "home")
    : undefined;
  const currentSections = page ? page.sections : document.regions[region];
  const sections = update(currentSections);
  if (!sections) return document;
  const pages = page
    ? document.pages.map((page) =>
      page.id === pageId || (!pageId && page.type === "home")
        ? { ...page, sections }
        : page,
    )
    : document.pages;
  const regions = page?.type === "home"
    ? { ...document.regions, template: sections }
    : page
      ? document.regions
      : { ...document.regions, [region]: sections };
  return { ...document, regions, pages };
}

function updateSection(document: StorefrontDocument, region: RegionName, pageId: string | undefined, sectionId: string, update: (section: SectionNode) => SectionNode): StorefrontDocument {
  return updateRegion(document, region, pageId, (sections) => {
    const index = sections.findIndex(({ id }) => id === sectionId);
    if (index < 0) return null;
    const next = [...sections];
    next[index] = update(next[index]);
    return next;
  });
}

export function applyCommand(document: StorefrontDocument, command: EditorCommand): StorefrontDocument {
  if (command.type === "replace-document") {
    if (command.document.storeId !== document.storeId) throw new Error("Template belongs to a different store");
    return structuredClone(command.document);
  }
  if (command.type === "add-page") {
    if (command.page.type !== "custom" || command.page.system) throw new Error("Only custom pages can be added");
    if (document.pages.some((page) => page.id === command.page.id || page.slug === command.page.slug)) throw new Error("Page id and slug must be unique");
    return { ...document, pages: [...document.pages, structuredClone(command.page)] };
  }
  if (command.type === "rename-page") {
    const page = document.pages.find((entry) => entry.id === command.pageId);
    if (!page) return document;
    if (page.system) throw new Error("System pages cannot be renamed");
    if (document.pages.some((entry) => entry.id !== page.id && entry.slug === command.slug)) throw new Error("Page slug must be unique");
    return { ...document, pages: document.pages.map((entry) => entry.id === command.pageId ? { ...entry, title: command.title, slug: command.slug } : entry) };
  }
  if (command.type === "remove-page") {
    const page = document.pages.find((entry) => entry.id === command.pageId);
    if (!page) return document;
    if (page.system) throw new Error("System pages cannot be removed");
    return { ...document, pages: document.pages.filter((entry) => entry.id !== command.pageId) };
  }
  if (command.type === "update-theme-preset") {
    return { ...document, theme: { ...document.theme, presetId: command.presetId } };
  }
  if (command.type === "update-theme-setting") {
    const group = document.theme.settings[command.group] as unknown as Record<string, unknown>;
    return {
      ...document,
      theme: {
        ...document.theme,
        settings: {
          ...document.theme.settings,
          [command.group]: { ...group, [command.key]: command.value },
        },
      },
    };
  }
  if (command.type === "update-section-setting") {
    return updateSection(document, command.region, command.pageId, command.sectionId, (section) => ({
      ...section, settings: { ...section.settings, [command.key]: command.value },
    }));
  }
  if (command.type === "add-section") {
    return updateRegion(document, command.region, command.pageId, (sections) => {
      if (command.toIndex < 0 || command.toIndex > sections.length) return null;
      const next = [...sections]; next.splice(command.toIndex, 0, structuredClone(command.section)); return next;
    });
  }
  if (command.type === "remove-section") {
    if (command.region === "header" || command.region === "footer") throw new Error(`The ${command.region} section cannot be removed`);
    return updateRegion(document, command.region, command.pageId, (sections) => {
      const next = sections.filter(({ id }) => id !== command.sectionId);
      return next.length === sections.length ? null : next;
    });
  }
  if (command.type === "duplicate-section") {
    return updateRegion(document, command.region, command.pageId, (sections) => {
      const index = sections.findIndex(({ id }) => id === command.sectionId);
      if (index < 0) return null;
      const copy = structuredClone(sections[index]);
      copy.id = command.createId();
      copy.blocks = copy.blocks.map((block) => ({ ...block, id: command.createId() }));
      const next = [...sections]; next.splice(index + 1, 0, copy); return next;
    });
  }
  if (command.type === "move-section") {
    return updateRegion(document, command.region, command.pageId, (sections) => {
      const from = sections.findIndex(({ id }) => id === command.sectionId);
      if (from < 0 || command.toIndex < 0 || command.toIndex >= sections.length || from === command.toIndex) return null;
      const next = [...sections]; const [section] = next.splice(from, 1); next.splice(command.toIndex, 0, section); return next;
    });
  }
  if (command.type === "toggle-section") {
    return updateSection(document, command.region, command.pageId, command.sectionId, (section) => ({ ...section, enabled: !section.enabled }));
  }

  return updateSection(document, command.region, command.pageId, command.sectionId, (section) => {
    const blocks = [...section.blocks];
    const index = "blockId" in command ? blocks.findIndex(({ id }) => id === command.blockId) : -1;
    if (command.type === "add-block") {
      if (command.toIndex < 0 || command.toIndex > blocks.length) return section;
      blocks.splice(command.toIndex, 0, structuredClone(command.block));
    } else if (index < 0) return section;
    else if (command.type === "remove-block") blocks.splice(index, 1);
    else if (command.type === "duplicate-block") blocks.splice(index + 1, 0, { ...structuredClone(blocks[index]), id: command.createId() });
    else if (command.type === "move-block") {
      if (command.toIndex < 0 || command.toIndex >= blocks.length || index === command.toIndex) return section;
      const [block] = blocks.splice(index, 1); blocks.splice(command.toIndex, 0, block);
    } else if (command.type === "toggle-block") blocks[index] = { ...blocks[index], enabled: !blocks[index].enabled };
    else if (command.type === "update-block-setting") blocks[index] = { ...blocks[index], settings: { ...blocks[index].settings, [command.key]: command.value } };
    return { ...section, blocks };
  });
}
