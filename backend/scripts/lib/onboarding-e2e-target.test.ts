import { describe, expect, it } from "vitest";
import {
  assertOnboardingAccountMarker,
  resolveOnboardingE2eTarget,
  validateOnboardingEmail,
} from "./onboarding-e2e-target.js";

const ref = "abcdefghijklmnopqrst";
const input = {
  projectRef: ref,
  authUrl: `https://${ref}.supabase.co`,
  databaseUrl: `postgresql://postgres.${ref}:secret@aws-1-us-east-1.pooler.supabase.com:5432/postgres`,
};

describe("onboarding E2E target guard", () => {
  it("accepts only the explicit project matching both Auth and database targets", () => {
    expect(resolveOnboardingE2eTarget(input)).toMatchObject({ projectRef: ref });
    expect(() => resolveOnboardingE2eTarget({ ...input, projectRef: undefined })).toThrow(/Set JELLY_ONBOARDING_E2E_PROJECT_REF/);
    expect(() => resolveOnboardingE2eTarget({ ...input, authUrl: "http://127.0.0.1:54321" })).toThrow(/does not match both/);
    expect(() => resolveOnboardingE2eTarget({ ...input, databaseUrl: `postgresql://postgres.otherproject1234567:secret@aws-1-us-east-1.pooler.supabase.com:5432/postgres` })).toThrow(/does not match both/);
  });

  it("requires the dedicated marker and a dedicated email identifier", () => {
    expect(() => assertOnboardingAccountMarker({})).toThrow(/without the dedicated onboarding test marker/);
    expect(() => assertOnboardingAccountMarker({ jelly_e2e_role: "storeless-onboarding" })).not.toThrow();
    expect(validateOnboardingEmail("jelly-onboarding-e2e@example.test")).toBe("jelly-onboarding-e2e@example.test");
    expect(() => validateOnboardingEmail("merchant@example.test")).toThrow(/dedicated onboarding-e2e/);
  });
});
