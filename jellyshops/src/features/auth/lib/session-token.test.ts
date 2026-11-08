import { expect, it, vi } from "vitest";
import { createSessionTokenReader } from "./session-token";

const response = (token: string, userId = "merchant") => ({ data: { session: { access_token: token, user: { id: userId } } }, error: null });

it("reads the current session instead of a captured access token", async () => {
  const auth = { getSession: async () => response("current"), refreshSession: async () => response("refreshed") };
  const read = createSessionTokenReader(auth, "merchant");
  expect(await read()).toBe("current");
  expect(await read(true)).toBe("refreshed");
});

it("does not refresh or return a token after the signed-in merchant changes", async () => {
  const auth = { getSession: async () => response("other-token", "other"), refreshSession: vi.fn(async () => response("other-token", "other")) };
  await expect(createSessionTokenReader(auth, "merchant")(true)).rejects.toThrow(/sign in/i);
  expect(auth.refreshSession).not.toHaveBeenCalled();
});

it("rejects an ended session instead of falling back to the captured token", async () => {
  const auth = { getSession: async () => ({ data: { session: null }, error: null }), refreshSession: async () => response("refreshed") };
  await expect(createSessionTokenReader(auth, "merchant")()).rejects.toThrow(/sign in/i);
});
