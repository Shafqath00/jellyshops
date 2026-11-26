"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Circle } from "lucide-react";
import Link from "@/features/admin/admin-routing";
import { Banner, Button, Card, CardSkeleton, StatusBadge } from "@/components/admin";
import {
  buildSeoChecks, seoGrade, seoScore, setupChecklist, setupProgress, sortSeoChecks, storeSeoChecks,
  type SeoCheck, type SeoCheckItem, type SetupItem,
} from "@jelly/storefront-schema";
import type { SeoHealthReport } from "../api";
import type { PreferencesForm } from "../use-preferences-form";

/** A link to a card on this page ("#search") or to another admin page. */
function FixLink({ href, children, className = "jk-link" }: { href: string; children: React.ReactNode; className?: string }) {
  return href.startsWith("#") ? <a href={href} className={className}>{children}</a> : <Link href={href} className={className}>{children}</Link>;
}

const ITEM_HREF: Record<SeoCheckItem["kind"], (id: string) => string> = {
  product: (id) => `/admin/products/${encodeURIComponent(id)}`,
  page: (id) => `/admin/content/pages/${encodeURIComponent(id)}`,
  post: (id) => `/admin/content/blogs/${encodeURIComponent(id)}`,
  collection: () => "/admin/products/collections",
};

/**
 * Loads the SEO health report for the saved preferences. It runs again after each save and by hand; a failure only
 * affects this card (the rest of the page keeps working).
 */
export function useSeoHealth(form: PreferencesForm) {
  const revision = form.stored?.revision ?? -1;
  const available = form.stored?.available ?? false;
  const { seoHealth } = form.api;
  const [state, setState] = useState<{ key: string; report: SeoHealthReport | null; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${revision}:${attempt}`;
  useEffect(() => {
    if (revision < 0 || !available) return;
    let live = true;
    seoHealth().then(
      (report) => { if (live) setState({ key, report, error: "" }); },
      (failure: unknown) => { if (live) setState({ key, report: null, error: failure instanceof Error ? failure.message : "Could not run the check." }); },
    );
    return () => { live = false; };
  }, [revision, available, seoHealth, key]);
  return { report: state?.report ?? null, error: state?.error ?? "", loading: available && state?.key !== key, rerun: () => setAttempt((value) => value + 1) };
}

function ChecklistRow({ item }: { item: SetupItem }) {
  return <li className="jk-pref-task" data-done={item.done || undefined}>
    <span className="jk-pref-task-icon" aria-hidden="true">{item.done ? <Check size={14} /> : <Circle size={14} />}</span>
    <span className="jk-pref-task-text">
      <span className={item.done ? "jk-muted" : "jk-strong"}>{item.label}{item.optional && <span className="jk-muted"> (optional)</span>}<span className="sr-only">{item.done ? ", done" : ", not done"}</span></span>
      {!item.done && <small className="jk-muted">{item.help}</small>}
    </span>
    {!item.done && <FixLink href={item.href}>Fix</FixLink>}
  </li>;
}

export function SetupCard({ form, report, contactEmail }: { form: PreferencesForm; report: SeoHealthReport | null; contactEmail: string | null }) {
  const saved = form.stored?.preferences;
  const items = useMemo(() => saved && report ? setupChecklist(saved, { contactEmail, policies: report.policies }) : null, [saved, report, contactEmail]);
  if (!items) return <Card title="Store setup" description="What's still left to set up on this page."><CardSkeleton lines={3} label="Checking your setup" /></Card>;
  const progress = setupProgress(items);
  const todo = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);
  return <Card title="Store setup" description="What's still left to set up on this page. It reflects what you've saved.">
    <div className="jk-stack-sm" id="setup">
      <div className="jk-progress-row">
        <span className="jk-progress-text" role="status">{progress.done} of {progress.total} done</span>
        <div className="jk-progress" role="progressbar" aria-label="Setup progress" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress.percent}%` }} /></div>
      </div>
      {todo.length === 0 ? <Banner tone="success" title="All set up">Everything on the list is done. Nice work.</Banner>
        : <ul className="jk-pref-tasks" aria-label="Still to do">{todo.map((item) => <ChecklistRow key={item.id} item={item} />)}</ul>}
      {done.length > 0 && <details className="jk-disclosure"><summary>{done.length} done</summary><ul className="jk-pref-tasks" aria-label="Done">{done.map((item) => <ChecklistRow key={item.id} item={item} />)}</ul></details>}
    </div>
  </Card>;
}

function CheckRow({ check }: { check: SeoCheck }) {
  return <li className="jk-pref-check">
    <div className="jk-pref-check-head">
      <StatusBadge tone={check.severity === "problem" ? "critical" : "warning"}>{check.severity === "problem" ? "Fix" : "Tip"}</StatusBadge>
      <span className="jk-strong">{check.title}</span>
    </div>
    <p className="jk-muted">{check.advice}</p>
    <div className="jk-row">
      {check.fix && <FixLink href={check.fix.href} className="jk-button jk-button-sm">{check.fix.label}</FixLink>}
      {check.items.length > 0 && <details className="jk-disclosure"><summary>{check.count > check.items.length ? `Show ${check.items.length} of ${check.count}` : `Show ${check.count === 1 ? "it" : "all"}`}</summary>
        <ul className="jk-rows">{check.items.map((item) => <li key={`${item.kind}:${item.id}`} className="jk-rows-item"><Link href={ITEM_HREF[item.kind](item.id)} className="jk-link">{item.label}</Link></li>)}</ul>
      </details>}
    </div>
  </li>;
}

/** The SEO health check: a score, then what to fix, biggest first. */
export function HealthCard({ form, report, error, loading, onRerun }: { form: PreferencesForm; report: SeoHealthReport | null; error: string; loading: boolean; onRerun: () => void }) {
  const saved = form.stored?.preferences;
  const checks = useMemo(() => saved && report ? sortSeoChecks(buildSeoChecks([...storeSeoChecks(saved), ...report.checks])) : null, [saved, report]);
  const rerun = <Button size="small" onClick={onRerun} loading={loading} loadingLabel="Checking…">Check again</Button>;
  return <Card title="SEO health" description="How easy your store is to find on Google, with tips to fix what's holding it back." actions={rerun}>
    <div className="jk-stack-sm" id="health">
      {error ? <Banner tone="critical" title="The check didn't run" action={<Button onClick={onRerun}>Try again</Button>}>{error}</Banner>
        : !checks || !report ? <CardSkeleton lines={4} label="Checking your store" />
          : <HealthResult checks={checks} counts={report.counts} />}
    </div>
  </Card>;
}

function HealthResult({ checks, counts }: { checks: SeoCheck[]; counts: SeoHealthReport["counts"] }) {
  const score = seoScore(checks);
  const grade = seoGrade(score);
  const failing = checks.filter((check) => check.count > 0);
  const passed = checks.length - failing.length;
  const problems = failing.filter((check) => check.severity === "problem").length;
  return <>
    <div className="jk-pref-score" role="group" aria-label="SEO score">
      <span className="jk-pref-score-number" aria-label={`${score} out of 100`}>{score}</span>
      <div>
        <StatusBadge tone={grade.tone}>{grade.label}</StatusBadge>
        <p className="jk-muted">{failing.length === 0 ? "Nothing to fix." : `${problems} ${problems === 1 ? "thing" : "things"} to fix, ${failing.length - problems} ${failing.length - problems === 1 ? "tip" : "tips"}.`} Checked {counts.products} {counts.products === 1 ? "product" : "products"}, {counts.pages} {counts.pages === 1 ? "page" : "pages"}, {counts.posts} {counts.posts === 1 ? "post" : "posts"} and {counts.collections} {counts.collections === 1 ? "collection" : "collections"}.</p>
      </div>
    </div>
    {failing.length > 0 && <ul className="jk-pref-checks" aria-label="Things to improve">{failing.map((check) => <CheckRow key={check.id} check={check} />)}</ul>}
    {passed > 0 && <p className="jk-muted">{passed} {passed === 1 ? "check" : "checks"} passed.</p>}
  </>;
}
