import { z } from "zod";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { compareThemeVersions, themeVersionSchema } from "./versioning.js";

const settingPath = z.string().max(200).regex(/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*$/)
  .refine((path) => !path.split(".").some((key) => ["__proto__", "prototype", "constructor"].includes(key)), "Setting paths cannot contain prototype keys.");
// Saved SectionNode/BlockNode type names are opaque strings, not setting paths.
const nodeType = z.string().min(1);
const target = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("theme") }).strict(),
  z.object({ scope: z.literal("section"), type: nodeType }).strict(),
  z.object({ scope: z.literal("block"), type: nodeType }).strict(),
]);
const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("renameSetting"), target, from: settingPath, to: settingPath }).strict().refine((op) => op.from !== op.to && !op.to.startsWith(`${op.from}.`) && !op.from.startsWith(`${op.to}.`), "Rename paths must be distinct and cannot contain one another."),
  z.object({ op: z.literal("setDefault"), target, key: settingPath, value: z.json() }).strict(),
  z.object({ op: z.literal("removeSetting"), target, key: settingPath }).strict(),
  z.object({ op: z.literal("renameSectionType"), from: nodeType, to: nodeType }).strict(),
  z.object({ op: z.literal("renameBlockType"), from: nodeType, to: nodeType }).strict(),
]);

export const themeMigrationSchema = z.object({
  from: themeVersionSchema,
  to: themeVersionSchema,
  operations: z.array(operationSchema).max(200),
}).strict().refine((migration) => !themeVersionSchema.safeParse(migration.from).success || !themeVersionSchema.safeParse(migration.to).success || compareThemeVersions(migration.from, migration.to) < 0, "A migration must lead to a newer version.");
export type ThemeMigration = z.infer<typeof themeMigrationSchema>;

/** Gather all global and inline draft sections here. References, ids and unrelated fields survive. */
export interface ThemeMigrationDraft { settings: Record<string, unknown>; sections: SectionNode[] }
export type ThemeMigrationChange = { path: string } & (
  { kind: "added"; after: unknown } | { kind: "removed"; before: unknown } | { kind: "changed"; before: unknown; after: unknown }
);

/** Exact version edges; never guess at a missing/ambiguous route or run a downgrade. */
export function getThemeMigrationPath(from: string, to: string, input: unknown): ThemeMigration[] {
  themeVersionSchema.parse(from); themeVersionSchema.parse(to);
  if (compareThemeVersions(from, to) > 0) throw new Error("A theme upgrade must lead to a newer version.");
  const migrations = z.array(themeMigrationSchema).max(100).parse(input);
  for (let i = 0; i < migrations.length; i++) {
    if (migrations.slice(i + 1).some((step) => compareThemeVersions(step.from, migrations[i].from) === 0)) throw new Error(`Ambiguous migration from ${migrations[i].from}. Keep one route per source version.`);
  }
  const path: ThemeMigration[] = [];
  let current = from;
  while (compareThemeVersions(current, to) < 0) {
    const next = migrations.find((step) => compareThemeVersions(step.from, current) === 0 && compareThemeVersions(step.to, to) <= 0);
    if (!next) throw new Error(`No migration from ${current} to ${to}. Add a complete upgrade path.`);
    path.push(next); current = next.to;
  }
  return path;
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
function parentAt(settings: Record<string, unknown>, path: string, create: boolean): { parent: Record<string, unknown>; key: string } | null {
  const parts = path.split(".");
  let parent = settings;
  for (const part of parts.slice(0, -1)) {
    if (!Object.hasOwn(parent, part)) {
      if (!create) return null;
      parent[part] = {};
    }
    const child = parent[part];
    if (!object(child)) throw new Error(`Cannot migrate ${path}: ${part} is not an object.`);
    parent = child;
  }
  return { parent, key: parts[parts.length - 1] };
}

/** Dry run only: clone the draft and return the changed values for a future confirmation screen. */
export function applyThemeMigrations(source: ThemeMigrationDraft, from: string, to: string, migrations: unknown): { draft: ThemeMigrationDraft; changes: ThemeMigrationChange[] } {
  const steps = getThemeMigrationPath(from, to, migrations);
  const draft = structuredClone(source);
  const changes: ThemeMigrationChange[] = [];
  const settingsOperation = (settings: Record<string, unknown>, path: string, op: Extract<z.infer<typeof operationSchema>, { target: unknown }>) => {
    const key = op.op === "renameSetting" ? op.from : op.key;
    const source = parentAt(settings, key, false);
    const exists = source !== null && Object.hasOwn(source.parent, source.key);
    if (op.op === "setDefault") {
      if (exists) return;
      const dest = parentAt(settings, key, true)!;
      dest.parent[dest.key] = structuredClone(op.value);
      changes.push({ path: `${path}.${key}`, kind: "added", after: structuredClone(op.value) });
    } else {
      if (!exists || !source) return;
      const before = structuredClone(source.parent[source.key]);
      if (op.op === "renameSetting") {
        const dest = parentAt(settings, op.to, true)!;
        if (Object.hasOwn(dest.parent, dest.key)) throw new Error(`Cannot rename ${path}.${key}: ${op.to} already exists.`);
        dest.parent[dest.key] = structuredClone(before);
      }
      delete source.parent[source.key];
      changes.push({ path: `${path}.${key}`, kind: "removed", before });
      if (op.op === "renameSetting") changes.push({ path: `${path}.${op.to}`, kind: "added", after: structuredClone(before) });
    }
  };
  for (const step of steps) for (const op of step.operations) {
    if ("target" in op && op.target.scope === "theme") { settingsOperation(draft.settings, "settings", op); continue; }
    const visit = (node: SectionNode | BlockNode, path: string, scope: "section" | "block") => {
      if ((op.op === "renameSectionType" && scope === "section" || op.op === "renameBlockType" && scope === "block") && node.type === op.from) {
        changes.push({ path: `${path}.type`, kind: "changed", before: node.type, after: op.to });
        node.type = op.to;
      } else if ("target" in op && op.target.scope === scope && "type" in op.target && op.target.type === node.type) {
        settingsOperation(node.settings, `${path}.settings`, op);
        if (op.op !== "setDefault") for (const device of ["mobile", "tablet"] as const) {
          const overrides = node.responsive?.[device];
          if (overrides) settingsOperation(overrides, `${path}.responsive.${device}`, op);
        }
      }
      node.blocks?.forEach((child, index) => visit(child, `${path}.blocks[${index}]`, "block"));
    };
    draft.sections.forEach((section, index) => visit(section, `sections[${index}]`, "section"));
  }
  return { draft, changes };
}

const majorOf = (version: string) => Number(version.split(".")[0]);

/**
 * The migration steps a merchant upgrade runs. Steps are followed while they exist; a gap is allowed
 * only inside one major version, because the version rules let a minor or patch release add things
 * without saying how settings move. A gap across a major version is an error.
 */
export function getThemeUpgradePath(from: string, to: string, input: unknown): { steps: ThemeMigration[]; reached: string } {
  themeVersionSchema.parse(from); themeVersionSchema.parse(to);
  if (compareThemeVersions(from, to) >= 0) throw new Error("A theme upgrade must lead to a newer version.");
  const migrations = z.array(themeMigrationSchema).max(100).parse(input ?? []);
  const steps: ThemeMigration[] = [];
  let current = from;
  while (compareThemeVersions(current, to) < 0) {
    const next = migrations.find((step) => compareThemeVersions(step.from, current) === 0 && compareThemeVersions(step.to, to) <= 0);
    if (!next) {
      if (majorOf(current) === majorOf(to)) break;
      throw new Error(`Version ${to} has no upgrade path from ${current}. A new major version must say how settings move.`);
    }
    steps.push(next); current = next.to;
  }
  return { steps, reached: current };
}

/** Like applyThemeMigrations, for a merchant upgrade: runs the steps that exist (see getThemeUpgradePath). */
export function applyThemeUpgrade(source: ThemeMigrationDraft, from: string, to: string, migrations: unknown): { draft: ThemeMigrationDraft; changes: ThemeMigrationChange[] } {
  const { reached } = getThemeUpgradePath(from, to, migrations);
  if (compareThemeVersions(reached, from) === 0) return { draft: structuredClone(source), changes: [] };
  return applyThemeMigrations(source, from, reached, migrations);
}
