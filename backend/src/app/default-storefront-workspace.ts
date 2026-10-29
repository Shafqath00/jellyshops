import type { GlobalSettings, SectionNode, StorefrontDocument, ThemeId } from "@jelly/storefront-schema";
import { listThemes, resolveTheme, validateThemeSettings } from "@jelly/storefront-themes";
import { ApiError } from "../http/errors.js";
import { createDefaultStorefrontDocument } from "../storefront/document-validator.js";
import { type StorefrontWorkspaceApi } from "../storefront/workspace/routes.js";
import { writeSqlGlobalSection } from "../storefront/workspace/sql-global-section-store.js";
import { updateSupabaseTemplate } from "../storefront/workspace/supabase-template-store.js";
import { toStorefrontTemplateEnumValue } from "../storefront/workspace/template-type-enum.js";
import { supabasePool } from "./database.js";

const defaultHomeTemplate = {
  id: "home",
  storeId: "store-sweet-bakes",
  revision: 1,
  type: "home" as const,
  handle: "home",
  name: "Home page",

  layout: {
    sections: [
      {
        kind: "inline",
        section: {
          id: "welcome",
          type: "hero",
          enabled: true,
          settings: {},
          blocks: [
            {
              id: "welcome-heading",
              type: "heading",
              enabled: true,
              settings: {
                text: "Welcome",
              },
            },
          ],
        },
      },
    ],
  },

  createdAt: new Date(0),
  updatedAt: new Date(0),
};

function asRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function asThemeId(
  value: unknown,
): ThemeId | undefined {
  const themes: ThemeId[] = [
    "minimal",
    "classic",
    "bold",
    "elegant",
    "playful",
    "fresh-market",
    "artisan-boutique",
  ];

  return themes.includes(value as ThemeId)
    ? (value as ThemeId)
    : undefined;
}

function asSection(
  value: unknown,
): SectionNode | undefined {
  const candidate = asRecord(value);

  if (!candidate) {
    return undefined;
  }

  const valid =
    typeof candidate.id === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.enabled === "boolean" &&
    Boolean(asRecord(candidate.settings)) &&
    Array.isArray(candidate.blocks);

  if (!valid) {
    return undefined;
  }

  return candidate as unknown as SectionNode;
}

export function publicDocumentFromTemplate(
  storeId: string,
  layout: unknown,
): StorefrontDocument {
  const source = asRecord(layout);
  const sourceTheme = asRecord(source?.theme);

  const selectedTheme =
    asThemeId(sourceTheme?.id) ?? "minimal";

  const fallback =
    createDefaultStorefrontDocument(
      storeId,
      selectedTheme,
    );

  const settings = asRecord(
    sourceTheme?.settings,
  ) as GlobalSettings | undefined;

  const inlineSections =
    Array.isArray(source?.sections)
      ? source.sections.flatMap(
        (placement) => {
          const item =
            asRecord(placement);

          if (item?.kind !== "inline") {
            return [];
          }

          const parsed =
            asSection(item.section);

          return parsed
            ? [parsed]
            : [];
        },
      )
      : [];

  const templateSections =
    inlineSections.length > 0
      ? inlineSections
      : fallback.regions.template;

  return {
    ...fallback,

    theme: {
      presetId: selectedTheme,
      settings:
        settings ??
        fallback.theme.settings,
    },

    regions: {
      ...fallback.regions,
      template: templateSections,
    },

    pages: fallback.pages.map(
      (page) =>
        page.type === "home"
          ? {
            ...page,
            sections:
              templateSections,
          }
          : page,
    ),
  };
}

export const defaultStorefrontWorkspaceApi: StorefrontWorkspaceApi = {
  async listThemeCatalog() {
    return listThemes().map((theme) => {
      const manifest = theme.manifest as { id: string; name: string; version: string; description: string; enabled: boolean; layout: string; previewAsset?: string; assets?: { preview?: { path?: string } }; settingsSchema?: unknown[] };
      return { id: manifest.id, name: manifest.name, version: manifest.version, description: manifest.description, previewAsset: manifest.assets?.preview?.path ?? manifest.previewAsset, available: manifest.enabled, layout: manifest.layout, settingsSchema: manifest.settingsSchema ?? [] };
    });
  },
  async getWorkspace(storeId) {
    if (!supabasePool) {
      return {
        generation: 0,
        updatedAt: new Date(0),
      };
    }

    const result =
      await supabasePool.query(
        `
          SELECT
            "generation",
            "updatedAt"
          FROM "StorefrontWorkspace"
          WHERE "storeId" = $1
        `,
        [storeId],
      );

    return (
      result.rows[0] ?? {
        generation: 0,
        updatedAt: new Date(0),
      }
    );
  },

  async listTemplates(storeId, type) {
    if (!supabasePool) {
      return [defaultHomeTemplate];
    }

    const result =
      await supabasePool.query(
        `
          SELECT
            "id",
            "storeId",
            "revision",
            replace(lower("type"::text), '_', '-') AS "type",
            "handle",
            "name",
            "layout",
            "createdAt",
            "updatedAt"
          FROM "StorefrontTemplate"
          WHERE "storeId" = $1
            AND ($2::text IS NULL OR replace(lower("type"::text), '_', '-') = $2)
          ORDER BY "createdAt"
        `,
        [storeId, type ?? null],
      );

    return result.rows;
  },

  async getTemplate(
    storeId,
    templateId,
  ) {
    if (!supabasePool) {
      return templateId ===
        defaultHomeTemplate.id
        ? defaultHomeTemplate
        : null;
    }

    const result =
      await supabasePool.query(
        `
          SELECT
            "id",
            "storeId",
            "revision",
            replace(lower("type"::text), '_', '-') AS "type",
            "handle",
            "name",
            "layout",
            "createdAt",
            "updatedAt"
          FROM "StorefrontTemplate"
          WHERE "storeId" = $1
            AND "id" = $2
        `,
        [storeId, templateId],
      );

    return result.rows[0] ?? null;
  },

  async createTemplate(
    storeId,
    input,
  ) {
    if (!supabasePool) {
      return {
        template: {
          id: `template-${crypto.randomUUID()}`,
          storeId,
          revision: 0,
          type: input.type,
          handle: input.handle ?? "default",
          name: input.name,
          layout: input.layout,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        generation: 1,
      };
    }

    const client = await supabasePool.connect();
    try {
      await client.query("BEGIN");
      const templateId = `template-${crypto.randomUUID()}`;
      const inserted = await client.query(
        `INSERT INTO "StorefrontTemplate" ("id", "storeId", "type", "handle", "name", "layout", "revision", "createdAt", "updatedAt")
         VALUES ($1, $2, $3::"StorefrontTemplateType", $4, $5, $6::jsonb, 0, NOW(), NOW())
         RETURNING "id", "storeId", "revision", replace(lower("type"::text), '_', '-') AS "type", "handle", "name", "layout", "createdAt", "updatedAt"`,
        [templateId, storeId, toStorefrontTemplateEnumValue(input.type), input.handle ?? "default", input.name, JSON.stringify(input.layout)],
      );
      const workspace = await client.query(
        `INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt")
         VALUES ($1, 1, NOW())
         ON CONFLICT ("storeId") DO UPDATE
         SET "generation" = "StorefrontWorkspace"."generation" + 1, "updatedAt" = NOW()
         RETURNING "generation"`,
        [storeId],
      );
      await client.query("COMMIT");
      return { template: inserted.rows[0], generation: Number(workspace.rows[0]?.generation ?? 1) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async updateTemplate(
    storeId,
    templateId,
    revision,
    patch,
  ) {
    if (supabasePool) {
      return updateSupabaseTemplate(
        supabasePool,
        storeId,
        templateId,
        revision,
        patch,
      );
    }

    return {
      template: {
        ...defaultHomeTemplate,
        id: templateId,
        revision: revision + 1,
        ...patch,
        updatedAt: new Date(),
      },
      generation: 1,
    };
  },

  async cloneTemplate(
    _storeId,
    templateId,
    input,
  ) {
    return {
      id: templateId,
      ...input,
    };
  },

  async listGlobalSections(
    storeId,
  ) {
    if (!supabasePool) {
      return [];
    }

    const result =
      await supabasePool.query(
        `
          SELECT
            "id",
            "storeId",
            "revision",
            "name",
            "section",
            "createdAt",
            "updatedAt"
          FROM "GlobalSection"
          WHERE "storeId" = $1
          ORDER BY "createdAt"
        `,
        [storeId],
      );

    return result.rows;
  },

  async getGlobalSection() {
    return null;
  },

  async createGlobalSection(
    storeId,
    input,
  ) {
    if (supabasePool) return writeSqlGlobalSection(supabasePool, storeId, null, null, input);
    return input;
  },

  async updateGlobalSection(
    storeId,
    id,
    revision,
    patch,
  ) {
    if (supabasePool) return writeSqlGlobalSection(supabasePool, storeId, id, revision, patch);
    return {
      id,
      ...patch,
    };
  },

  async listPresets(storeId) {
    if (!supabasePool) {
      return [];
    }

    const result =
      await supabasePool.query(
        `
          SELECT
            "id",
            "storeId",
            "revision",
            "name",
            "section",
            "createdAt",
            "updatedAt"
          FROM "SectionPreset"
          WHERE "storeId" = $1
          ORDER BY "createdAt"
        `,
        [storeId],
      );

    return result.rows;
  },

  async createPreset(
    _storeId,
    input,
  ) {
    return input;
  },

  async instantiatePreset() {
    return {};
  },

  async listMenus() {
    return [];
  },

  async getMenu() {
    return null;
  },

  async createMenu(
    _storeId,
    input,
  ) {
    return input;
  },

  async updateMenu(
    _storeId,
    id,
    _revision,
    patch,
  ) {
    return {
      id,
      ...patch,
    };
  },

  async getThemeConfiguration(storeId) {
    if (!supabasePool) return null;
    const result = await supabasePool.query(
      `SELECT "storeId", "revision", "themeId", "themeVersion", "settings", "draftArtifactId", "updatedAt"
       FROM "ThemeConfiguration" WHERE "storeId" = $1`,
      [storeId],
    );
    return result.rows[0] ?? null;
  },

  async saveThemeConfiguration(
    storeId,
    revision,
    input,
  ) {
    const resolved = resolveTheme(input.themeId, input.settings, input.themeVersion);
    if (resolved.fallbackReason) throw new ApiError(422, "THEME_UNAVAILABLE", `Theme '${input.themeId}' is unavailable`);
    const issues = validateThemeSettings(resolved.id, input.settings);
    if (issues.length) throw new ApiError(422, "THEME_SETTINGS_INVALID", "Theme settings are invalid", issues);
    const savedInput = { ...input, themeId: resolved.id, themeVersion: resolved.version, settings: resolved.settings };
    if (!supabasePool) {
      return { theme: { storeId, revision: revision === null ? 0 : revision + 1, themeId: savedInput.themeId, themeVersion: savedInput.themeVersion, settings: savedInput.settings, draftArtifactId: savedInput.draftArtifactId ?? null, updatedAt: new Date() }, generation: 1 };
    }
    const client = await supabasePool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(`SELECT "revision" FROM "ThemeConfiguration" WHERE "storeId" = $1 FOR UPDATE`, [storeId]);
      const currentRevision = current.rows[0] ? Number(current.rows[0].revision) : null;
      if (currentRevision !== revision) throw new ApiError(409, "STOREFRONT_REVISION_CONFLICT", "Theme settings were changed by another editor");
      const saved = await client.query(
        `INSERT INTO "ThemeConfiguration" ("storeId", "revision", "themeId", "themeVersion", "settings", "draftArtifactId", "updatedAt")
         VALUES ($1, 0, $2, $3, $4::jsonb, $5, NOW())
         ON CONFLICT ("storeId") DO UPDATE SET "revision" = "ThemeConfiguration"."revision" + 1, "themeId" = EXCLUDED."themeId", "themeVersion" = EXCLUDED."themeVersion", "settings" = EXCLUDED."settings", "draftArtifactId" = EXCLUDED."draftArtifactId", "updatedAt" = NOW()
         RETURNING "storeId", "revision", "themeId", "themeVersion", "settings", "draftArtifactId", "updatedAt"`,
        [storeId, savedInput.themeId, savedInput.themeVersion, JSON.stringify(savedInput.settings), savedInput.draftArtifactId ?? null],
      );
      const workspace = await client.query(
        `INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt") VALUES ($1, 1, NOW())
         ON CONFLICT ("storeId") DO UPDATE SET "generation" = "StorefrontWorkspace"."generation" + 1, "updatedAt" = NOW() RETURNING "generation"`, [storeId],
      );
      await client.query("COMMIT");
      return { theme: saved.rows[0], generation: Number(workspace.rows[0]?.generation ?? 1) };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  },

  async deleteTemplate() {
    throw new ApiError(501, "NOT_SUPPORTED", "Deleting templates needs the storefront database.");
  },

  async getAssignment() {
    return null;
  },

  async removeAssignment() {
    throw new ApiError(501, "NOT_SUPPORTED", "Removing template assignments needs the storefront database.");
  },

  async assignTemplate(
    _storeId,
    input,
  ) {
    return input;
  },
};
