import { describe, expect, it, vi } from "vitest";
import { FirebaseAdminTokenVerifier } from "./firebase-token-verifier.js";

describe("FirebaseAdminTokenVerifier", () => {
  it("verifies a client ID token with revocation checking enabled", async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      uid: "firebase-user",
      email: "person@example.test",
      email_verified: true,
      name: "Person",
    });
    const verifier = new FirebaseAdminTokenVerifier({ verifyIdToken });

    await expect(verifier.verify("client-id-token")).resolves.toEqual({
      uid: "firebase-user",
      email: "person@example.test",
      emailVerified: true,
      name: "Person",
    });
    expect(verifyIdToken).toHaveBeenCalledWith("client-id-token", true);
  });
});
