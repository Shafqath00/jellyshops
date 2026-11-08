export interface OnboardingE2eTargetInput {
  projectRef?: string;
  authUrl?: string;
  databaseUrl?: string;
}

export interface OnboardingE2eTarget {
  projectRef: string;
  authUrl: string;
  databaseUrl: string;
}

export class OnboardingE2eTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnboardingE2eTargetError";
  }
}

export function resolveOnboardingE2eTarget(input: OnboardingE2eTargetInput): OnboardingE2eTarget {
  const projectRef = input.projectRef?.trim();
  if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new OnboardingE2eTargetError("Set JELLY_ONBOARDING_E2E_PROJECT_REF to the approved Supabase project reference.");
  }
  const authUrl = input.authUrl?.trim();
  const databaseUrl = input.databaseUrl?.trim();
  if (!authUrl || !databaseUrl) throw new OnboardingE2eTargetError("Supabase Auth and database targets must both be configured.");

  let authRef: string;
  let databaseRef: string;
  try {
    const authHost = new URL(authUrl).hostname;
    const database = new URL(databaseUrl);
    const username = decodeURIComponent(database.username);
    const authMatch = authHost.match(/^([a-z0-9]{20})\.supabase\.co$/);
    const databaseHostMatch = database.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
    const databaseUserMatch = username.match(/^postgres\.([a-z0-9]{20})$/);
    authRef = authMatch?.[1] ?? "";
    databaseRef = databaseHostMatch?.[1] ?? databaseUserMatch?.[1] ?? "";
  } catch {
    throw new OnboardingE2eTargetError("Supabase target configuration is not a valid remote URL.");
  }
  if (!authRef || !databaseRef || authRef !== projectRef || databaseRef !== projectRef) {
    throw new OnboardingE2eTargetError("The explicit onboarding project reference does not match both configured Supabase targets.");
  }
  return { projectRef, authUrl, databaseUrl };
}

export function assertOnboardingAccountMarker(appMetadata: unknown): void {
  const metadata = appMetadata && typeof appMetadata === "object" ? appMetadata as Record<string, unknown> : {};
  if (metadata.jelly_e2e_role !== "storeless-onboarding") {
    throw new OnboardingE2eTargetError("Refusing to use an Auth account without the dedicated onboarding test marker.");
  }
}

export function validateOnboardingEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("onboarding-e2e") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new OnboardingE2eTargetError("The onboarding E2E account email must be a valid dedicated onboarding-e2e address.");
  }
  return normalized;
}
