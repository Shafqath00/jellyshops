import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("does not expose a selectable SQL repository provider", () => {
    const config = loadConfig({ NODE_ENV: "test" });

    expect(config).not.toHaveProperty("repositoryProvider");
  });
});
