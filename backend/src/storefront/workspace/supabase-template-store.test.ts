import { describe, expect, it } from "vitest";
import { updateSupabaseTemplate } from "./supabase-template-store.js";

describe("Supabase storefront template writes", () => {
  it("updates the expected revision and advances the workspace generation atomically", async () => {
    const statements: Array<{ text: string; values?: unknown[] }> = [];
    const client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values });
        if (text.includes('UPDATE "StorefrontTemplate"')) {
          return { rows: [{ id: "home", storeId: "store-demo", revision: 2, type: "home", handle: "home", name: "Home page", layout: { sections: [] } }], rowCount: 1 };
        }
        if (text.includes('INSERT INTO "StorefrontWorkspace"')) return { rows: [{ generation: 8 }], rowCount: 1 };
        return { rows: [], rowCount: null };
      },
      release() {},
    };
    const pool = { async connect() { return client; } };

    const result = await updateSupabaseTemplate(pool, "store-demo", "home", 1, { layout: { sections: [] } });

    expect(result).toEqual({
      template: expect.objectContaining({ id: "home", revision: 2, layout: { sections: [] } }),
      generation: 8,
    });
    expect(statements.map(({ text }) => text.trim())).toEqual(expect.arrayContaining(["BEGIN", "COMMIT"]));
    expect(statements.find(({ text }) => text.includes('UPDATE "StorefrontTemplate"'))?.values).toEqual([
      "store-demo", "home", 1, null, null, JSON.stringify({ sections: [] }),
    ]);
  });
});
