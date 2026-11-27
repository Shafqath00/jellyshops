"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Field, useToast } from "@/components/admin";
import { DiscountRequestError, useDiscountsApi, type MerchantDiscount } from "./api";

const MAX_PER_REQUEST = 1000;

/**
 * A code discount's codes: how many there are, the newest few with their uses, "Generate codes" (many unique codes
 * sharing this discount's settings, e.g. one per customer in an email) and a CSV of all of them.
 */
export function DiscountCodesCard({ discount, onChanged }: { discount: MerchantDiscount; onChanged: () => void }) {
  const { listCodes, generateCodes, downloadCodes, canManage } = useDiscountsApi();
  const toast = useToast();
  const [page, setPage] = useState<{ codes: Array<{ code: string; uses: number }>; total: number } | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState("50");
  const [prefix, setPrefix] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    listCodes(discount.id, { limit: 5 }).then((result) => { if (active) { setPage(result); setError(""); } }).catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [listCodes, discount.id, revision]);

  const download = useCallback(async () => {
    try { await downloadCodes(discount.id, `${(discount.code ?? "discount").toLowerCase()}-codes.csv`); } catch (failure) { toast((failure as Error).message); }
  }, [downloadCodes, discount.id, discount.code, toast]);

  async function generate() {
    const how = Number(count);
    if (!Number.isInteger(how) || how < 1 || how > MAX_PER_REQUEST) { setProblem(`Enter a number from 1 to ${MAX_PER_REQUEST.toLocaleString("en-GB")}.`); return; }
    if (prefix && !/^[A-Za-z0-9_-]{1,20}$/.test(prefix)) { setProblem("Use up to 20 letters, numbers, dashes or underscores for the start."); return; }
    setBusy(true); setProblem("");
    try {
      const made = await generateCodes(discount.id, { count: how, prefix });
      toast(`${made.created} ${made.created === 1 ? "code" : "codes"} made`);
      setOpen(false);
      setRevision((value) => value + 1);
      onChanged();
    } catch (failure) {
      setProblem(failure instanceof DiscountRequestError ? failure.message : "The codes couldn't be made. Try again.");
    } finally { setBusy(false); }
  }

  const total = page?.total ?? discount.codeCount;
  return <Card title="Codes" description={total > 1 ? `${total.toLocaleString("en-GB")} codes share this discount's settings and its usage limit.` : "Make many unique codes that work like this one, for example one per customer in an email."}>
    <div className="jk-discount-section">
      {error && <p className="jk-field-error" role="alert">{error}</p>}
      {page && page.codes.length > 0 && <ul className="jk-discount-code-list" aria-label="Newest codes">
        {page.codes.map((row) => <li key={row.code}><span className="jk-code">{row.code}</span><span className="jk-muted">{row.uses === 0 ? "Not used" : `Used ${row.uses} ${row.uses === 1 ? "time" : "times"}`}</span></li>)}
      </ul>}
      <div className="jk-discount-code-actions">
        {canManage && <Button size="small" onClick={() => { setProblem(""); setOpen(true); }}>Generate codes</Button>}
        {total > 0 && <Button size="small" variant="quiet" onClick={() => void download()}>Download all as CSV</Button>}
      </div>
    </div>
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="jk-overlay" />
        <DialogPrimitive.Content className="jk-dialog" aria-describedby="generate-codes-intro">
          <DialogPrimitive.Title className="jk-dialog-title">Generate codes</DialogPrimitive.Title>
          {/* The card sits inside the discount form; React passes a submit up through the portal, so stop it here. */}
          <form className="jk-dialog-body" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void generate(); }}>
            <p id="generate-codes-intro" className="jk-muted">Each code is unique and gives the same discount. Customers can use any one of them; the total usage limit counts all codes together.</p>
            <Field id="generate-codes-count" label="How many codes" required help={`Up to ${MAX_PER_REQUEST.toLocaleString("en-GB")} at a time.`}>
              <input id="generate-codes-count" className="jk-input jk-input-short" inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} />
            </Field>
            <Field id="generate-codes-prefix" label="Start each code with (optional)" help={`For example "VIP-" gives codes like VIP-K7MPQ2XB.`}>
              <input id="generate-codes-prefix" className="jk-input" value={prefix} maxLength={20} autoComplete="off" onChange={(event) => setPrefix(event.target.value.replace(/\s+/g, "").toUpperCase())} />
            </Field>
            {problem && <p className="jk-field-error" role="alert">{problem}</p>}
            <div className="jk-dialog-footer jk-dialog-footer-inline">
              <DialogPrimitive.Close asChild><Button disabled={busy}>Cancel</Button></DialogPrimitive.Close>
              <Button type="submit" variant="primary" loading={busy} loadingLabel="Making codes…">Generate codes</Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  </Card>;
}
