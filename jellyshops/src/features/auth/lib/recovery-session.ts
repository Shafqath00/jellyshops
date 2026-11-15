import type { Session } from "@supabase/supabase-js";

const storageKey = "jellyshop:password-recovery";
const maxAge = 10 * 60_000;

function sessionIdentity(session: Session) {
  try {
    const payload = session.access_token.split(".")[1];
    const claims: { session_id?: unknown } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}

// Set only after Supabase confirms that the code came from a recovery flow.
// Supabase verifies the authenticated user before changing their password.
export function beginRecovery(session: Session): boolean {
  const id = sessionIdentity(session);
  if (!id) return false;
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ id, expires: Date.now() + maxAge }));
    return true;
  } catch {
    return false;
  }
}

export function hasRecoverySession(session: Session | null): boolean {
  if (!session) return false;
  try {
    const stored: { id: string; expires: number } = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    return Boolean(stored && stored.expires > Date.now() && stored.id === sessionIdentity(session));
  } catch {
    return false;
  }
}

export function endRecovery() {
  sessionStorage.removeItem(storageKey);
}
