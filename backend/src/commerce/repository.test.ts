import { describe, expect, it, vi } from "vitest";
import { CommerceRepository, postgresCommerceDatabase } from "./repository.js";

// The pool is the external boundary; SQL/data behavior is tested against PGlite.
function poolFixture(failCommit = false) {
  const statements: { sql: string; values?: unknown[] }[] = [];
  const release = vi.fn();
  const client = {
    async query(sql: string, values?: unknown[]) {
      statements.push({ sql, values });
      if (failCommit && sql === "COMMIT") throw new Error("commit failed");
      return { rows: [] };
    },
    release,
  };
  return { pool: { connect: async () => client }, statements, release };
}

describe("commerce PostgreSQL transactions", () => {
  it("locks a tenant/cart key on the same connection before work and commits", async () => {
    const fixture = poolFixture();
    const repository = new CommerceRepository(postgresCommerceDatabase(fixture.pool));
    const value = await repository.withCheckoutLock("store", "cart", async (tx) => {
      await tx.query("SELECT $1", ["work"]);
      return 42;
    });
    expect(value).toBe(42);
    expect(fixture.statements).toEqual([
      { sql: "BEGIN" },
      { sql: "SELECT pg_advisory_xact_lock(hashtext($1))", values: ['["store","cart"]'] },
      { sql: "SELECT $1", values: ["work"] },
      { sql: "COMMIT" },
    ]);
    expect(fixture.release).toHaveBeenCalledOnce();
  });

  it("rolls back failed work and releases its connection", async () => {
    const fixture = poolFixture();
    const database = postgresCommerceDatabase(fixture.pool);
    await expect(database.transaction(async () => { throw new Error("work failed"); })).rejects.toThrow("work failed");
    expect(fixture.statements.map(({ sql }) => sql)).toEqual(["BEGIN", "ROLLBACK"]);
    expect(fixture.release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases after a commit failure", async () => {
    const fixture = poolFixture(true);
    await expect(postgresCommerceDatabase(fixture.pool).transaction(async () => 1)).rejects.toThrow("commit failed");
    expect(fixture.statements.map(({ sql }) => sql)).toEqual(["BEGIN", "COMMIT", "ROLLBACK"]);
    expect(fixture.release).toHaveBeenCalledOnce();
  });
});
