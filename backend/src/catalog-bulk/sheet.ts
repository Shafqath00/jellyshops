import ExcelJS from "exceljs";
import Papa from "papaparse";
import { ApiError } from "../http/errors.js";
import type { CatalogCollection, CatalogProduct } from "../catalog/types.js";

/**
 * The spreadsheet format shared by product export, the import template and product import.
 * One row per variant; rows of one product share the Handle. See docs/plans/bulk-products.md.
 */
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_COLUMNS = 60;
export const MAX_EXPORT_PRODUCTS = 5000;
export const MAX_IMPORT_IMAGES = 10;

/** A photo already in this platform's files: "/api/public/media/<store>/<id>", with or without a site in front. Gives the store and file ids. */
export function storeMediaRef(text: string): { storeId: string; mediaId: string } | null {
  const match = /^(?:https?:\/\/[^/\s]+)?\/api\/public\/media\/([^/?#\s]+)\/([^/?#\s]+)(?:[?#].*)?$/.exec(text.trim());
  return match ? { storeId: decodeURIComponent(match[1]), mediaId: decodeURIComponent(match[2]) } : null;
}

/**
 * The product a photo file belongs to, going by its name: "OAK-BED-DBL.jpg", "oak-bed-frame_2.png" and
 * "oak-bed-frame (3).webp" give the keys to try, most exact first.
 */
export function photoKeys(fileName: string): string[] {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]{2,5}$/i, "").trim().toLowerCase();
  const keys = [base];
  let current = base;
  for (let round = 0; round < 3; round++) {
    const shorter = current.replace(/\s*\(\d{1,3}\)$/, "").replace(/[-_ ](?:\d{1,3}|front|back|side|main|detail|alt)$/, "").trim();
    if (!shorter || shorter === current) break;
    keys.push(shorter);
    current = shorter;
  }
  return [...new Set(keys.filter(Boolean))];
}

export type ColumnKey =
  | "handle" | "title" | "description" | "status" | "vendor" | "productType" | "collections" | "tags"
  | "option1Name" | "option1Value" | "option2Name" | "option2Value" | "option3Name" | "option3Value"
  | "sku" | "barcode" | "price" | "compareAtPrice" | "cost" | "stock" | "trackStock" | "weightGrams"
  | "seoTitle" | "seoDescription" | "imageUrls";

export interface SheetColumn {
  key: ColumnKey;
  /** The heading written to exports and templates. */
  label: string;
  level: "product" | "variant";
  /** Plain-language rules, for the "How to fill this in" sheet and the column matching screen. */
  help: string;
  example: string;
  mistake: string;
  /** Other headings that mean the same thing, compared after `normaliseHeader`. */
  aliases: string[];
  /** False for columns that are written on export but not read on import. */
  imported: boolean;
}

export const SHEET_COLUMNS: SheetColumn[] = [
  { key: "handle", label: "Handle", level: "product", imported: true, aliases: ["url handle", "slug", "web address ending", "product handle"], example: "oak-bed-frame", help: "The last part of the product's web address. Lowercase letters, numbers and hyphens. Rows with the same handle are one product. Leave empty on a new product to make it from the title.", mistake: "Spaces or capitals (Oak Bed). Use oak-bed." },
  { key: "title", label: "Title", level: "product", imported: true, aliases: ["name", "product name", "product title"], example: "Oak bed frame", help: "The product's name. Needed for a new product. Up to 255 characters.", mistake: "Leaving it empty on the first row of a new product." },
  { key: "description", label: "Description", level: "product", imported: true, aliases: ["body", "body html", "details", "product description"], example: "Solid oak frame with a slatted base.", help: "Plain text. Replaces the product's description, including any formatting.", mistake: "Pasting web page code. Use plain sentences." },
  { key: "status", label: "Status", level: "product", imported: true, aliases: ["product status", "published"], example: "active", help: "active, draft or archived. New products are draft unless you say otherwise.", mistake: "Other words such as live or hidden." },
  { key: "vendor", label: "Brand", level: "product", imported: true, aliases: ["vendor", "supplier", "brand or supplier", "manufacturer"], example: "Harbour", help: "The brand or supplier. Up to 160 characters.", mistake: "Spelling one brand two ways (Harbour, harbour ltd)." },
  { key: "productType", label: "Type", level: "product", imported: true, aliases: ["product type", "category type"], example: "Beds", help: "What kind of product it is. Up to 160 characters.", mistake: "Using it for tags. One type per product." },
  { key: "collections", label: "Collections", level: "product", imported: true, aliases: ["collection", "collection names"], example: "Bedroom; Sale", help: "Names of collections that already exist in your store, separated by a semicolon (;).", mistake: "A collection that is not in your store yet. Create it first." },
  { key: "tags", label: "Tags", level: "product", imported: true, aliases: ["tag", "labels", "keywords"], example: "oak, bedroom", help: "Separated by commas. Up to 50 tags.", mistake: "Separating with semicolons." },
  { key: "option1Name", label: "Option 1 name", level: "variant", imported: true, aliases: ["option1 name", "option 1"], example: "Size", help: "The first choice shoppers make, such as Size. Leave all option columns empty for a product with no choices.", mistake: "Different names on rows of one product (Size, Sizes)." },
  { key: "option1Value", label: "Option 1 value", level: "variant", imported: true, aliases: ["option1 value"], example: "Double", help: "This row's value for option 1.", mistake: "Leaving it empty on some rows of a product that has the option." },
  { key: "option2Name", label: "Option 2 name", level: "variant", imported: true, aliases: ["option2 name", "option 2"], example: "Colour", help: "A second choice, if the product has one.", mistake: "Using option 2 without option 1." },
  { key: "option2Value", label: "Option 2 value", level: "variant", imported: true, aliases: ["option2 value"], example: "Natural", help: "This row's value for option 2.", mistake: "The same Size and Colour on two rows." },
  { key: "option3Name", label: "Option 3 name", level: "variant", imported: true, aliases: ["option3 name", "option 3"], example: "Storage", help: "A third choice, if the product has one. Three is the most.", mistake: "More than three options." },
  { key: "option3Value", label: "Option 3 value", level: "variant", imported: true, aliases: ["option3 value"], example: "With storage", help: "This row's value for option 3.", mistake: "Leaving it empty on some rows." },
  { key: "sku", label: "SKU", level: "variant", imported: true, aliases: ["variant sku", "stock code", "stock code sku", "item code"], example: "OAK-BED-DBL", help: "Your own stock code. Used to find the item again when you import. Must be different for every item in your store.", mistake: "The same code on two rows." },
  { key: "barcode", label: "Barcode", level: "variant", imported: true, aliases: ["variant barcode", "gtin", "upc", "ean", "isbn"], example: "5012345678900", help: "The number under the barcode on the packaging.", mistake: "Spreadsheets turning it into 5.01E+12. Format the column as text." },
  { key: "price", label: "Price", level: "variant", imported: true, aliases: ["variant price", "selling price", "retail price"], example: "499.00", help: "What shoppers pay. Needed for a new item. Numbers such as 499 or 499.50.", mistake: "Words (call us) or a negative number." },
  { key: "compareAtPrice", label: "Compare-at price", level: "variant", imported: true, aliases: ["variant compare at price", "compare at price", "original price", "was price", "price before discount", "rrp"], example: "599.00", help: "The price before a discount, shown crossed out. Leave empty if it is not on sale.", mistake: "A compare-at price lower than the price." },
  { key: "cost", label: "Cost", level: "variant", imported: true, aliases: ["cost per item", "cost price", "unit cost"], example: "250.00", help: "What the item costs you. Only you see it.", mistake: "Putting the selling price here." },
  { key: "stock", label: "Stock", level: "variant", imported: true, aliases: ["quantity", "inventory", "variant inventory qty", "inventory quantity", "qty", "stock quantity", "on hand"], example: "12", help: "How many you have. A whole number, 0 or more. Leave empty to leave stock as it is.", mistake: "Decimals (2.5) or words (plenty)." },
  { key: "trackStock", label: "Track stock", level: "variant", imported: true, aliases: ["track inventory", "track quantity", "inventory tracked"], example: "yes", help: "yes or no. Say no for made-to-order items that never run out.", mistake: "Other words. Use yes or no." },
  { key: "weightGrams", label: "Weight (g)", level: "variant", imported: true, aliases: ["weight", "weight g", "variant grams", "grams", "weight grams"], example: "42000", help: "Packed weight in whole grams (1 kg = 1000).", mistake: "Kilograms (42) instead of grams (42000)." },
  { key: "seoTitle", label: "SEO title", level: "product", imported: true, aliases: ["search title", "title in search results", "meta title", "page title"], example: "Oak bed frame | Harbour", help: "The title shown in search results. Up to 70 characters.", mistake: "Longer than 70 characters." },
  { key: "seoDescription", label: "SEO description", level: "product", imported: true, aliases: ["search description", "description in search results", "meta description"], example: "A solid oak bed frame, made in the UK.", help: "The description shown in search results. Up to 160 characters.", mistake: "Longer than 160 characters." },
  { key: "imageUrls", label: "Image URLs", level: "product", imported: true, aliases: ["images", "image src", "image url", "image", "photos", "photo urls"], example: "https://example.com/bed-front.jpg; https://example.com/bed-side.jpg", help: "Web addresses of the product's photos, separated by a semicolon (;). Each must start with https:// and open without signing in. Up to 10 per product in one import, 8 MB each. Photos are added to the ones the product already has; none are removed.", mistake: "A link to a web page or a private folder (Google Drive, Dropbox) instead of the picture itself." },
];

export const columnByKey = new Map(SHEET_COLUMNS.map((column) => [column.key, column]));

/** "Variant  SKU*" and "variant_sku" are the same heading. */
export function normaliseHeader(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export type ColumnMapping = Partial<Record<ColumnKey, number>>;

/** Suggests which file column feeds each of our columns. A file column is used once; exact names win over aliases. */
export function suggestMapping(headers: string[]): ColumnMapping {
  const names = headers.map(normaliseHeader);
  const mapping: ColumnMapping = {};
  const taken = new Set<number>();
  const claim = (key: ColumnKey, candidates: string[]) => {
    if (mapping[key] !== undefined) return;
    const index = names.findIndex((name, position) => !taken.has(position) && name !== "" && candidates.includes(name));
    if (index >= 0) { mapping[key] = index; taken.add(index); }
  };
  for (const column of SHEET_COLUMNS) claim(column.key, [normaliseHeader(column.label), normaliseHeader(column.key)]);
  for (const column of SHEET_COLUMNS) claim(column.key, column.aliases.map(normaliseHeader));
  return mapping;
}

/** A mapping from the browser: known keys, whole numbers inside the file, each file column used once. */
export function cleanMapping(input: unknown, columnCount: number): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  if (!input || typeof input !== "object") return mapping;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!columnByKey.has(key as ColumnKey) || typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= columnCount || used.has(value)) continue;
    mapping[key as ColumnKey] = value;
    used.add(value);
  }
  return mapping;
}

// ---- Cells

const FORMULA_START = /^[=+\-@\t\r]/;

/** Spreadsheets run a cell that starts with = + - or @ as a formula; a leading apostrophe makes it plain text. */
export function guardCell(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

/** Undoes `guardCell`, so an exported file imports unchanged. */
export function unguardCell(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };
const fail = (reason: string): Parsed<never> => ({ ok: false, reason });

/** "£1,299.50", "1299,5" (decimal comma), "499" to minor units. Empty is null. */
export function parseMoney(text: string): Parsed<number | null> {
  let value = text.trim();
  if (!value) return { ok: true, value: null };
  value = value.replace(/^(?:[£$€₹]|gbp|usd|eur|inr)\s*/i, "").replace(/\s*(?:[£$€₹]|gbp|usd|eur|inr)$/i, "").replace(/\s/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(value)) value = value.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(value)) value = value.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return fail("is not a price. Use a number such as 499 or 499.50");
  const minor = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(minor) || minor > 2_000_000_000) return fail("is too large");
  return { ok: true, value: minor };
}

/** A whole number, 0 or more. "12", "12.0", "1,200". Empty is null. */
export function parseWholeNumber(text: string, max = 1_000_000_000): Parsed<number | null> {
  let value = text.trim();
  if (!value) return { ok: true, value: null };
  if (/^\d{1,3}(,\d{3})+$/.test(value)) value = value.replace(/,/g, "");
  value = value.replace(/\.0+$/, "");
  if (!/^\d+$/.test(value)) return fail("must be a whole number, 0 or more");
  const number = Number(value);
  if (number > max) return fail("is too large");
  return { ok: true, value: number };
}

export function parseYesNo(text: string): Parsed<boolean | null> {
  const value = text.trim().toLowerCase();
  if (!value) return { ok: true, value: null };
  if (["yes", "y", "true", "1", "on"].includes(value)) return { ok: true, value: true };
  if (["no", "n", "false", "0", "off"].includes(value)) return { ok: true, value: false };
  return fail("must be yes or no");
}

export function parseStatus(text: string): Parsed<"ACTIVE" | "DRAFT" | "ARCHIVED" | null> {
  const value = text.trim().toLowerCase();
  if (!value) return { ok: true, value: null };
  if (["active", "published", "live"].includes(value)) return { ok: true, value: "ACTIVE" };
  if (["draft", "unpublished"].includes(value)) return { ok: true, value: "DRAFT" };
  if (value === "archived") return { ok: true, value: "ARCHIVED" };
  return fail("must be active, draft or archived");
}

/** Splits "a; b ;; c" into ["a", "b", "c"], dropping repeats that differ only by case. */
export function parseList(text: string, separator: string): string[] {
  const seen = new Set<string>();
  return text.split(separator).map((item) => item.trim()).filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** "Oak Bed Frame (King)" to "oak-bed-frame-king". */
export function slugify(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200);
}

export const formatMoney = (minor: number | null | undefined) => minor == null ? "" : (minor / 100).toFixed(2);

// ---- Reading files

export interface ParsedSheet { headers: string[]; rows: string[][] }

function tidy(table: string[][]): ParsedSheet {
  const cleaned = table.map((row) => row.slice(0, MAX_IMPORT_COLUMNS).map((cell) => unguardCell(String(cell ?? "").replace(/\u0000/g, "").trim())));
  const headerIndex = cleaned.findIndex((row) => row.some((cell) => cell !== ""));
  if (headerIndex < 0) throw new ApiError(422, "IMPORT_EMPTY", "This file is empty. Add a header row and at least one product.");
  const headers = cleaned[headerIndex];
  while (headers.length && headers[headers.length - 1] === "") headers.pop();
  const rows = cleaned.slice(headerIndex + 1).filter((row) => row.some((cell) => cell !== "")).map((row) => headers.map((_, index) => (row[index] ?? "").slice(0, 20000)));
  if (!rows.length) throw new ApiError(422, "IMPORT_EMPTY", "This file has headings but no products. Add at least one row under the headings.");
  if (rows.length > MAX_IMPORT_ROWS) throw new ApiError(422, "IMPORT_TOO_MANY_ROWS", `This file has ${rows.length.toLocaleString("en-GB")} rows. The most in one import is ${MAX_IMPORT_ROWS.toLocaleString("en-GB")}. Split it into smaller files.`);
  return { headers, rows };
}

/** CSV with or without a BOM; comma, semicolon or tab separated (detected); quoted cells may hold line breaks. */
export function parseCsv(buffer: Buffer): ParsedSheet {
  let text = buffer.toString("utf8");
  // A file saved as UTF-16 by a spreadsheet program starts with FF FE.
  if (buffer[0] === 0xff && buffer[1] === 0xfe) text = buffer.toString("utf16le");
  text = text.replace(/^﻿/, "");
  const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy", delimitersToGuess: [",", ";", "\t", "|"] });
  const fatal = result.errors.find((error) => error.type === "Quotes");
  if (fatal && !result.data.length) throw new ApiError(422, "IMPORT_UNREADABLE", "We could not read this file. Save it again as CSV (comma separated) and try once more.");
  return tidy(result.data as string[][]);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const cell = value as { result?: unknown; text?: unknown; richText?: Array<{ text: string }>; error?: unknown; hyperlink?: unknown };
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text).join("");
    if (cell.result !== undefined) return cellText(cell.result as ExcelJS.CellValue);
    if (typeof cell.text === "string") return cell.text;
    return "";
  }
  // 499.5 stays "499.5"; 5012345678900 stays whole instead of 5.0123e12.
  return typeof value === "number" ? (Number.isInteger(value) ? value.toFixed(0) : String(value)) : String(value);
}

/** The first sheet of an .xlsx file. Formulas are read as their last result; nothing is run. */
export async function parseXlsx(buffer: Buffer): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as unknown as ArrayBuffer); }
  catch { throw new ApiError(422, "IMPORT_UNREADABLE", "We could not open this Excel file. Check it is an .xlsx file, or save it as CSV and try again."); }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ApiError(422, "IMPORT_EMPTY", "This Excel file has no sheets.");
  if (sheet.actualRowCount > MAX_IMPORT_ROWS + 50) throw new ApiError(422, "IMPORT_TOO_MANY_ROWS", `This file has ${sheet.actualRowCount.toLocaleString("en-GB")} rows. The most in one import is ${MAX_IMPORT_ROWS.toLocaleString("en-GB")}. Split it into smaller files.`);
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    const width = Math.min(row.cellCount, MAX_IMPORT_COLUMNS);
    for (let column = 1; column <= width; column++) cells.push(cellText(row.getCell(column).value));
    table.push(cells);
  });
  return tidy(table);
}

export async function parseSheetFile(fileName: string, buffer: Buffer): Promise<ParsedSheet & { format: "csv" | "xlsx" }> {
  if (buffer.length > MAX_IMPORT_BYTES) throw new ApiError(413, "IMPORT_TOO_LARGE", "This file is larger than 5 MB. Split it into smaller files.");
  // .xlsx files are zip archives and start with "PK".
  const zipped = buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (/\.xls$/i.test(fileName) && !zipped) throw new ApiError(422, "IMPORT_UNREADABLE", "Old Excel files (.xls) cannot be read. Save the file as .xlsx or CSV and try again.");
  return zipped ? { ...(await parseXlsx(buffer)), format: "xlsx" } : { ...parseCsv(buffer), format: "csv" };
}

// ---- Writing files

export function toCsv(table: string[][]): string {
  const cell = (value: string) => `"${guardCell(value).replaceAll('"', '""')}"`;
  // The BOM tells Excel the file is UTF-8, so £ and accents survive.
  return "﻿" + table.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export async function toXlsx(table: string[][], options: { sheetName: string; guide?: boolean }): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Jelly Shops";
  const sheet = workbook.addWorksheet(options.sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  table.forEach((row, index) => {
    const added = sheet.addRow(row.map(guardCell));
    // Every cell is text, so barcodes and SKUs such as 00123 keep their digits.
    added.eachCell({ includeEmpty: true }, (cell) => { cell.numFmt = "@"; });
    if (index === 0) added.font = { bold: true };
  });
  sheet.columns.forEach((column, index) => { column.width = Math.min(48, Math.max(12, (table[0]?.[index]?.length ?? 10) + 4)); });
  if (options.guide) {
    const guide = workbook.addWorksheet("How to fill this in");
    guide.addRow(["Column", "What to put in it", "Example", "Common mistake"]).font = { bold: true };
    for (const column of SHEET_COLUMNS) guide.addRow([column.label, column.help, column.example, column.mistake]);
    guide.addRow([]);
    for (const line of [
      "One row is one item you sell. A product with sizes or colours has one row per combination; those rows share the same Handle and sit next to each other.",
      "Product columns (Title, Description, Brand, Type, Collections, Tags, Status, SEO) are read from the product's first row.",
      "To change products you already have, export them first, edit the file and import it again. Items are found by their SKU, or by Handle and option values.",
      "A column you delete from the file is left alone in your store. An empty cell in a column you keep clears that value where it can be cleared.",
      "Nothing is saved until you have seen the preview and confirmed.",
    ]) guide.addRow([line]);
    guide.columns = [{ width: 22 }, { width: 90 }, { width: 34 }, { width: 60 }];
    guide.eachRow((row) => { row.alignment = { wrapText: true, vertical: "top" }; });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export const headerRow = () => SHEET_COLUMNS.map((column) => column.label);

/** Header and three example rows: a simple product, and one with two sizes. */
export function templateTable(): string[][] {
  const row = (values: Partial<Record<ColumnKey, string>>) => SHEET_COLUMNS.map((column) => values[column.key] ?? "");
  return [
    headerRow(),
    row({ handle: "linen-tote-bag", title: "Linen tote bag", description: "A roomy everyday bag in washed linen.", status: "draft", vendor: "Harbour", productType: "Bags", collections: "", tags: "linen, gift", sku: "TOTE-01", price: "24.00", compareAtPrice: "", cost: "9.50", stock: "40", trackStock: "yes", weightGrams: "300", seoTitle: "Linen tote bag", seoDescription: "A roomy everyday bag in washed linen." }),
    row({ handle: "oak-bed-frame", title: "Oak bed frame", description: "Solid oak frame with a slatted base.", status: "draft", vendor: "Harbour", productType: "Beds", tags: "oak, bedroom", option1Name: "Size", option1Value: "Double", sku: "OAK-BED-DBL", price: "499.00", compareAtPrice: "599.00", cost: "250.00", stock: "6", trackStock: "yes", weightGrams: "42000" }),
    row({ handle: "oak-bed-frame", option1Name: "Size", option1Value: "King", sku: "OAK-BED-KNG", price: "579.00", compareAtPrice: "679.00", cost: "290.00", stock: "4", trackStock: "yes", weightGrams: "48000" }),
  ];
}

interface OptionLike { id: string; name: string; type?: string; values?: Array<{ id: string; label: string }> }

/** The choices whose combinations are separate variants, in the product's order (three at most reach the file). */
export function variantOptionsOf(product: Pick<CatalogProduct, "options" | "inventoryOptionIds">): OptionLike[] {
  const options = (product.options as OptionLike[]).filter((option) => option && typeof option.id === "string");
  return product.inventoryOptionIds.map((id) => options.find((option) => option.id === id)).filter((option): option is OptionLike => Boolean(option)).slice(0, 3);
}

/** One product as sheet rows, in template order. Product columns are filled on the first row only. */
export function productToRows(product: CatalogProduct, collections: Map<string, CatalogCollection>): string[][] {
  const axes = variantOptionsOf(product);
  const variants = product.variants.length ? product.variants : [null];
  return variants.map((variant, index) => {
    const first = index === 0;
    const values: Partial<Record<ColumnKey, string>> = {
      handle: product.handle,
      title: first ? product.title : "",
      description: first ? product.description : "",
      status: first ? product.status.toLowerCase() : "",
      vendor: first ? product.vendor ?? "" : "",
      productType: first ? product.productType ?? "" : "",
      collections: first ? product.collectionIds.map((id) => collections.get(id)?.title).filter(Boolean).join("; ") : "",
      tags: first ? product.tags.join(", ") : "",
      seoTitle: first ? product.seoTitle ?? "" : "",
      seoDescription: first ? product.seoDescription ?? "" : "",
      imageUrls: first ? product.media.map((media) => media.url).join("; ") : "",
    };
    if (variant) {
      axes.forEach((option, position) => {
        const valueId = String((variant.options as Record<string, unknown>)[option.id] ?? "");
        const label = option.values?.find((value) => value.id === valueId)?.label ?? valueId;
        values[`option${position + 1}Name` as ColumnKey] = option.name;
        values[`option${position + 1}Value` as ColumnKey] = label;
      });
      Object.assign(values, {
        sku: variant.sku ?? "", barcode: variant.barcode ?? "", price: formatMoney(variant.priceMinor), compareAtPrice: formatMoney(variant.compareAtPriceMinor),
        cost: formatMoney(variant.costMinor), stock: variant.trackInventory && variant.quantity != null ? String(variant.quantity) : "",
        trackStock: variant.trackInventory ? "yes" : "no", weightGrams: variant.weightGrams != null ? String(variant.weightGrams) : "",
      });
    }
    return SHEET_COLUMNS.map((column) => values[column.key] ?? "");
  });
}
