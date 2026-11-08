import { ApiError, type ApiIssue } from "../http/errors.js";
import type { MetafieldDefinitionRecord } from "./repository.js";
import { valueProblem } from "./value-rules.js";

export type OwnerType = MetafieldDefinitionRecord["ownerType"];

export interface OwnerValue { ownerId: string; definitionId: string; value: unknown }

/** What the service needs from storage; SqlCustomDataRepository implements it. */
export interface OwnerValuesStore {
  ownerExists(storeId: string, type: OwnerType, id: string): Promise<boolean>;
  listDefinitionsByIds(storeId: string, ownerType: OwnerType, ids: string[]): Promise<MetafieldDefinitionRecord[]>;
  listOwnerValues(storeId: string, ownerType: OwnerType, ownerIds: string[]): Promise<OwnerValue[]>;
  replaceOwnerValues(storeId: string, ownerId: string, upserts: Array<{ definitionId: string; value: unknown }>, deletes: string[]): Promise<void>;
}

const MAX_OWNERS = 200;
const MAX_VALUES = 200;

/**
 * The custom field values of products, variants and other things, edited together from one screen.
 * A save is checked as a whole and applied as a whole: every problem is reported at once and nothing is stored
 * unless every value is valid.
 */
export class OwnerMetafieldService {
  constructor(private readonly store: OwnerValuesStore) {}

  async list(storeId: string, ownerType: OwnerType, ownerIds: string[]): Promise<OwnerValue[]> {
    const ids = [...new Set(ownerIds)];
    if (ids.length === 0) return [];
    if (ids.length > MAX_OWNERS) throw new ApiError(422, "METAFIELD_OWNERS_LIMIT", `Ask for at most ${MAX_OWNERS} items at once.`);
    return this.store.listOwnerValues(storeId, ownerType, ids);
  }

  /** `null` clears a value; anything else must suit the field's type and rules. */
  async save(storeId: string, ownerType: OwnerType, ownerId: string, values: Record<string, unknown>): Promise<{ saved: number; cleared: number }> {
    const entries = Object.entries(values);
    if (entries.length > MAX_VALUES) throw new ApiError(422, "METAFIELD_VALUES_LIMIT", `Save at most ${MAX_VALUES} fields at once.`);
    if (!await this.store.ownerExists(storeId, ownerType, ownerId)) throw new ApiError(404, "METAFIELD_OWNER_NOT_FOUND", "That item does not belong to this store.");

    const definitions = new Map((await this.store.listDefinitionsByIds(storeId, ownerType, entries.map(([id]) => id))).map((definition) => [definition.id, definition]));
    const issues: ApiIssue[] = [];
    const upserts: Array<{ definitionId: string; value: unknown }> = [];
    const deletes: string[] = [];
    for (const [definitionId, value] of entries) {
      const definition = definitions.get(definitionId);
      if (!definition) { issues.push({ path: definitionId, message: "This custom field no longer exists." }); continue; }
      if (value === null) { deletes.push(definitionId); continue; }
      const problem = valueProblem(definition.type, value, definition.validations as Record<string, unknown> | null);
      if (problem) issues.push({ path: definitionId, message: `${definition.name}: ${problem}` });
      else upserts.push({ definitionId, value });
    }
    if (issues.length > 0) throw new ApiError(422, "METAFIELD_INVALID", issues.length === 1 ? issues[0].message : `${issues.length} custom fields need attention.`, issues);

    await this.store.replaceOwnerValues(storeId, ownerId, upserts, deletes);
    return { saved: upserts.length, cleared: deletes.length };
  }
}
