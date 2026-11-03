import { validateThemeProject } from "@jelly/storefront-themes";
import { loadProject } from "./project.mjs";

/** Prints the same diagnostics Publish gives. Exit code 1 when there is an error. */
export async function validate(folder, flags = {}) {
  let project;
  try { project = loadProject(folder); } catch (error) { process.stderr.write(`${error.message}\n`); return 2; }
  const issues = validateThemeProject({ manifest: project.manifest, starter: project.starter, assetExists: project.assetExists });
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(issues, null, 2)}\n`);
    return errors.length ? 1 : 0;
  }
  for (const issue of [...errors, ...warnings]) process.stdout.write(`${issue.level === "error" ? "error  " : "warning"} ${issue.path}: ${issue.message}\n`);
  if (!issues.length) process.stdout.write(`${project.manifest.name} (${project.manifest.id}) is valid.\n`);
  else process.stdout.write(`\n${errors.length} error${errors.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.\n`);
  return errors.length ? 1 : 0;
}
