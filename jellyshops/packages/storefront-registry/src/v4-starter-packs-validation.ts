import type { PageType, SectionNode } from "@jelly/storefront-schema";
import { getBlockDefinition, getSectionDefinition, validateSectionAgainstRegistry } from "./registry.js";
import { V4_STARTER_PACK_IDS, type V4StarterPack } from "./v4-starter-packs.js";

const pageTypes: PageType[] = ["home", "product", "collection", "cart", "search", "page", "blog", "article", "not-found"];
const globalKeys = ["announcement", "header", "footer"] as const;
const resourceTypes = ["product", "collection", "page", "blog", "article"] as const;
const supportedThemes = new Set<string>(V4_STARTER_PACK_IDS);
const themeVersionPattern = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;

export interface V4StarterPackIssue {
  code: string;
  path: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isSectionNode(value: unknown): value is SectionNode {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.type === "string"
    && typeof value.enabled === "boolean"
    && isRecord(value.settings)
    && Array.isArray(value.blocks)
    && value.blocks.every((item) => isRecord(item)
      && typeof item.id === "string"
      && typeof item.type === "string"
      && typeof item.enabled === "boolean"
      && isRecord(item.settings));
}

function safeUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function inspectUrls(value: unknown, path: string, issues: V4StarterPackIssue[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectUrls(item, `${path}[${index}]`, issues));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if ((key === "url" || key === "href") && typeof child === "string" && !safeUrl(child)) {
      issues.push({ code: "UNSAFE_URL", path: childPath, message: "Only local paths and HTTP(S) URLs are allowed" });
    } else inspectUrls(child, childPath, issues);
  }
}

function collectNodes(section: SectionNode, path: string, ids: Set<string>, issues: V4StarterPackIssue[]): void {
  for (const node of [section, ...section.blocks]) {
    if (ids.has(node.id)) issues.push({ code: "DUPLICATE_NODE_ID", path, message: `Section/block id ${node.id} is not unique` });
    ids.add(node.id);
  }
  inspectUrls(section.settings, `${path}.settings`, issues);
  section.blocks.forEach((item, index) => inspectUrls(item.settings, `${path}.blocks[${index}].settings`, issues));
}

function validMenuTarget(target: unknown): boolean {
  if (!isRecord(target) || typeof target.kind !== "string") return false;
  if (target.kind === "home" || target.kind === "search") return Object.keys(target).length === 1;
  if (target.kind === "external") return typeof target.url === "string" && safeUrl(target.url);
  if (target.kind === "anchor") return typeof target.anchor === "string" && /^#[A-Za-z][A-Za-z0-9_:\-.]*$/.test(target.anchor);
  // Starter menus cannot point at a store-owned resource that may not exist yet.
  return false;
}

function visitMenu(items: unknown, path: string, issues: V4StarterPackIssue[]): void {
  if (!Array.isArray(items)) {
    issues.push({ code: "INVALID_MENU_TARGET", path, message: "Menu items must be an array" });
    return;
  }
  for (const [index, item] of items.entries()) {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || typeof item.label !== "string" || !item.label || !validMenuTarget(item.target)) {
      issues.push({ code: "INVALID_MENU_TARGET", path: itemPath, message: "Menu items require an id, label, safe target, and child list" });
      continue;
    }
    visitMenu(item.children, `${itemPath}.children`, issues);
  }
}

export function validateV4StarterPack(value: unknown): V4StarterPackIssue[] {
  const issues: V4StarterPackIssue[] = [];
  if (!isRecord(value)) return [{ code: "INVALID_STARTER", path: "$", message: "Starter pack must be an object" }];
  const pack = value as unknown as V4StarterPack;

  if (!supportedThemes.has(pack.id) || pack.theme?.themeId !== pack.id || !themeVersionPattern.test(pack.version ?? "")) {
    issues.push({ code: "INVALID_THEME", path: "theme", message: "Starter theme identity and semantic version must be supported" });
  }
  if (!isRecord(pack.theme?.settings)) issues.push({ code: "INVALID_THEME", path: "theme.settings", message: "Theme settings must be an object" });

  const seenKeys = new Set<string>();
  const addKey = (key: unknown, path: string) => {
    if (typeof key !== "string" || key.length === 0) {
      issues.push({ code: "INVALID_KEY", path, message: "Pack-local key is required" });
    } else if (seenKeys.has(key)) {
      issues.push({ code: "DUPLICATE_KEY", path, message: `Pack-local key ${key} is duplicated` });
    } else seenKeys.add(key);
  };
  const templates = Array.isArray(pack.templates) ? pack.templates : [];
  if (!Array.isArray(pack.templates)) issues.push({ code: "MISSING_DEFAULT_TEMPLATE", path: "templates", message: "Templates must be an array" });
  const templateCounts = new Map<PageType, number>();
  const referencedGlobals = new Set<string>();
  const nodeIds = new Set<string>();
  for (const [index, template] of templates.entries()) {
    const path = `templates[${index}]`;
    addKey(template?.key, `${path}.key`);
    if (![...pageTypes, "checkout", "wishlist", "customer-login", "customer-register", "customer-recovery", "customer-account", "customer-orders", "customer-order", "customer-addresses", "order-success"].includes(template?.type) || template.handle !== "default") {
      issues.push({ code: "INVALID_TEMPLATE", path, message: "Starter templates require a supported page type and the default handle" });
      continue;
    }
    templateCounts.set(template.type, (templateCounts.get(template.type) ?? 0) + 1);
    if (!Array.isArray(template.layout?.sections)) {
      issues.push({ code: "INVALID_TEMPLATE", path: `${path}.layout.sections`, message: "Template section placements must be an array" });
      continue;
    }
    for (const [placementIndex, placement] of template.layout.sections.entries()) {
      const placementPath = `${path}.layout.sections[${placementIndex}]`;
      if (placement.kind === "global" && typeof placement.globalSectionId === "string") {
        referencedGlobals.add(placement.globalSectionId);
        continue;
      }
      if (placement.kind !== "inline" || !isSectionNode(placement.section)) {
        issues.push({ code: "INVALID_SECTION", path: placementPath, message: "Placement must be inline or reference a global section" });
        continue;
      }
      collectNodes(placement.section, placementPath, nodeIds, issues);
      const registryIssues = validateSectionAgainstRegistry(placement.section, template.type);
      if (registryIssues.length) issues.push({ code: "INVALID_SECTION", path: placementPath, message: registryIssues.map(({ message }) => message).join("; ") });
    }
  }
  for (const type of pageTypes) {
    const count = templateCounts.get(type) ?? 0;
    if (count === 0) issues.push({ code: "MISSING_DEFAULT_TEMPLATE", path: "templates", message: `Missing default ${type} template` });
    if (count > 1) issues.push({ code: "DUPLICATE_DEFAULT_TEMPLATE", path: "templates", message: `More than one default ${type} template` });
  }

  const globals = Array.isArray(pack.globalSections) ? pack.globalSections : [];
  if (!Array.isArray(pack.globalSections)) issues.push({ code: "MISSING_GLOBAL_SECTION", path: "globalSections", message: "Global sections must be an array" });
  const globalCounts = new Map<string, number>();
  const globalById = new Map<string, { key: string; section: SectionNode }>();
  const globalTypes: Record<string, { type: string; region: "header" | "footer" }> = {
    announcement: { type: "announcement-bar", region: "header" },
    header: { type: "header", region: "header" },
    footer: { type: "footer", region: "footer" },
  };
  const knownGlobalIds = new Set<string>();
  for (const [index, entry] of globals.entries()) {
    const path = `globalSections[${index}]`;
    addKey(entry?.key, `${path}.key`);
    globalCounts.set(entry?.key, (globalCounts.get(entry?.key) ?? 0) + 1);
    if (!globalKeys.includes(entry?.key)) {
      issues.push({ code: "INVALID_GLOBAL_SECTION", path, message: "Unsupported global section key" });
      continue;
    }
    const expected = globalTypes[entry.key];
    if (!isSectionNode(entry.section) || entry.section.type !== expected.type) {
      issues.push({ code: "INVALID_GLOBAL_SECTION", path: `${path}.section`, message: `${entry.key} global must use ${expected.type}` });
      continue;
    }
    knownGlobalIds.add(entry.section.id);
    globalById.set(entry.section.id, { key: entry.key, section: entry.section });
    collectNodes(entry.section, path, nodeIds, issues);
    const definition = getSectionDefinition(entry.section.type);
    if (!definition?.allowedRegions?.includes(expected.region) || definition.settingsSchema.safeParse(entry.section.settings).success === false) {
      issues.push({ code: "INVALID_GLOBAL_SECTION", path: `${path}.section`, message: `${entry.key} global section is invalid for its region` });
    }
    for (const item of entry.section.blocks) {
      const blockDefinition = getBlockDefinition(item.type);
      if (!definition?.allowedBlockTypes.includes(item.type) || !blockDefinition?.settingsSchema.safeParse(item.settings).success) {
        issues.push({ code: "INVALID_GLOBAL_SECTION", path: `${path}.section.blocks`, message: `${item.type} is not allowed or has invalid settings in ${entry.key}` });
      }
    }
  }
  for (const key of globalKeys) {
    if (globalCounts.get(key) !== 1) issues.push({ code: "MISSING_GLOBAL_SECTION", path: "globalSections", message: `Exactly one ${key} global section is required` });
  }
  for (const globalId of referencedGlobals) {
    if (!knownGlobalIds.has(globalId)) issues.push({ code: "MISSING_GLOBAL_REFERENCE", path: "templates", message: `Template references missing global section ${globalId}` });
  }
  for (const template of templates) {
    if (!Array.isArray(template.layout?.sections)) continue;
    const placements = template.layout.sections;
    const placedGlobalKeys = new Set(placements.flatMap((placement) => {
      if (placement.kind !== "global" || typeof placement.globalSectionId !== "string") return [];
      const found = globalById.get(placement.globalSectionId);
      if (!found) return [];
      const compatibilityIssues = validateSectionAgainstRegistry(found.section, template.type);
      if (compatibilityIssues.length) issues.push({ code: "INVALID_GLOBAL_SECTION", path: `templates.${template.key}`, message: `${found.key} is not compatible with ${template.type}` });
      return [found.key];
    }));
    if (!placedGlobalKeys.has("header") || !placedGlobalKeys.has("footer")) {
      issues.push({ code: "MISSING_GLOBAL_PLACEMENT", path: `templates.${template.key}`, message: "Every template must place the shared header and footer" });
    }
  }
  for (const entry of globals) {
    if (entry?.section && !referencedGlobals.has(entry.section.id)) issues.push({ code: "UNUSED_GLOBAL_SECTION", path: "globalSections", message: `Global section ${entry.section.id} is never placed` });
  }
  const placedKeys = new Set(globals.map(({ key }) => key));
  if (!placedKeys.has("header") || !placedKeys.has("footer")) {
    issues.push({ code: "MISSING_GLOBAL_SECTION", path: "globalSections", message: "Header and footer must be installed" });
  }

  const menus = Array.isArray(pack.menus) ? pack.menus : [];
  if (!Array.isArray(pack.menus) || menus.length !== 1 || menus[0]?.key !== "main" || menus[0]?.handle !== "main") {
    issues.push({ code: "INVALID_MENU", path: "menus", message: "Exactly one main menu is required" });
  }
  for (const [index, menu] of menus.entries()) {
    addKey(menu?.key, `menus[${index}].key`);
    visitMenu(menu?.items, `menus[${index}].items`, issues);
  }

  const resourceReferences = Array.isArray(pack.resourceReferences) ? pack.resourceReferences : [];
  if (!Array.isArray(pack.resourceReferences)) issues.push({ code: "INVALID_RESOURCE_REFERENCE", path: "resourceReferences", message: "Resource references must be an array" });
  for (const [index, reference] of resourceReferences.entries()) {
    const path = `resourceReferences[${index}]`;
    addKey(reference?.key, `${path}.key`);
    if (!resourceTypes.includes(reference?.resourceType) || reference.required !== false || reference.initialResourceId !== null) {
      issues.push({ code: "INVALID_RESOURCE_REFERENCE", path, message: "Starter resource references must be optional and unresolved" });
    }
  }
  return issues;
}
