import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAdminQuery } from "./use-admin-query";

describe("useAdminQuery", () => {
  it("exposes retryable error state without synthetic data", async () => {
    const { result } = renderHook(() => useAdminQuery("summary:store-a", async () => { throw new Error("Network unavailable"); }));
    await waitFor(() => expect(result.current.error?.message).toBe("Network unavailable"));
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });
});
