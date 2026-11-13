import type { CatalogCollection, CatalogProduct, CatalogVariant, CatalogVariantInput, CreateProductInput, UpdateProductInput } from "../catalog/types.js";
import { columnByKey, parseList, parseMoney, parseStatus, parseWholeNumber, parseYesNo, slugify, variantOptionsOf, type ColumnKey, type ColumnMapping } from "./sheet.js";

/**
 * Decides what an import would do, without saving anything. Pure: it is given the rows, the column
 * matching, the mode and what the store already holds, and returns one plan per product.
 */
export type ImportMode = "create" | "update" | "upsert";
export type PlanAction = "create" | "update" | "skip" | "problem";

export interface PlanReason { row: number; column?: string; message: string }

export interface ProductPlan {
  /** File row numbers, counting the header as row 1. */
  rows: number[];
  handle: string;
  title: string;
  action: PlanAction;
  reasons: PlanReason[];
  variantCount: number;
  /** For an update: the columns the file would write. */
  columns: string[];
  create?: CreateProductInput;
  update?: { productId: string; input: UpdateProductInput };
}

export interface StoreSnapshot {
  /** Products the file might touch, by handle. */
  productsByHandle: Map<string, CatalogProduct>;
  /** Every SKU in the store (lower case) and the product that owns it. */
  skuOwners: Map<string, { productId: string; handle: string }>;
  collections: CatalogCollection[];
}

const MAX_VARIANTS = 100;
const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LIMITS: Partial<Record<ColumnKey, number>> = { title: 255, description: 20000, vendor: 160, productType: 160, sku: 120, barcode: 64, seoTitle: 70, seoDescription: 160, option1Name: 60, option2Name: 60, option3Name: 60, option1Value: 120, option2Value: 120, option3Value: 120 };
const label = (key: ColumnKey) => columnByKey.get(key)!.label;

interface Line { row: number; cells: string[] }

/** The handle each row belongs to, in file order. Rows without one continue the product above them. */
export function groupRows(rows: string[][], mapping: ColumnMapping, store: Pick<StoreSnapshot, "skuOwners">): { groups: Array<{ handle: string; lines: Line[] }>; orphans: Line[] } {
  const groups = new Map<string, { handle: string; lines: Line[] }>();
  const orphans: Line[] = [];
  let previous: string | undefined;
  const cell = (cells: string[], key: ColumnKey) => mapping[key] === undefined ? "" : (cells[mapping[key]!] ?? "").trim();
  rows.forEach((cells, index) => {
    const line = { row: index + 2, cells };
    const explicit = cell(cells, "handle");
    const sku = cell(cells, "sku").toLowerCase();
    const handle = explicit ? explicit.toLowerCase() : (sku && store.skuOwners.get(sku)?.handle) || slugify(cell(cells, "title")) || previous;
    if (!handle) { orphans.push(line); return; }
    previous = handle;
    if (!groups.has(handle)) groups.set(handle, { handle, lines: [] });
    groups.get(handle)!.lines.push(line);
  });
  return { groups: [...groups.values()], orphans };
}

/** Handles and SKUs the file mentions, so the caller can load just those products. */
export function referencedKeys(rows: string[][], mapping: ColumnMapping): { handles: string[]; skus: string[] } {
  const handles = new Set<string>(), skus = new Set<string>();
  for (const cells of rows) {
    const handle = mapping.handle === undefined ? "" : (cells[mapping.handle] ?? "").trim().toLowerCase();
    const title = mapping.title === undefined ? "" : (cells[mapping.title] ?? "").trim();
    const sku = mapping.sku === undefined ? "" : (cells[mapping.sku] ?? "").trim().toLowerCase();
    if (handle) handles.add(handle); else if (title) handles.add(slugify(title));
    if (sku) skus.add(sku);
  }
  return { handles: [...handles].filter(Boolean), skus: [...skus] };
}

export function planImport(rows: string[][], mapping: ColumnMapping, mode: ImportMode, store: StoreSnapshot): ProductPlan[] {
  const { groups, orphans } = groupRows(rows, mapping, store);
  const mapped = (key: ColumnKey) => mapping[key] !== undefined;
  const cellOf = (line: Line, key: ColumnKey) => mapped(key) ? (line.cells[mapping[key]!] ?? "").trim() : "";

  // The same SKU on two rows of the file is always a mistake.
  const skuRows = new Map<string, number>();
  const repeatedSku = new Map<number, number>();
  for (const group of groups) for (const line of group.lines) {
    const sku = cellOf(line, "sku").toLowerCase();
    if (!sku) continue;
    if (skuRows.has(sku)) repeatedSku.set(line.row, skuRows.get(sku)!); else skuRows.set(sku, line.row);
  }

  const collectionByName = new Map<string, CatalogCollection>();
  for (const collection of store.collections) { collectionByName.set(collection.title.trim().toLowerCase(), collection); collectionByName.set(collection.handle.toLowerCase(), collection); }

  const plans: ProductPlan[] = orphans.map((line) => ({ rows: [line.row], handle: "", title: "", action: "problem" as const, variantCount: 0, columns: [], reasons: [{ row: line.row, message: "This row has no Handle, Title or SKU, so we cannot tell which product it is." }] }));

  for (const group of groups) {
    const first = group.lines[0];
    const reasons: PlanReason[] = [];
    const problem = (line: Line, key: ColumnKey | undefined, message: string) => { reasons.push({ row: line.row, column: key ? label(key) : undefined, message }); };
    const existing = store.productsByHandle.get(group.handle);
    const title = cellOf(first, "title") || existing?.title || "";
    const base = { rows: group.lines.map((line) => line.row), handle: group.handle, title, variantCount: group.lines.length, columns: [] as string[] };

    for (const line of group.lines) {
      for (const [key, limit] of Object.entries(LIMITS) as Array<[ColumnKey, number]>) {
        const length = cellOf(line, key).length;
        if (length > limit) problem(line, key, `is ${length} characters long. The most is ${limit}.`);
      }
      const earlier = repeatedSku.get(line.row);
      if (earlier) problem(line, "sku", `"${cellOf(line, "sku")}" is also on row ${earlier}. Every item needs its own SKU.`);
      const sku = cellOf(line, "sku").toLowerCase();
      const owner = sku ? store.skuOwners.get(sku) : undefined;
      if (owner && owner.handle !== group.handle) problem(line, "sku", `"${cellOf(line, "sku")}" already belongs to another product in your store (${owner.handle}).`);
    }

    if (existing && mode === "create") { plans.push({ ...base, action: "skip", reasons: [{ row: first.row, message: "Already in your store. Choose \"Create or update\" to change it." }] }); continue; }
    if (!existing && mode === "update") { plans.push({ ...base, action: "skip", reasons: [{ row: first.row, message: "Not in your store. Choose \"Create or update\" to add it." }] }); continue; }

    // ---- Values shared by create and update
    const money = (line: Line, key: ColumnKey) => { const parsed = parseMoney(cellOf(line, key)); if (!parsed.ok) { problem(line, key, parsed.reason + "."); return undefined; } return parsed.value; };
    const whole = (line: Line, key: ColumnKey) => { const parsed = parseWholeNumber(cellOf(line, key)); if (!parsed.ok) { problem(line, key, parsed.reason + "."); return undefined; } return parsed.value; };
    const yesNo = (line: Line, key: ColumnKey) => { const parsed = parseYesNo(cellOf(line, key)); if (!parsed.ok) { problem(line, key, parsed.reason + "."); return undefined; } return parsed.value; };

    const status = parseStatus(cellOf(first, "status"));
    if (!status.ok) problem(first, "status", status.reason + ".");
    const tags = parseList(cellOf(first, "tags"), ",");
    if (tags.length > 50) problem(first, "tags", `has ${tags.length} tags. The most is 50.`);
    const collectionIds: string[] = [];
    for (const name of parseList(cellOf(first, "collections"), ";")) {
      const found = collectionByName.get(name.toLowerCase());
      if (found) { if (!collectionIds.includes(found.id)) collectionIds.push(found.id); }
      else problem(first, "collections", `"${name}" is not a collection in your store. Create it first, or remove it from this cell.`);
    }

    // Option names come from the first row that gives them; other rows may repeat them or leave them empty.
    const names = ([1, 2, 3] as const).map((position) => {
      const key = `option${position}Name` as ColumnKey;
      const given = group.lines.map((line) => cellOf(line, key)).filter(Boolean);
      const name = given[0] ?? "";
      for (const line of group.lines) { const own = cellOf(line, key); if (own && own.toLowerCase() !== name.toLowerCase()) problem(line, key, `is "${own}" here but "${name}" on another row of this product. Use one name.`); }
      return name;
    });
    for (const position of [1, 2] as const) if (!names[position - 1] && names[position]) problem(first, `option${position + 1}Name` as ColumnKey, `is filled in but Option ${position} name is empty. Fill the options in order.`);
    const lowered = names.filter(Boolean).map((name) => name.toLowerCase());
    if (new Set(lowered).size !== lowered.length) problem(first, "option1Name", "Two options have the same name.");
    const used = names.map((name, index) => ({ name, position: index + 1 })).filter((option) => option.name);
    const valuesOf = (line: Line) => used.map((option) => cellOf(line, `option${option.position}Value` as ColumnKey));
    // A row that names an item of this product by its SKU does not also have to spell out its option values.
    const knownBySku = (line: Line) => { const sku = cellOf(line, "sku").toLowerCase(); return Boolean(sku && existing?.variants.some((variant) => (variant.sku ?? "").toLowerCase() === sku)); };
    for (const line of group.lines) {
      for (const position of [1, 2, 3] as const) if (!names[position - 1] && cellOf(line, `option${position}Value` as ColumnKey)) problem(line, `option${position}Value` as ColumnKey, `has a value but Option ${position} name is empty.`);
      if (!knownBySku(line)) valuesOf(line).forEach((value, index) => { if (!value) problem(line, `option${used[index].position}Value` as ColumnKey, `is empty. Every row of this product needs a ${used[index].name}.`); });
    }
    const seen = new Map<string, number>();
    for (const line of group.lines) {
      if (knownBySku(line)) continue;
      const key = valuesOf(line).map((value) => value.toLowerCase()).join("\u0001");
      if (used.length && seen.has(key)) problem(line, undefined, `Row ${seen.get(key)} has the same ${used.map((option) => option.name).join(" and ")}. Each combination can appear once.`);
      else if (!used.length && seen.has(key) && !cellOf(line, "sku")) problem(line, undefined, `This product is also on row ${seen.get(key)} and has no options. Add option columns (such as Size) to tell the rows apart.`);
      else seen.set(key, line.row);
    }
    if (group.lines.length > MAX_VARIANTS) problem(first, undefined, `This product has ${group.lines.length} rows. A product can have up to ${MAX_VARIANTS} variants.`);

    const variantFields = (line: Line) => ({
      price: money(line, "price"), compareAt: money(line, "compareAtPrice"), cost: money(line, "cost"),
      stock: whole(line, "stock"), track: yesNo(line, "trackStock"), weight: whole(line, "weightGrams"),
      sku: cellOf(line, "sku"), barcode: cellOf(line, "barcode"),
    });

    if (!existing) {
      // ---- A new product
      if (!cellOf(first, "title")) problem(first, "title", "is empty. A new product needs a title.");
      if (!HANDLE.test(group.handle)) problem(first, "handle", `"${group.handle}" can only use lowercase letters, numbers and hyphens, like oak-bed-frame.`);
      if (!used.length && group.lines.length > 1 && !reasons.length) problem(group.lines[1], undefined, `This product has ${group.lines.length} rows but no options. Add option columns (such as Size) to tell the rows apart.`);
      const optionIds = used.map((option, index) => slugify(option.name) || `option-${index + 1}`);
      const options = used.map((option, index) => {
        const labels: string[] = [];
        for (const line of group.lines) { const value = valuesOf(line)[index]; if (value && !labels.some((item) => item.toLowerCase() === value.toLowerCase())) labels.push(value); }
        const ids = new Set<string>();
        const values = labels.map((text, position) => { let id = slugify(text) || `value-${position + 1}`; while (ids.has(id)) id = `${id}-${position + 1}`; ids.add(id); return { id, label: text, position }; });
        return { id: optionIds[index], name: option.name, type: "variant" as const, required: true, position: index, values };
      });
      const variants: CatalogVariantInput[] = group.lines.map((line) => {
        const fields = variantFields(line);
        if (fields.price == null && fields.price !== undefined) problem(line, "price", "is empty. A new item needs a price.");
        const values = valuesOf(line);
        const chosen = Object.fromEntries(options.map((option, index) => [option.id, option.values.find((value) => value.label.toLowerCase() === (values[index] ?? "").toLowerCase())?.id ?? ""]));
        const tracked = fields.track ?? true;
        return {
          title: values.filter(Boolean).join(" / ") || "Standard", sku: fields.sku || null, barcode: fields.barcode || null,
          priceMinor: fields.price ?? 0, compareAtPriceMinor: fields.compareAt ?? null, costMinor: fields.cost ?? null,
          weightGrams: fields.weight ?? null, options: chosen,
          ...(tracked ? { trackInventory: true, quantity: fields.stock ?? 0 } : { trackInventory: false }),
        };
      });
      if (reasons.length) { plans.push({ ...base, action: "problem", reasons }); continue; }
      plans.push({ ...base, action: "create", reasons: [], create: {
        handle: group.handle, title: cellOf(first, "title"), description: cellOf(first, "description"), status: status.ok && status.value ? status.value : "DRAFT",
        vendor: cellOf(first, "vendor") || null, productType: cellOf(first, "productType") || null, tags, collectionIds,
        seoTitle: cellOf(first, "seoTitle") || null, seoDescription: cellOf(first, "seoDescription") || null,
        options, inventoryOptionIds: optionIds, variants,
      } });
      continue;
    }

    // ---- An existing product: only the columns in the file are written
    const input: UpdateProductInput = {};
    const columns = new Set<string>();
    const write = (key: ColumnKey) => { columns.add(label(key)); };
    if (mapped("title") && cellOf(first, "title")) { input.title = cellOf(first, "title"); write("title"); }
    if (mapped("description") && cellOf(first, "description")) { input.description = cellOf(first, "description"); input.descriptionDoc = null; write("description"); }
    if (mapped("status") && status.ok && status.value) { input.status = status.value; write("status"); }
    if (mapped("vendor")) { input.vendor = cellOf(first, "vendor") || null; write("vendor"); }
    if (mapped("productType")) { input.productType = cellOf(first, "productType") || null; write("productType"); }
    if (mapped("tags")) { input.tags = tags; write("tags"); }
    if (mapped("collections") && cellOf(first, "collections")) { input.collectionIds = collectionIds; write("collections"); }
    if (mapped("seoTitle")) { input.seoTitle = cellOf(first, "seoTitle") || null; write("seoTitle"); }
    if (mapped("seoDescription")) { input.seoDescription = cellOf(first, "seoDescription") || null; write("seoDescription"); }

    const axes = variantOptionsOf(existing);
    const options = (existing.options as Array<{ id: string; name: string; values?: Array<{ id: string; label: string; position?: number }> }>).map((option) => ({ ...option, values: [...(option.values ?? [])] }));
    let optionsChanged = false;
    const variantColumns: ColumnKey[] = ["sku", "barcode", "price", "compareAtPrice", "cost", "stock", "trackStock", "weightGrams"];
    const touchesVariants = variantColumns.some(mapped) || used.length > 0;
    const variants: CatalogVariantInput[] = [];
    if (touchesVariants) {
      if (used.length && !axes.length) problem(first, "option1Name", "This product has no options in your store. Add its options in the product editor first, then import the variants.");
      else if (used.length && (used.length !== axes.length || used.some((option) => !axes.some((axis) => axis.name.trim().toLowerCase() === option.name.toLowerCase())))) problem(first, "option1Name", `This product's options in your store are ${axes.map((axis) => axis.name).join(", ")}. Use the same option names.`);
      else for (const line of group.lines) {
        // A row with product details only (no SKU, price, stock or option values) changes no variant.
        if (!variantColumns.some((key) => cellOf(line, key)) && !valuesOf(line).some(Boolean)) continue;
        const fields = variantFields(line);
        const values = valuesOf(line);
        const bySku = fields.sku ? existing.variants.find((variant) => (variant.sku ?? "").toLowerCase() === fields.sku.toLowerCase()) : undefined;
        // The row's values as the product's own value ids, in the product's option order; undefined where the value is new.
        const chosen: Record<string, string | undefined> = {};
        const fresh: Array<{ optionId: string; label: string }> = [];
        used.forEach((option, index) => {
          const axis = axes.find((item) => item.name.trim().toLowerCase() === option.name.toLowerCase())!;
          const known = options.find((item) => item.id === axis.id)?.values.find((value) => value.label.trim().toLowerCase() === (values[index] ?? "").toLowerCase());
          chosen[axis.id] = known?.id;
          if (!known && values[index]) fresh.push({ optionId: axis.id, label: values[index] });
        });
        const byChoices = used.length && !fresh.length
          ? existing.variants.find((variant) => axes.every((axis) => String((variant.options as Record<string, unknown>)[axis.id] ?? "") === chosen[axis.id]))
          : !used.length && !axes.length && existing.variants.length === 1 ? existing.variants[0] : undefined;
        const found: CatalogVariant | undefined = bySku ?? byChoices;
        if (found) {
          const next: CatalogVariantInput = { id: found.id, title: found.title, sku: found.sku, priceMinor: found.priceMinor, compareAtPriceMinor: found.compareAtPriceMinor, trackInventory: found.trackInventory, options: found.options };
          if (mapped("sku") && fields.sku) { next.sku = fields.sku; write("sku"); }
          if (mapped("price") && fields.price != null) { next.priceMinor = fields.price; write("price"); }
          if (mapped("compareAtPrice") && fields.compareAt !== undefined) { next.compareAtPriceMinor = fields.compareAt; write("compareAtPrice"); }
          if (mapped("cost") && fields.cost != null) { next.costMinor = fields.cost; write("cost"); }
          if (mapped("barcode")) { next.barcode = fields.barcode || null; write("barcode"); }
          if (mapped("weightGrams") && fields.weight != null) { next.weightGrams = fields.weight; write("weightGrams"); }
          if (mapped("trackStock") && fields.track != null) { next.trackInventory = fields.track; write("trackStock"); }
          if (mapped("stock") && fields.stock != null) {
            if (next.trackInventory === false) problem(line, "stock", "is filled in, but this item does not track stock. Set Track stock to yes, or leave Stock empty.");
            else { next.quantity = fields.stock; next.trackInventory = true; write("stock"); }
          }
          variants.push(next);
        } else if (used.length) {
          // A new combination of an existing product.
          if (fields.price == null && fields.price !== undefined) problem(line, "price", "is empty. A new variant needs a price.");
          for (const item of fresh) {
            const option = options.find((entry) => entry.id === item.optionId)!;
            let id = slugify(item.label) || `value-${option.values.length + 1}`;
            while (option.values.some((value) => value.id === id)) id = `${id}-${option.values.length + 1}`;
            option.values.push({ id, label: item.label, position: option.values.length });
            chosen[item.optionId] = id;
            optionsChanged = true;
          }
          const tracked = fields.track ?? true;
          variants.push({
            title: values.join(" / "), sku: fields.sku || null, barcode: fields.barcode || null, priceMinor: fields.price ?? 0,
            compareAtPriceMinor: fields.compareAt ?? null, costMinor: fields.cost ?? null, weightGrams: fields.weight ?? null,
            options: Object.fromEntries(axes.map((axis) => [axis.id, chosen[axis.id] ?? ""])),
            ...(tracked ? { trackInventory: true, quantity: fields.stock ?? 0 } : { trackInventory: false }),
          });
          columns.add("New variant");
        } else if (axes.length) {
          problem(line, fields.sku ? "sku" : undefined, fields.sku
            ? `"${fields.sku}" is not an item of this product. To add a new variant, fill in ${axes.map((axis) => axis.name).join(" and ")} for this row.`
            : `This product has ${axes.map((axis) => axis.name).join(" and ")} in your store. Say which one this row is, or give its SKU.`);
        } else {
          problem(line, undefined, "This product has one item in your store and no options, so it can only have one row.");
        }
      }
      if (variants.length) input.variants = variants;
      if (optionsChanged) input.options = options;
    }
    if (reasons.length) { plans.push({ ...base, action: "problem", reasons }); continue; }
    if (!columns.size) { plans.push({ ...base, action: "skip", reasons: [{ row: first.row, message: "Nothing to change: the file has no columns for this product that can be updated." }] }); continue; }
    plans.push({ ...base, action: "update", reasons: [], columns: [...columns], update: { productId: existing.id, input } });
  }
  return plans.sort((a, b) => a.rows[0] - b.rows[0]);
}

export interface PlanCounts { products: number; create: number; update: number; skip: number; problem: number; rows: number; problemRows: number }

export function countPlans(plans: ProductPlan[]): PlanCounts {
  const counts: PlanCounts = { products: plans.length, create: 0, update: 0, skip: 0, problem: 0, rows: 0, problemRows: 0 };
  for (const plan of plans) { counts[plan.action]++; counts.rows += plan.rows.length; if (plan.action === "problem") counts.problemRows += new Set(plan.reasons.map((reason) => reason.row)).size; }
  return counts;
}
