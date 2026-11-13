"use client";
import { useMemo } from "react";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";

/** Types mirror backend/src/catalog-bulk/service.ts. */
export type ImportMode = "create" | "update" | "upsert";
export type ImportStatus = "uploaded" | "checked" | "running" | "finished" | "undone";
export type ColumnMapping = Record<string, number>;
export interface PlanCounts { products: number; create: number; update: number; skip: number; problem: number; rows: number; problemRows: number }
export interface ImportCounts { created: number; updated: number; skipped: number; failed: number }
export interface ImportView {
  id: string; fileName: string; format: "csv" | "xlsx"; status: ImportStatus; mode: ImportMode; rowCount: number;
  createdAt: string; finishedAt: string | null; undoneAt: string | null;
  progress: { done: number; total: number }; counts: ImportCounts; summary: PlanCounts | null; canUndo: boolean;
}
export interface SheetColumnInfo { key: string; label: string; help: string; level: "product" | "variant"; imported: boolean }
export interface ImportDetail extends ImportView { headers: string[]; mapping: ColumnMapping; sample: string[][]; columns: SheetColumnInfo[] }
export interface PlanReason { row: number; column?: string; message: string }
export interface PlanPreview { handle: string; title: string; action: "create" | "update" | "skip" | "problem"; rows: number[]; variantCount: number; columns: string[]; reasons: PlanReason[] }
export interface CheckResult extends ImportDetail { plans: PlanPreview[]; problems: Array<PlanReason & { handle: string }>; morePlans: number; moreProblems: number }
export interface UndoResult extends ImportView { undone: { archived: number; restored: number; failed: number } }
export interface ExportFilters { query?: string; status?: string; productType?: string; vendor?: string; tag?: string; collectionId?: string; available?: string }

export class BulkRequestError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }

export interface ProductBulkApi {
  upload(file: File): Promise<ImportDetail>;
  check(id: string, mapping: ColumnMapping, mode: ImportMode): Promise<CheckResult>;
  run(id: string): Promise<ImportView>;
  get(id: string): Promise<ImportDetail>;
  list(): Promise<ImportView[]>;
  undo(id: string): Promise<UndoResult>;
  /** Fetches a file with the merchant's sign-in and hands it to the browser to save. Says whether an export was cut short. */
  download(path: string): Promise<{ truncated: boolean; products: number | null }>;
}

/** The query string of an export: chosen ids win over filters. */
export function exportPath(format: "csv" | "xlsx", scope: { ids?: string[]; filters?: ExportFilters }): string {
  const params = new URLSearchParams({ format });
  if (scope.ids?.length) params.set("ids", scope.ids.join(","));
  else for (const [key, value] of Object.entries(scope.filters ?? {})) if (value) params.set(key, value);
  return `/bulk/export?${params}`;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createProductBulkApi(origin: string, storeId: string, token: string, fetcher: typeof fetch = fetch): ProductBulkApi {
  const base = `${origin}/api/stores/${encodeURIComponent(storeId)}/catalog`;
  const auth = { Authorization: `Bearer ${token}` };
  async function read<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => ({})) as T & { error?: { message?: string; code?: string } };
    if (!response.ok) throw new BulkRequestError(body.error?.message ?? "Something went wrong. Check your connection and try again.", response.status, body.error?.code);
    return body;
  }
  const post = <T,>(path: string, body?: unknown) => fetcher(base + path, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }).then((response) => read<T>(response));
  return {
    upload: (file) => { const form = new FormData(); form.append("file", file); return fetcher(`${base}/imports`, { method: "POST", headers: auth, body: form }).then((response) => read<ImportDetail>(response)); },
    check: (id, mapping, mode) => post<CheckResult>(`/imports/${encodeURIComponent(id)}/check`, { mapping, mode }),
    run: (id) => post<ImportView>(`/imports/${encodeURIComponent(id)}/run`),
    get: (id) => fetcher(`${base}/imports/${encodeURIComponent(id)}`, { headers: auth }).then((response) => read<ImportDetail>(response)),
    list: () => fetcher(`${base}/imports`, { headers: auth }).then((response) => read<{ imports: ImportView[] }>(response)).then((body) => body.imports),
    undo: (id) => post<UndoResult>(`/imports/${encodeURIComponent(id)}/undo`),
    async download(path) {
      const response = await fetcher(base + path, { headers: auth });
      if (!response.ok) await read(response);
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "products.csv";
      saveBlob(await response.blob(), name);
      const products = response.headers.get("X-Export-Products");
      return { truncated: response.headers.get("X-Export-Truncated") === "true", products: products == null ? null : Number(products) };
    },
  };
}

export function useProductBulkApi(): ProductBulkApi | null {
  const { activeStore, session } = useAuth();
  const storeId = activeStore?.id, token = session?.access_token;
  return useMemo(() => storeId && token ? createProductBulkApi(authApiOrigin(), storeId, token) : null, [storeId, token]);
}
