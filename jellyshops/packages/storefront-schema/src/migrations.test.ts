import { expect, it } from "vitest";
import { createDefaultStoreDesign } from "./defaults";
import { migrateStoreDesignDocument } from "./migrations";

it("returns a validated V1 document", () => {
  const document = createDefaultStoreDesign("playful");

  expect(migrateStoreDesignDocument(document)).toEqual(document);
});

it("rejects a document from a future schema version", () => {
  const document = { ...createDefaultStoreDesign(), schemaVersion: 2 };

  expect(() => migrateStoreDesignDocument(document)).toThrow("Unsupported Store Design schema version: 2");
});

it("rejects malformed documents", () => {
  expect(() => migrateStoreDesignDocument({ schemaVersion: 1 })).toThrow("Invalid Store Design document");
});
