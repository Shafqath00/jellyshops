import { Router } from "express";
import type { MetaobjectDefinitionRecord, MetaobjectEntryRecord } from "./repository.js";

/**
 * Metaobject entries shoppers may see: only definitions and fields marked
 * "visible on the storefront", never archived ones, and only plain values
 * (text, numbers, dates, colours, links and images). Each entry can have its
 * own page at /<store>/pages/<definition>/<entry>.
 */
export interface PublicMetaobjectField { handle: string; name: string; type: string }
export interface PublicMetaobjectEntry { handle: string; displayName: string; values: Record<string, string | number | boolean> }
export interface PublicMetaobjectList { definition: { handle: string; name: string; fields: PublicMetaobjectField[] }; entries: PublicMetaobjectEntry[] }

export interface PublicMetaobjectSource {
  listDefinitions(storeId: string): Promise<MetaobjectDefinitionRecord[]>;
  listEntries(storeId: string, definitionId: string): Promise<MetaobjectEntryRecord[]>;
}

const SHOWN_TYPES = new Set(["string", "text", "rich_text", "boolean", "integer", "decimal", "money", "color", "url", "date", "datetime", "image"]);
export const MAX_PUBLIC_METAOBJECT_ENTRIES = 100;

function imageUrl(storeId: string, value: unknown): string | null {
  const raw = value && typeof value === "object" ? (value as { url?: unknown; id?: unknown }).url ?? (value as { id?: unknown }).id : value;
  if (typeof raw !== "string" || !raw.trim()) return null;
  if (/^https:\/\//i.test(raw) || raw.startsWith("/api/public/media/")) return raw;
  return /^[\w-]{1,100}$/.test(raw) ? `/api/public/media/${encodeURIComponent(storeId)}/${encodeURIComponent(raw)}` : null;
}

function publicValue(storeId: string, type: string, value: unknown): string | number | boolean | null {
  if (type === "image") return imageUrl(storeId, value);
  if (type === "url") return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null;
  if (type === "boolean") return typeof value === "boolean" ? value : null;
  if (["integer", "decimal"].includes(type)) return typeof value === "number" && Number.isFinite(value) ? value : null;
  if (type === "money" && value && typeof value === "object") {
    const { amount, currency } = value as { amount?: unknown; currency?: unknown };
    return typeof amount === "number" ? `${amount}${typeof currency === "string" ? ` ${currency}` : ""}` : null;
  }
  return typeof value === "string" || typeof value === "number" ? value : null;
}

export class PublicMetaobjectService {
  constructor(private readonly source: PublicMetaobjectSource) {}

  async list(storeId: string, definitionHandle: string): Promise<PublicMetaobjectList | null> {
    const definition = (await this.source.listDefinitions(storeId)).find((item) => item.handle === definitionHandle && item.storefrontVisible && !item.archivedAt);
    if (!definition) return null;
    const fields = definition.fields.filter((field) => field.storefrontVisible && SHOWN_TYPES.has(field.type)).map(({ handle, name, type }) => ({ handle, name, type }));
    const entries = (await this.source.listEntries(storeId, definition.id))
      .filter((entry) => !entry.archivedAt)
      .slice(0, MAX_PUBLIC_METAOBJECT_ENTRIES)
      .map((entry) => ({
        handle: entry.handle,
        displayName: entry.displayName,
        values: Object.fromEntries(fields.flatMap((field) => {
          const value = publicValue(storeId, field.type, entry.values[field.handle]);
          return value === null ? [] : [[field.handle, value]];
        })),
      }));
    return { definition: { handle: definition.handle, name: definition.name, fields }, entries };
  }
}

/** `GET /api/public/stores/:storeId/storefront/metaobjects/:handle[/:entryHandle]` */
export function createPublicMetaobjectRouter(service: Pick<PublicMetaobjectService, "list">): Router {
  const router = Router({ mergeParams: true });
  router.get<{ storeId: string; handle: string }>("/:handle", async (request, response, next) => {
    try {
      const list = await service.list(String(request.params.storeId), String(request.params.handle));
      if (!list) { response.status(404).json({ error: "Not found" }); return; }
      response.set("Cache-Control", "public, max-age=60").json(list);
    } catch (error) { next(error); }
  });
  router.get<{ storeId: string; handle: string; entryHandle: string }>("/:handle/:entryHandle", async (request, response, next) => {
    try {
      const list = await service.list(String(request.params.storeId), String(request.params.handle));
      const entry = list?.entries.find((item) => item.handle === request.params.entryHandle);
      if (!list || !entry) { response.status(404).json({ error: "Not found" }); return; }
      response.set("Cache-Control", "public, max-age=60").json({ definition: list.definition, entry });
    } catch (error) { next(error); }
  });
  return router;
}
