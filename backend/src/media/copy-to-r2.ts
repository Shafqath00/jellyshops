/**
 * Copies every stored file from the old media store (Supabase Storage) to Cloudflare R2, key for key.
 * Never deletes or changes anything in the source; a file already in R2 with the same size is skipped, so the copy can
 * be run again safely. Writes nothing to the database.
 */
export interface CopySource {
  listFiles(): AsyncIterable<{ key: string; size: number | null }>;
  open(key: string): Promise<Buffer | null>;
}
export interface CopyTarget {
  size(key: string): Promise<number | null>;
  write(key: string, contents: Buffer, mimeType?: string): Promise<void>;
}
export interface CopyResult { files: number; bytes: number; alreadyThere: number; copied: number; problems: string[] }

export async function copyMediaToR2(source: CopySource, target: CopyTarget, options: { dryRun: boolean }): Promise<CopyResult> {
  const result: CopyResult = { files: 0, bytes: 0, alreadyThere: 0, copied: 0, problems: [] };
  for await (const file of source.listFiles()) {
    result.files += 1;
    result.bytes += file.size ?? 0;
    try {
      const existing = await target.size(file.key);
      if (existing !== null && (file.size === null || existing === file.size)) { result.alreadyThere += 1; continue; }
      if (options.dryRun) continue;
      const contents = await source.open(file.key);
      if (!contents) { result.problems.push(`${file.key}: listed but could not be read`); continue; }
      await target.write(file.key, contents);
      const written = await target.size(file.key);
      if (written !== contents.length) { result.problems.push(`${file.key}: size after copy is ${written}, expected ${contents.length}`); continue; }
      result.copied += 1;
    } catch (error) {
      result.problems.push(`${file.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}
