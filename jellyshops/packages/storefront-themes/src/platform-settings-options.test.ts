import { expect, it } from "vitest";
import { platformSettingsSchema } from "./platform-settings";

// The theme manifest check (run when the backend starts) refuses a select choice with an empty value; catch it here.
it("gives every select choice in the platform settings a non-empty value", () => {
  const schema = platformSettingsSchema() as Array<{ id: string; type: string; options?: Array<{ value: string }> }>;
  for (const setting of schema.filter((entry) => entry.type === "select")) {
    for (const option of setting.options ?? []) expect(option.value, setting.id).not.toBe("");
  }
});
