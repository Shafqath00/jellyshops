import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../http/errors.js";
import type { StorefrontRepository } from "./repository.js";
import { DefaultStorefrontService, type DocumentValidator } from "./service.js";

function setup() {
  const repository: StorefrontRepository<{ title: string }> = {
    getDraft: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
    getPublic: vi.fn(),
  };
  const validator: DocumentValidator<{ title: string }> = { parse: vi.fn() };
  const service = new DefaultStorefrontService(repository, validator, () => ({ title: "default" }));
  return { repository, validator, service };
}

describe("DefaultStorefrontService", () => {
  it("does not persist an invalid document", async () => {
    const { repository, validator, service } = setup();
    vi.mocked(validator.parse).mockImplementation(() => { throw new Error("invalid"); });

    await expect(service.saveDraft("store-a", 0, {})).rejects.toMatchObject<ApiError>({
      status: 422,
      code: "DOCUMENT_INVALID",
    });
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it("preserves a repository failure after successful validation", async () => {
    const { repository, validator, service } = setup();
    vi.mocked(validator.parse).mockReturnValue({ title: "valid" });
    vi.mocked(repository.saveDraft).mockRejectedValue(new Error("database unavailable"));

    await expect(service.saveDraft("store-a", 0, {})).rejects.toThrow("database unavailable");
  });
});
