import { describe, expect, it } from "vitest";
import {
  assertExpectedRevision,
  nextRevision,
} from "./concurrency.js";
import { ResourceRevisionConflictError } from "./errors.js";

describe("storefront workspace concurrency rules", () => {
  it("accepts the exact current resource revision", () => {
    expect(() => assertExpectedRevision(7, 7)).not.toThrow();
  });

  it("rejects a stale resource revision with the current revision", () => {
    expect(() => assertExpectedRevision(7, 6)).toThrowError(
      expect.objectContaining<ResourceRevisionConflictError>({ currentRevision: 7 }),
    );
  });

  it("increments nonnegative revisions one step at a time", () => {
    expect(nextRevision(0)).toBe(1);
    expect(nextRevision(7)).toBe(8);
  });

  it("rejects invalid or overflowing revisions", () => {
    expect(() => nextRevision(-1)).toThrow(/revision/i);
    expect(() => nextRevision(2_147_483_647)).toThrow(/limit/i);
  });
});
