import { expect, it } from "vitest";
import { STORE_DESIGN_SCHEMA_VERSION } from "./index";

it("exposes the first Store Design schema version", () => {
  expect(STORE_DESIGN_SCHEMA_VERSION).toBe(1);
});
