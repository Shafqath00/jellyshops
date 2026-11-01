// Inventory source paths only; intentionally excludes environment/credential files.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../../..');
const paths = execFileSync('rg', ['--files', 'backend/src', 'backend/sql', 'backend/supabase/migrations', 'backend/test', 'jellyshops/src', 'jellyshops/packages', 'jellyshops/e2e', '.github/workflows'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean).sort();
const records = paths.map(file => {
  const bytes = readFileSync(path.join(root, file));
  return { path: file.replaceAll('\\', '/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
writeFileSync(path.join(import.meta.dirname, 'source-inventory.json'), JSON.stringify({
  capturedAt: new Date().toISOString(),
  baselineHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  note: 'Working-tree source inventory, not a claim every file was read or tested individually. Secrets and env files excluded. Original user changes preserved.',
  counts: { files: records.length, frontendPages: records.filter(r => /^jellyshops\/src\/app\/.+\/page\.tsx$/.test(r.path) || r.path === 'jellyshops/src/app/page.tsx').length, backendMigrationFiles: records.filter(r => /^backend\/sql\/migrations\/.+\.sql$/.test(r.path)).length },
  files: records,
}, null, 2) + '\n');
console.log(`Inventoried ${records.length} source/test/schema files; no env files.`);
