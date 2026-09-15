import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

export interface FirebaseTokenVerifier {
  verify(token: string): Promise<{
    uid: string;
    email?: string;
    emailVerified: boolean;
    name?: string;
  }>;
}

export class FirebaseAdminTokenVerifier implements FirebaseTokenVerifier {
  constructor(private readonly auth: Pick<Auth, "verifyIdToken">) {}

  async verify(token: string) {
    const decoded = await this.auth.verifyIdToken(token, true);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
      name: typeof decoded.name === "string" ? decoded.name : undefined,
    };
  }
}

const appName = "jellyshops-backend-auth";

function getFirebaseApp(projectId: string): App {
  const existing = getApps().find((app) => app.name === appName);
  return existing ?? initializeApp({ credential: applicationDefault(), projectId }, appName);
}

export function createFirebaseTokenVerifier(projectId: string): FirebaseTokenVerifier {
  return new FirebaseAdminTokenVerifier(getAuth(getFirebaseApp(projectId)));
}
