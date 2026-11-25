import { describe, expect, it } from "vitest";
import { emailClaimKey, normaliseEmail } from "./trial-claims.js";

describe("normalising emails for trial claims", () => {
  it("ignores case, spaces and +tags", () => {
    expect(normaliseEmail("  Sam+shop2@Example.co.uk ")).toBe("sam@example.co.uk");
  });
  it("ignores Gmail dots and reads googlemail.com as gmail.com", () => {
    expect(normaliseEmail("s.a.m+x@googlemail.com")).toBe("sam@gmail.com");
    expect(normaliseEmail("S.am@gmail.com")).toBe("sam@gmail.com");
  });
  it("keeps dots for other providers", () => {
    expect(normaliseEmail("s.am@example.com")).toBe("s.am@example.com");
  });
  it("leaves odd values alone instead of guessing", () => {
    expect(normaliseEmail("+@x")).toBe("+@x");
    expect(normaliseEmail("no-at-sign")).toBe("no-at-sign");
  });
  it("stores only a hash", () => {
    expect(emailClaimKey("Sam+1@gmail.com")).toBe(emailClaimKey("s.a.m@googlemail.com"));
    expect(emailClaimKey("sam@gmail.com")).toMatch(/^[0-9a-f]{64}$/);
  });
});
