import { expect, it } from "vitest";
import { copyMediaToR2, type CopySource, type CopyTarget } from "./copy-to-r2.js";

function memorySource(files: Record<string, string>): CopySource & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    async *listFiles() { for (const [key, body] of Object.entries(files)) yield { key, size: body.length }; },
    async open(key) { reads.push(key); return key in files ? Buffer.from(files[key]) : null; },
  };
}
function memoryTarget(start: Record<string, string> = {}): CopyTarget & { files: Map<string, Buffer> } {
  const files = new Map(Object.entries(start).map(([key, body]) => [key, Buffer.from(body)]));
  return { files, size: async (key) => files.get(key)?.length ?? null, write: async (key, contents) => { files.set(key, contents); } };
}

it("dry run counts what would be copied and writes nothing", async () => {
  const target = memoryTarget({ "s/a.png": "aaaa" });
  const result = await copyMediaToR2(memorySource({ "s/a.png": "aaaa", "s/b.png": "bb", "s/b.png.w320.webp": "c" }), target, { dryRun: true });
  expect(result).toEqual({ files: 3, bytes: 7, alreadyThere: 1, copied: 0, problems: [] });
  expect(target.files.size).toBe(1);
});

it("copies missing files, skips ones already there, and can be run again", async () => {
  const source = memorySource({ "s/a.png": "aaaa", "s/b.png": "bb" });
  const target = memoryTarget({ "s/a.png": "aaaa", "s/stale.png": "x" });
  expect(await copyMediaToR2(source, target, { dryRun: false })).toMatchObject({ copied: 1, alreadyThere: 1, problems: [] });
  expect(target.files.get("s/b.png")?.toString()).toBe("bb");
  expect(source.reads).toEqual(["s/b.png"]);
  expect(await copyMediaToR2(source, target, { dryRun: false })).toMatchObject({ copied: 0, alreadyThere: 2 });
});

it("copies again when the sizes differ, and reports files it cannot copy without stopping", async () => {
  const source: CopySource = {
    async *listFiles() { yield { key: "s/a.png", size: 4 }; yield { key: "s/gone.png", size: 3 }; yield { key: "s/c.png", size: 1 }; },
    open: async (key) => key === "s/gone.png" ? null : Buffer.from(key === "s/a.png" ? "aaaa" : "c"),
  };
  const target = memoryTarget({ "s/a.png": "a" });
  const result = await copyMediaToR2(source, target, { dryRun: false });
  expect(result.copied).toBe(2);
  expect(result.problems).toEqual(["s/gone.png: listed but could not be read"]);
  expect(target.files.get("s/a.png")?.toString()).toBe("aaaa");
});
