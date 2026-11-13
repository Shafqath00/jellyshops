"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { AdminPage, Banner, Button, Card, ConfirmDialog, EmptyState, SkeletonBlock, StatusBadge, buttonClass, useToast, type StatusTone } from "@/components/admin";
import type { CheckResult, ColumnMapping, ImportDetail, ImportMode, ImportView, PlanPreview, ProductBulkApi } from "./api";

const MODES: Array<{ value: ImportMode; label: string; detail: string }> = [
  { value: "upsert", label: "Create or update", detail: "New products are added and products you already have are changed." },
  { value: "create", label: "Create only", detail: "Only new products are added. Products you already have are left alone." },
  { value: "update", label: "Update only", detail: "Only products you already have are changed. Nothing new is added." },
];
const ACTION: Record<PlanPreview["action"], { label: string; tone: StatusTone }> = {
  create: { label: "Will be created", tone: "success" }, update: { label: "Will be updated", tone: "info" }, skip: { label: "Will be skipped", tone: "neutral" }, problem: { label: "Needs fixing", tone: "critical" },
};
const STATUS: Record<ImportView["status"], { label: string; tone: StatusTone }> = {
  uploaded: { label: "Not checked yet", tone: "neutral" }, checked: { label: "Ready to import", tone: "info" }, running: { label: "Not finished", tone: "attention" }, finished: { label: "Finished", tone: "success" }, undone: { label: "Undone", tone: "neutral" },
};
const STEPS = ["Upload", "Match columns", "Check", "Import", "Results"] as const;
type Step = 0 | 1 | 2 | 3 | 4;
const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString("en-GB")} ${count === 1 ? one : many}`;
const day = (value: string) => new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const message = (failure: unknown, fallback: string) => failure instanceof Error ? failure.message : fallback;

/** Where a store is in the steps; shown above every step and read out as "Step 2 of 5". */
function Steps({ step }: { step: Step }) {
  return <ol className="jk-steps" aria-label="Import steps">{STEPS.map((label, index) => <li key={label} className={index === step ? "is-current" : index < step ? "is-done" : ""} aria-current={index === step ? "step" : undefined}>
    <span className="jk-steps-number" aria-hidden="true">{index + 1}</span><span className="sr-only">Step {index + 1} of {STEPS.length}: </span>{label}
  </li>)}</ol>;
}

/**
 * Products > Import: upload a spreadsheet, match its columns, check it, look at what will happen,
 * import with progress, then read the results. Nothing is saved before the merchant confirms.
 */
export function ImportWizard({ api }: { api: ProductBulkApi | null }) {
  const toast = useToast();
  const [step, setStep] = useState<Step>(0);
  const [detail, setDetail] = useState<ImportDetail | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mode, setMode] = useState<ImportMode>("upsert");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [view, setView] = useState<ImportView | null>(null);
  const [history, setHistory] = useState<ImportView[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [undoing, setUndoing] = useState<ImportView | null>(null);
  const [paused, setPaused] = useState(false);
  /** The import being run, kept even when its first step fails so "Carry on" knows what to carry on with. */
  const [runningId, setRunningId] = useState("");
  const stop = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => { if (api) void api.list().then(setHistory).catch(() => setHistory([])); }, [api]);
  useEffect(() => { refresh(); }, [refresh]);
  // Keyboard and screen-reader users land on the new step's heading.
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => () => { stop.current = true; }, []);

  async function upload(file: File | undefined) {
    if (!api || !file) return;
    if (!/\.(csv|xlsx|txt|tsv)$/i.test(file.name)) { setError("Choose a CSV or Excel (.xlsx) file."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("This file is larger than 5 MB. Split it into smaller files."); return; }
    setBusy("upload"); setError("");
    try { const uploaded = await api.upload(file); setDetail(uploaded); setMapping(uploaded.mapping); setCheck(null); setStep(1); }
    catch (failure) { setError(message(failure, "The file could not be uploaded. Try again.")); }
    finally { setBusy(""); if (fileInput.current) fileInput.current.value = ""; }
  }
  function drop(event: DragEvent<HTMLElement>) { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files?.[0]); }

  async function runCheck() {
    if (!api || !detail) return;
    setBusy("check"); setError("");
    try { setCheck(await api.check(detail.id, mapping, mode)); setStep(2); }
    catch (failure) { setError(message(failure, "The file could not be checked. Try again.")); }
    finally { setBusy(""); }
  }

  const runImport = useCallback(async (id: string) => {
    if (!api) return;
    stop.current = false; setPaused(false); setError(""); setStep(3); setBusy("import"); setRunningId(id);
    try {
      let current = await api.run(id);
      setView(current);
      // Each call saves the next few products; an interruption leaves the import where it stopped.
      while (current.status === "running" && !stop.current) { current = await api.run(id); setView(current); }
      if (current.status === "finished") { setStep(4); refresh(); }
      else setPaused(true);
    } catch (failure) { setError(message(failure, "The import stopped. Nothing is lost: choose Carry on.")); setPaused(true); }
    finally { setBusy(""); }
  }, [api, refresh]);

  async function resume(entry: ImportView) {
    if (!api) return;
    setError("");
    if (entry.status === "finished" || entry.status === "undone") { setView(entry); setDetail(null); setStep(4); return; }
    try {
      const loaded = await api.get(entry.id);
      setDetail(loaded); setMapping(loaded.mapping); setMode(loaded.mode); setCheck(null); setView(loaded);
      if (entry.status === "running") void runImport(entry.id); else setStep(1);
    } catch (failure) { setError(message(failure, "This import could not be opened.")); }
  }

  async function undo(entry: ImportView) {
    if (!api) return;
    const result = await api.undo(entry.id);
    setView(result); refresh();
    toast(result.undone.failed ? `Import undone, but ${plural(result.undone.failed, "product")} could not be put back` : "Import undone");
  }

  function startAgain() { setStep(0); setDetail(null); setCheck(null); setView(null); setError(""); setPaused(false); refresh(); }
  const report = (id: string) => { if (api) void api.download(`/imports/${encodeURIComponent(id)}/report`).catch((failure) => setError(message(failure, "The report could not be downloaded."))); };
  const template = (format: "csv" | "xlsx") => { if (api) void api.download(`/bulk/template?format=${format}`).catch((failure) => setError(message(failure, "The template could not be downloaded."))); };

  const importable = detail?.columns.filter((column) => column.imported) ?? [];
  const usedColumns = new Set(Object.values(mapping));
  const unmatched = detail ? detail.headers.map((header, index) => ({ header, index })).filter((item) => item.header && !usedColumns.has(item.index)) : [];
  const hasKey = mapping.handle !== undefined || mapping.title !== undefined || mapping.sku !== undefined;
  const toDo = check?.summary ? check.summary.create + check.summary.update : 0;
  const percent = view && view.progress.total ? Math.round((view.progress.done / view.progress.total) * 100) : 0;

  return <AdminPage title="Import products" width="detail" back={{ href: "/admin/products", label: "Products" }} description="Add or change many products at once from a spreadsheet. You see exactly what will happen before anything is saved.">
    <Steps step={step} />
    {error && <Banner tone="critical" onDismiss={() => setError("")}>{error}</Banner>}
    {!api && <Banner tone="warning">Sign in and choose a store to import products.</Banner>}

    {step === 0 && <>
      <Card>
        <h2 className="jk-step-heading" tabIndex={-1} ref={heading}>Upload your file</h2>
        <div className={`jk-dropzone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
          <UploadCloud size={28} aria-hidden="true" />
          <p className="jk-strong">Drag a file here, or choose one</p>
          <p className="jk-muted">CSV or Excel (.xlsx). Up to 5,000 rows and 5 MB. One row for each item you sell.</p>
          <label className={`${buttonClass("primary")} ${busy === "upload" || !api ? "is-disabled" : ""}`} aria-disabled={busy === "upload" || !api}>
            {busy === "upload" ? "Reading file…" : "Choose file"}
            <input ref={fileInput} type="file" className="sr-only" accept=".csv,.xlsx,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy === "upload" || !api} aria-label="Choose a CSV or Excel file" onChange={(event) => void upload(event.target.files?.[0])} />
          </label>
          {busy === "upload" && <span className="sr-only" role="status">Reading your file</span>}
        </div>
      </Card>
      <Card title="New to importing?" description="Start from our template. It has every column, examples, and a sheet that explains what goes where.">
        <div className="jk-row"><Button disabled={!api} icon={<FileSpreadsheet size={14} aria-hidden="true" />} onClick={() => template("xlsx")}>Download Excel template</Button><Button disabled={!api} onClick={() => template("csv")}>Download CSV template</Button></div>
        <ul className="jk-bullets">
          <li>To change products you already have, export them from Products, edit the file and import it here. Nothing is duplicated.</li>
          <li>Items are found by their SKU, or by their Handle and option values (such as Size).</li>
          <li>A column you leave out of the file is not touched in your store.</li>
          <li>Photos cannot be imported from a file yet. Add them in the product editor.</li>
        </ul>
      </Card>
      <Card title="Earlier imports" flush>
        {history === null ? <div className="jk-pad"><SkeletonBlock height={14} width="50%" /></div> : history.length === 0
          ? <EmptyState icon={FileSpreadsheet} title="No imports yet" description="Each import is listed here with what it did, so you can check it or undo it." />
          : <ul className="jk-rows" aria-label="Earlier imports">{history.map((entry) => <li key={entry.id} className="jk-rows-item">
            <div className="min-w-0 flex-1">
              <p className="jk-row"><strong className="truncate">{entry.fileName}</strong><StatusBadge tone={STATUS[entry.status].tone}>{STATUS[entry.status].label}</StatusBadge></p>
              <p className="jk-cell-sub">{day(entry.createdAt)} · {plural(entry.rowCount, "row")}{entry.status === "finished" || entry.status === "undone" ? ` · ${entry.counts.created} created, ${entry.counts.updated} updated, ${entry.counts.skipped} skipped, ${entry.counts.failed} not imported` : entry.status === "running" ? ` · ${entry.progress.done} of ${entry.progress.total} products done` : ""}</p>
            </div>
            <div className="jk-row">
              {entry.status === "running" && <Button size="small" variant="primary" onClick={() => void resume(entry)} aria-label={`Carry on with ${entry.fileName}`}>Carry on</Button>}
              {(entry.status === "uploaded" || entry.status === "checked") && <Button size="small" onClick={() => void resume(entry)} aria-label={`Continue ${entry.fileName}`}>Continue</Button>}
              {(entry.status === "finished" || entry.status === "undone") && <Button size="small" onClick={() => void resume(entry)} aria-label={`See the results of ${entry.fileName}`}>Results</Button>}
            </div>
          </li>)}</ul>}
      </Card>
    </>}

    {step === 1 && detail && <Card>
      <h2 className="jk-step-heading" tabIndex={-1} ref={heading}>Match your columns</h2>
      <p className="jk-muted">We found {plural(detail.rowCount, "row")} in {detail.fileName}. Check that each of our columns points at the right column in your file. Choose &ldquo;Not in my file&rdquo; to leave something alone.</p>
      <div className="jk-table-scroll"><table className="jk-table jk-match-table" aria-label="Column matching">
        <thead><tr><th scope="col">Jelly Shops column</th><th scope="col">Column in your file</th><th scope="col">First value</th></tr></thead>
        <tbody>{importable.map((column) => {
          const index = mapping[column.key];
          return <tr key={column.key}>
            <td data-mobile="primary"><label htmlFor={`match-${column.key}`} className="jk-strong">{column.label}</label><span className="jk-cell-sub">{column.help}</span></td>
            <td data-label="Your column"><select id={`match-${column.key}`} className="jk-select" value={index ?? ""} onChange={(event) => setMapping((current) => {
              const next = { ...current }; delete next[column.key];
              if (event.target.value !== "") { const chosen = Number(event.target.value); for (const key of Object.keys(next)) if (next[key] === chosen) delete next[key]; next[column.key] = chosen; }
              return next;
            })}><option value="">Not in my file</option>{detail.headers.map((header, position) => header && <option key={position} value={position}>{header}</option>)}</select></td>
            <td data-label="First value" className="jk-muted">{index !== undefined ? (detail.sample[0]?.[index] || "(empty)").slice(0, 60) : ""}</td>
          </tr>;
        })}</tbody>
      </table></div>
      {unmatched.length > 0 && <p className="jk-muted">Not used from your file: {unmatched.map((item) => item.header).join(", ")}.</p>}
      <fieldset className="jk-stack-sm"><legend className="jk-strong">What should the import do?</legend>
        {MODES.map((item) => <label key={item.value} className="jk-check"><input type="radio" name="import-mode" checked={mode === item.value} onChange={() => setMode(item.value)} /><span>{item.label}<span className="jk-cell-sub">{item.detail}</span></span></label>)}
      </fieldset>
      {!hasKey && <Banner tone="warning">Match at least one of Handle, Title or SKU, so we can tell which product each row is.</Banner>}
      <div className="jk-row is-between"><Button onClick={startAgain}>Choose another file</Button><Button variant="primary" loading={busy === "check"} loadingLabel="Checking…" disabled={!hasKey} onClick={() => void runCheck()}>Check file</Button></div>
    </Card>}

    {step === 2 && check?.summary && <>
      <Card>
        <h2 className="jk-step-heading" tabIndex={-1} ref={heading}>Check what will happen</h2>
        <p className="jk-muted">Nothing has been saved yet.</p>
        <dl className="jk-metrics jk-metrics-4" aria-label="Summary">
          <div className="jk-metric"><dt className="jk-metric-hint">Will be created</dt><dd><strong>{check.summary.create}</strong></dd></div>
          <div className="jk-metric"><dt className="jk-metric-hint">Will be updated</dt><dd><strong>{check.summary.update}</strong></dd></div>
          <div className="jk-metric"><dt className="jk-metric-hint">Will be skipped</dt><dd><strong>{check.summary.skip}</strong></dd></div>
          <div className="jk-metric"><dt className="jk-metric-hint">Need fixing</dt><dd><strong>{check.summary.problem}</strong></dd></div>
        </dl>
        {check.summary.problem > 0 && <Banner tone="warning" title={`${plural(check.summary.problem, "product")} will be left out`}>Fix {check.summary.problem === 1 ? "it" : "them"} in your file and upload it again, or import the rest now. A product with a problem on any of its rows is not imported at all.</Banner>}
        {toDo === 0 && <Banner tone="info">There is nothing to import with these settings. Go back to change the column matching or what the import should do.</Banner>}
        <div className="jk-row is-between"><Button onClick={() => setStep(1)}>Back to matching</Button><Button variant="primary" disabled={toDo === 0} onClick={() => check && void runImport(check.id)}>Import {plural(toDo, "product")}</Button></div>
      </Card>
      {check.problems.length > 0 && <Card title="What needs fixing" flush>
        <div className="jk-table-scroll jk-preview-table"><table className="jk-table" aria-label="Problems">
          <thead><tr><th scope="col">Row</th><th scope="col">Product</th><th scope="col">Column</th><th scope="col">What is wrong</th></tr></thead>
          <tbody>{check.problems.map((problem, index) => <tr key={index}><td data-label="Row">{problem.row}</td><td data-mobile="primary">{problem.handle || "Unknown"}</td><td data-label="Column">{problem.column ?? ""}</td><td data-label="What is wrong">{problem.column ? `${problem.column} ${problem.message}` : problem.message}</td></tr>)}</tbody>
        </table></div>
        {check.moreProblems > 0 && <p className="jk-muted jk-pad">And {plural(check.moreProblems, "more problem")}. They are all in the report after the import.</p>}
      </Card>}
      <Card title="Preview" flush>
        <div className="jk-table-scroll jk-preview-table"><table className="jk-table" aria-label="Preview of the import">
          <thead><tr><th scope="col">Product</th><th scope="col">What happens</th><th scope="col">Items</th><th scope="col">Details</th></tr></thead>
          <tbody>{check.plans.map((plan) => <tr key={`${plan.handle}-${plan.rows[0]}`}>
            <td data-mobile="primary"><span className="jk-strong">{plan.title || plan.handle || "Unknown"}</span><span className="jk-cell-sub">Row {plan.rows[0]}{plan.rows.length > 1 ? ` to ${plan.rows[plan.rows.length - 1]}` : ""}</span></td>
            <td data-label="What happens"><StatusBadge tone={ACTION[plan.action].tone}>{ACTION[plan.action].label}</StatusBadge></td>
            <td data-label="Items">{plan.variantCount}</td>
            <td data-label="Details" className="jk-muted">{plan.action === "update" ? `Changes: ${plan.columns.join(", ")}` : plan.action === "create" ? "New product" : plan.reasons[0] ? (plan.reasons[0].column ? `${plan.reasons[0].column} ${plan.reasons[0].message}` : plan.reasons[0].message) : ""}</td>
          </tr>)}</tbody>
        </table></div>
        {check.morePlans > 0 && <p className="jk-muted jk-pad">Showing the first {check.plans.length} products. {plural(check.morePlans, "more product")} will be handled the same way.</p>}
      </Card>
    </>}

    {step === 3 && <Card>
      <h2 className="jk-step-heading" tabIndex={-1} ref={heading}>{paused ? "Import paused" : "Importing your products"}</h2>
      <div className="jk-progress-block">
        <progress className="jk-progress" max={100} value={percent} aria-label="Import progress" />
        <p role="status" aria-live="polite">{view ? `${view.progress.done} of ${view.progress.total} products done (${percent}%)` : "Starting…"}</p>
      </div>
      {view && <p className="jk-muted">{view.counts.created} created · {view.counts.updated} updated · {view.counts.skipped} skipped · {view.counts.failed} not imported</p>}
      {paused
        ? <><Banner tone="warning" title="The import has not finished">What was done so far is saved. Carry on to do the rest; nothing will be imported twice.</Banner><div className="jk-row"><Button variant="primary" onClick={() => void runImport(runningId)}>Carry on</Button><Button onClick={startAgain}>Back to start</Button></div></>
        : <><p className="jk-muted">Keep this page open. If it closes, come back to Import products and choose Carry on.</p><div><Button onClick={() => { stop.current = true; }}>Pause</Button></div></>}
    </Card>}

    {step === 4 && view && <Card>
      <h2 className="jk-step-heading" tabIndex={-1} ref={heading}>{view.status === "undone" ? "This import was undone" : "Import finished"}</h2>
      <p className="jk-muted">{view.fileName} · {day(view.finishedAt ?? view.createdAt)}</p>
      <dl className="jk-metrics jk-metrics-4" aria-label="Results">
        <div className="jk-metric"><dt className="jk-metric-hint">Created</dt><dd><strong>{view.counts.created}</strong></dd></div>
        <div className="jk-metric"><dt className="jk-metric-hint">Updated</dt><dd><strong>{view.counts.updated}</strong></dd></div>
        <div className="jk-metric"><dt className="jk-metric-hint">Skipped</dt><dd><strong>{view.counts.skipped}</strong></dd></div>
        <div className="jk-metric"><dt className="jk-metric-hint">Not imported</dt><dd><strong>{view.counts.failed}</strong></dd></div>
      </dl>
      {view.status === "undone" && <Banner tone="info">Products this import created were archived and changed values were put back. Stock was left as it is.</Banner>}
      {view.status === "finished" && view.counts.failed === 0 && view.counts.created + view.counts.updated > 0 && <Banner tone="success">Everything in the file was imported. New products are drafts unless your file said otherwise.</Banner>}
      {view.counts.failed + view.counts.skipped > 0 && <Banner tone={view.counts.failed ? "warning" : "info"} title={view.counts.failed ? `${plural(view.counts.failed, "product was", "products were")} not imported` : `${plural(view.counts.skipped, "product was", "products were")} skipped`} action={<Button size="small" onClick={() => report(view.id)}>Download the report</Button>}>The report lists each row, the column and the reason. Fix the file and import it again; products already imported are not duplicated.</Banner>}
      <div className="jk-row is-between">
        <div className="jk-row"><Link href="/admin/products" className={buttonClass("primary")}>View products</Link><Button onClick={startAgain}>Import another file</Button></div>
        {view.canUndo && <Button variant="destructive-quiet" onClick={() => setUndoing(view)}>Undo this import…</Button>}
      </div>
    </Card>}

    <ConfirmDialog open={Boolean(undoing)} onOpenChange={(open) => { if (!open) setUndoing(null); }} title="Undo this import?" confirmLabel="Undo import" destructive
      description={undoing ? <><p>{plural(undoing.counts.created, "product")} it created will be archived, and {plural(undoing.counts.updated, "product")} it changed will get {undoing.counts.updated === 1 ? "its" : "their"} earlier details and prices back.</p><p>Stock levels are not changed, because orders may have happened since. Undoing cannot itself be undone.</p></> : ""}
      onConfirm={async () => { if (undoing) await undo(undoing); }} />
  </AdminPage>;
}
