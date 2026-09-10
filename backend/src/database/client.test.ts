import { describe, expect, it } from "vitest";
import { createDatabase } from "./client.js";

describe("createDatabase", () => {
  it("rejects a non-PostgreSQL connection URL", () => {
    expect(() => createDatabase("https://example.test/database")).toThrow(
      "Database URL must use PostgreSQL",
    );
  });

  it("requires TLS for a remote database", () => {
    expect(() =>
      createDatabase("postgresql://runtime:secret@db.example.test:5432/postgres"),
    ).toThrow("Remote database connections must require TLS");
  });

  it("allows repeat-safe cleanup before a connection is opened", async () => {
    const database = createDatabase("postgresql://localhost:5432/jellyshops_test");

    await database.close();
    await expect(database.close()).resolves.toBeUndefined();
  });

  it("rejects an unsafe PostgreSQL schema identifier", () => {
    expect(() =>
      createDatabase("postgresql://localhost:5432/jellyshops_test", {
        schema: "public; DROP SCHEMA public",
      }),
    ).toThrow("Database schema name is invalid");
  });
});
