/**
 * One quoted CSV cell. A value that starts with = + - @ (or a tab or carriage return) would run as a
 * formula when the file is opened in a spreadsheet, so it gets a leading apostrophe, which
 * spreadsheets read as "this is text". Use it for every CSV the admin writes.
 */
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
