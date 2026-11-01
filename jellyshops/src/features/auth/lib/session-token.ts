type SessionResult = {
  data: { session: { access_token: string; user: { id: string } } | null };
  error: unknown;
};
type SessionReader = {
  getSession(): Promise<SessionResult>;
  refreshSession(): Promise<SessionResult>;
};

/** Read fresh credentials without allowing an in-flight request to change accounts. */
export function createSessionTokenReader(auth: SessionReader, userId: string) {
  return async (refresh = false): Promise<string> => {
    const current = await auth.getSession();
    if (current.error || !current.data.session || current.data.session.user.id !== userId) {
      throw new Error("Your session has expired. Sign in again to continue.");
    }
    const result = refresh ? await auth.refreshSession() : current;
    if (result.error || !result.data.session || result.data.session.user.id !== userId) {
      throw new Error("Your session has expired. Sign in again to continue.");
    }
    return result.data.session.access_token;
  };
}
