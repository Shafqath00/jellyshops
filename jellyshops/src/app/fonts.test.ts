import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { FONT_OPTIONS, fontStack } from "@jelly/storefront-themes";
import { SECTION_FONT_CHOICES } from "@jelly/storefront-registry";

const source = readFileSync(join(__dirname, "fonts.ts"), "utf8");

it("self-hosts every font the theme settings offer", () => {
  for (const { value } of FONT_OPTIONS) {
    const variable = /var\((--font-[a-z-]+)\)/.exec(fontStack(value, "Arial"))?.[1];
    if (value === "Georgia" || value === "Arial") expect(variable).toBeUndefined();
    else expect(source, `${value} needs ${variable} in src/app/fonts.ts`).toContain(`variable: "${variable}"`);
  }
});

it("only preloads the two default fonts", () => {
  expect(source.match(/preload: false/g)).toHaveLength(FONT_OPTIONS.length - 4);
});

it("offers the same fonts in section settings as in theme settings", () => {
  expect([...SECTION_FONT_CHOICES]).toEqual(FONT_OPTIONS.map((option) => option.value));
});
