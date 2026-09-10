import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalJsonStorefrontRepository } from "./local-json-repository.js";

const validDocument = {
  schemaVersion: 2,
  storeId: "store-demo",
  template: "home",
  regions: { header: [], template: [], footer: [] },
};

describe("local JSON storefront repository", () => {
  it("survives repository recreation and rejects a stale revision", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "jelly-storefront-"));
    const first = new LocalJsonStorefrontRepository(directory);

    await first.saveDraft("store-demo", 0, validDocument);

    const second = new LocalJsonStorefrontRepository(directory);
    await expect(second.getDraft("store-demo")).resolves.toMatchObject({ revision: 1 });
    await expect(second.saveDraft("store-demo", 0, validDocument)).rejects.toMatchObject({
      code: "DRAFT_CONFLICT",
      currentRevision: 1,
    });
  });
});
